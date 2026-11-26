"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CONTENT_SNARE_REQUESTS_EXPORT_FORMAT, CONTENT_SNARE_REQUESTS_EXPORT_SCRIPT } from "@/lib/content-snare-export-script";

/**
 * Requests > Import from Content Snare. A script run in the browser on Content
 * Snare saves the open requests of the clients ticked there to a file; here
 * each client is matched to a creator (by email, or picked), and each ticked
 * request becomes a CCM request with the same questions, its example videos
 * and what the creator already uploaded. Nothing is sent to the creator.
 */

interface Client {
  key: string;
  name: string;
  email: string;
}
interface Entry {
  id: string;
  name: string;
  due: string | null;
  clientKey: string;
  files: number;
  bytes: number;
  unreadable: boolean;
  raw: Record<string, unknown>;
}
interface Copy {
  name: string;
  size: number;
  [k: string]: unknown;
}
type Outcome =
  | { state: "waiting" }
  | { state: "making" }
  | { state: "copying"; done: number; total: number; name: string }
  | { state: "done"; id: string; copied: number; failed: string[]; notes: string[] }
  | { state: "failed"; error: string; id?: string };

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

async function post(body: unknown) {
  const res = await fetch("/api/requests/import/content-snare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "That didn't come over. Try again in a minute.");
  return data;
}

const size = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b >= 1e6 ? `${Math.round(b / 1e6)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(day.slice(0, 4) !== String(new Date().getFullYear()) ? { year: "numeric" } : {}),
  });
const today = () => new Date().toISOString().slice(0, 10);

type Loose = Record<string, unknown>;
const obj = (v: unknown): Loose => (v && typeof v === "object" && !Array.isArray(v) ? (v as Loose) : {});
const list = (v: unknown): Loose[] => (Array.isArray(v) ? v.map(obj) : []);

/** The export file, read here only to list what's in it (the server reads each request itself) */
function readExport(data: unknown): { clients: Client[]; entries: Entry[] } {
  const d = obj(data);
  if (d.format !== CONTENT_SNARE_REQUESTS_EXPORT_FORMAT || !Array.isArray(d.requests)) throw new Error("not ours");
  const keyOf = (c: Loose) => String(c.email || c.id || "").trim().toLowerCase();
  const clients = new Map<string, Client>();
  for (const c of list(d.clients)) {
    const key = keyOf(c);
    if (key) clients.set(key, { key, name: String(c.full_name || c.email || "Unnamed client"), email: String(c.email || "") });
  }
  const entries: Entry[] = [];
  for (const raw of list(d.requests)) {
    if (raw.id == null) continue;
    const request = obj(raw.request);
    const client = list(raw.clients)[0] ?? {};
    const key = keyOf(client);
    if (key && !clients.has(key)) clients.set(key, { key, name: String(client.full_name || client.email || "Unnamed client"), email: String(client.email || "") });
    let files = 0;
    let bytes = 0;
    for (const p of list(raw.pages))
      for (const s of list(p.sections_attributes))
        for (const f of list(s.fields_attributes))
          for (const a of list(f.answers)) {
            const at = obj(a.attachment);
            if (at.url) {
              files++;
              bytes += Number(at.byte_size) || 0;
            }
          }
    const due = typeof request.due === "string" && /^\d{4}-\d{2}-\d{2}/.test(request.due) ? request.due.slice(0, 10) : null;
    entries.push({
      id: String(raw.id),
      name: String(raw.name || request.name || "Untitled"),
      due,
      clientKey: key,
      files,
      bytes,
      unreadable: !list(raw.pages).length,
      raw,
    });
  }
  return { clients: [...clients.values()], entries };
}

export function ContentSnareRequestsImport() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<{ clients: Client[]; entries: Entry[] } | null>(null);
  const [creators, setCreators] = React.useState<{ id: string; name: string }[]>([]);
  const [creatorFor, setCreatorFor] = React.useState<Record<string, string>>({});
  const [imported, setImported] = React.useState<Record<string, string>>({});
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [outcomes, setOutcomes] = React.useState<Record<string, Outcome>>({});
  const [busy, setBusy] = React.useState<false | "reading" | "importing">(false);
  const [progress, setProgress] = React.useState("");
  const [problem, setProblem] = React.useState<string | null>(null);
  const stop = React.useRef(false);

  const reset = () => {
    setFile(null);
    setCreators([]);
    setCreatorFor({});
    setImported({});
    setPicked(new Set());
    setOutcomes({});
    setProgress("");
    setProblem(null);
  };
  // Closing shows the new requests (refreshing earlier would close this with the results)
  const close = () => {
    const any = Object.values(outcomes).some((o) => o.state === "done" || ("id" in o && o.id));
    setOpen(false);
    reset();
    if (any) router.refresh();
  };

  const readFile = async (f: File | undefined) => {
    if (!f) return;
    setProblem(null);
    setBusy("reading");
    try {
      let parsed: { clients: Client[]; entries: Entry[] };
      try {
        parsed = readExport(JSON.parse(await f.text()));
      } catch {
        throw new Error("That isn't the requests export file. Run the script on Content Snare again and choose content-snare-requests.json.");
      }
      const found = await post({
        action: "match",
        emails: parsed.clients.map((c) => c.email).filter(Boolean),
        ids: parsed.entries.map((e) => e.id),
      });
      const matches = (found.matches ?? {}) as Record<string, string>;
      setCreators(found.creators ?? []);
      setImported(found.imported ?? {});
      setCreatorFor(Object.fromEntries(parsed.clients.map((c) => [c.key, matches[c.email] ?? ""])));
      // Ticked to start: not brought over before, readable, and not due more than a month ago
      const cutoff = new Date(Date.now() - MONTH_MS).toISOString().slice(0, 10);
      setPicked(new Set(parsed.entries.filter((e) => !found.imported?.[e.id] && !e.unreadable && (!e.due || e.due >= cutoff)).map((e) => e.id)));
      setFile(parsed);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const copyScript = async () => {
    try {
      await navigator.clipboard.writeText(CONTENT_SNARE_REQUESTS_EXPORT_SCRIPT);
      toast.success("Export script copied");
    } catch {
      toast.error("Couldn't copy. Select the script below and copy it.");
    }
  };

  const ready = (e: Entry) => picked.has(e.id) && !!creatorFor[e.clientKey] && !imported[e.id] && outcomes[e.id]?.state !== "done";

  const importPicked = async () => {
    if (!file) return;
    const todo = file.entries.filter(ready);
    stop.current = false;
    setBusy("importing");
    setOutcomes((o) => ({ ...o, ...Object.fromEntries(todo.map((e) => [e.id, { state: "waiting" } as Outcome])) }));
    for (const [n, e] of todo.entries()) {
      if (stop.current) break;
      const step = `Request ${n + 1} of ${todo.length}`;
      setProgress(`${step}: making ${e.name}`);
      setOutcomes((o) => ({ ...o, [e.id]: { state: "making" } }));
      let made: { id: string; copies: Copy[]; notes: string[] };
      try {
        made = await post({ action: "request", creatorId: creatorFor[e.clientKey], entry: e.raw });
      } catch (err) {
        setOutcomes((o) => ({ ...o, [e.id]: { state: "failed", error: err instanceof Error ? err.message : "Didn't come over" } }));
        continue;
      }
      setImported((m) => ({ ...m, [e.id]: made.id }));
      const failed: string[] = [];
      const copies = made.copies ?? [];
      const total = copies.reduce((s, c) => s + (Number(c.size) || 0), 0);
      let moved = 0;
      for (const [i, c] of copies.entries()) {
        if (stop.current) {
          failed.push(...copies.slice(i).map((x) => x.name));
          break;
        }
        setProgress(`${step}: copying file ${i + 1} of ${copies.length}${total ? ` (${size(moved)} of ${size(total)})` : ""}`);
        setOutcomes((o) => ({ ...o, [e.id]: { state: "copying", done: i, total: copies.length, name: c.name } }));
        try {
          await post({ action: "file", requestId: made.id, copy: c });
        } catch {
          failed.push(c.name);
        }
        moved += Number(c.size) || 0;
      }
      setOutcomes((o) => ({ ...o, [e.id]: { state: "done", id: made.id, copied: copies.length - failed.length, failed, notes: made.notes ?? [] } }));
    }
    setProgress("");
    setBusy(false);
  };

  const groups = file ? file.clients.map((c) => ({ client: c, entries: file.entries.filter((e) => e.clientKey === c.key) })).filter((g) => g.entries.length) : [];
  const readyCount = file ? file.entries.filter(ready).length : 0;
  const doneCount = Object.values(outcomes).filter((o) => o.state === "done").length;
  const toggle = (id: string, on: boolean) =>
    setPicked((p) => {
      const n = new Set(p);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  const now = today();

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Upload className="size-4" aria-hidden="true" />
        Import from Content Snare
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (busy) return;
          if (o) setOpen(true);
          else close();
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import requests from Content Snare</DialogTitle>
            <DialogDescription>
              Your clients&rsquo; open requests come over with their questions, example videos and what the creator has already uploaded.
              Creators aren&rsquo;t sent anything.
            </DialogDescription>
          </DialogHeader>

          {!file ? (
            <div className="space-y-3">
              <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-2">
                <li>
                  Open{" "}
                  <a href="https://app.contentsnare.com" target="_blank" rel="noopener noreferrer" className="text-ink underline">
                    app.contentsnare.com
                  </a>{" "}
                  and sign in.
                </li>
                <li>
                  Open the browser console there: Ctrl+Shift+J on Windows, Cmd+Option+J on a Mac (Chrome). If Chrome asks, type{" "}
                  <span className="font-mono text-ink">allow pasting</span> first.
                </li>
                <li>Paste the export script and press Enter. Tick the clients you want and select Export: it saves content-snare-requests.json to your downloads.</li>
                <li>Choose that file here.</li>
              </ol>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => void copyScript()}>
                  <Copy className="size-4" aria-hidden="true" />
                  Copy the export script
                </Button>
                <Button type="button" onClick={() => fileInput.current?.click()} disabled={!!busy}>
                  {busy === "reading" && <Loader2 className="animate-spin" aria-hidden="true" />}
                  {busy === "reading" ? "Reading the file…" : "Choose the file"}
                </Button>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".json,application/json"
                  className="sr-only"
                  aria-label="The Content Snare requests export file"
                  onChange={(e) => void readFile(e.target.files?.[0])}
                />
              </div>
              <details className="text-[13px] text-ink-2">
                <summary className="cursor-pointer select-none text-ink">What the script does</summary>
                <p className="mt-2">
                  It uses the sign-in Content Snare already has in that tab to list your clients, lets you tick the ones you want, then saves
                  their open requests (sent, waiting for approval or past due) to a file. It changes nothing in Content Snare, and your sign-in
                  doesn&rsquo;t leave that tab or go in the file. Only paste scripts you trust into a console.
                </p>
                <pre className="mt-2 max-h-48 overflow-auto rounded-[var(--tw-r-ctl)] bg-well p-3 font-mono text-[12px] leading-snug text-ink-2">
                  {CONTENT_SNARE_REQUESTS_EXPORT_SCRIPT}
                </pre>
              </details>
            </div>
          ) : groups.length === 0 ? (
            <p className="text-sm text-ink-2">There are no requests in this file.</p>
          ) : (
            <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
              <p className="text-[13px] text-ink-2">
                Requests due more than a month ago start unticked. Keep this open while it imports: big videos take a while to copy.
              </p>
              {groups.map(({ client, entries }) => {
                const creatorId = creatorFor[client.key];
                const open = entries.filter((e) => !imported[e.id] && !e.unreadable);
                const ticked = open.filter((e) => picked.has(e.id)).length;
                const pickAll = (on: boolean) =>
                  setPicked((p) => {
                    const n = new Set(p);
                    for (const e of open) {
                      if (on) n.add(e.id);
                      else n.delete(e.id);
                    }
                    return n;
                  });
                return (
                  <section key={client.key} aria-label={client.name} className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">{client.name}</p>
                        <p className="text-[13px] text-ink-2">
                          {plural(entries.length, "open request")}, {ticked.toLocaleString()} ticked
                          {client.email && client.name !== client.email ? ` · ${client.email}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select value={creatorId || undefined} onValueChange={(v) => setCreatorFor((m) => ({ ...m, [client.key]: v }))} disabled={!!busy}>
                          <SelectTrigger aria-label={`The creator ${client.name} is in CCM`} className="h-8 w-[200px]">
                            <SelectValue placeholder="Pick their creator" />
                          </SelectTrigger>
                          <SelectContent>
                            {creators.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="ghost" size="sm" disabled={!!busy || ticked === open.length} onClick={() => pickAll(true)}>
                          Pick all
                        </Button>
                        <Button type="button" variant="ghost" size="sm" disabled={!!busy || ticked === 0} onClick={() => pickAll(false)}>
                          Clear
                        </Button>
                      </div>
                    </div>
                    {!creatorId && (
                      <p className="text-[13px] text-late">
                        No creator in CCM has {client.email || "this email"}. Pick theirs to import these.
                      </p>
                    )}
                    <ul className="divide-y divide-line rounded-[var(--tw-r-tile)] bg-tile">
                      {entries.map((e) => {
                        const o = outcomes[e.id];
                        const before = imported[e.id] && !o;
                        const overdue = e.due && e.due < now;
                        return (
                          <li key={e.id} className="flex items-start gap-3 px-3 py-2.5">
                            <Checkbox
                              id={`csr-${e.id}`}
                              aria-label={`Import ${e.name}`}
                              className="mt-0.5"
                              checked={picked.has(e.id) && !before}
                              onCheckedChange={(v) => toggle(e.id, !!v)}
                              disabled={!!busy || !!before || e.unreadable || o?.state === "done" || !creatorId}
                            />
                            <label htmlFor={`csr-${e.id}`} className="min-w-0 flex-1 text-sm">
                              <span className="font-medium text-ink">{e.name}</span>
                              <span className="block text-[13px] text-ink-2">
                                {e.due ? `Due ${dayLabel(e.due)}${overdue ? " (overdue)" : ""}` : "No due date"}
                                {" · "}
                                {e.files ? `${plural(e.files, "file")} to copy (${size(e.bytes)})` : "No files yet"}
                              </span>
                              {before && (
                                <span className="block text-[13px] text-ink-2">
                                  Already in CCM.{" "}
                                  <Link href={`/dashboard/requests/${imported[e.id]}`} className="text-ink underline">
                                    Open it
                                  </Link>
                                </span>
                              )}
                              {e.unreadable && <span className="block text-[13px] text-late">Its page didn&rsquo;t export. Export this client again to bring it over.</span>}
                              {o?.state === "waiting" && <span className="block text-[13px] text-ink-2">Waiting…</span>}
                              {(o?.state === "making" || o?.state === "copying") && (
                                <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
                                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                                  {o.state === "making" ? "Making the request…" : `Copying file ${o.done + 1} of ${o.total}: ${o.name}`}
                                </span>
                              )}
                              {o?.state === "done" && (
                                <span className="block text-[13px] text-ink-2">
                                  <Check className="mr-1 inline size-3.5 align-[-2px]" aria-hidden="true" />
                                  Imported{o.copied ? ` with ${plural(o.copied, "file")}` : ""}.{" "}
                                  <Link href={`/dashboard/requests/${o.id}`} className="text-ink underline">
                                    Open it
                                  </Link>
                                  {(o.failed.length > 0 || o.notes.length > 0) && (
                                    <ul className="mt-1 list-disc pl-4">
                                      {o.failed.length > 0 && (
                                        <li className="text-late">
                                          {plural(o.failed.length, "file")} didn&rsquo;t copy ({o.failed.slice(0, 3).join(", ")}
                                          {o.failed.length > 3 ? "…" : ""}): they&rsquo;re still in Content Snare.
                                        </li>
                                      )}
                                      {o.notes.map((n) => (
                                        <li key={n}>{n}</li>
                                      ))}
                                    </ul>
                                  )}
                                </span>
                              )}
                              {o?.state === "failed" && (
                                <span className="block text-[13px] text-late">
                                  <X className="mr-1 inline size-3.5 align-[-2px]" aria-hidden="true" />
                                  {o.error}
                                </span>
                              )}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}

          {problem && (
            <p className="text-sm text-late" role="alert">
              {problem}
            </p>
          )}
          <p className="text-[13px] text-ink-2" aria-live="polite">
            {busy === "importing" ? progress : doneCount ? `${plural(doneCount, "request")} imported.` : ""}
          </p>

          <DialogFooter>
            {busy === "importing" ? (
              <Button type="button" variant="outline" onClick={() => (stop.current = true)}>
                Stop after this file
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={close} disabled={!!busy}>
                {doneCount ? "Done" : "Cancel"}
              </Button>
            )}
            {file && groups.length > 0 && (
              <Button type="button" onClick={() => void importPicked()} disabled={!!busy || readyCount === 0}>
                {busy === "importing" && <Loader2 className="animate-spin" aria-hidden="true" />}
                {busy === "importing" ? "Importing…" : `Import ${readyCount ? plural(readyCount, "request") : "requests"}`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
