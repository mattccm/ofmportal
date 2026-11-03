"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Download, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Templates > Import from Content Snare. Paste a personal access token, pick
 * templates, and each becomes a CCM template (switched off, to look over).
 * The token stays in this dialog: sent with each call, never saved.
 */

interface SnareTemplate {
  id: string;
  name: string;
  description: string;
}
type Outcome =
  | { state: "waiting" }
  | { state: "working" }
  | { state: "done"; id: string; fields: number; examples: number; notes: string[] }
  | { state: "failed"; error: string };

async function post(body: unknown) {
  const res = await fetch("/api/templates/import/content-snare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Content Snare didn't answer. Try again in a minute.");
  return data;
}

export function ContentSnareImport() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [token, setToken] = React.useState("");
  const [templates, setTemplates] = React.useState<SnareTemplate[] | null>(null);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [outcomes, setOutcomes] = React.useState<Record<string, Outcome>>({});
  const [busy, setBusy] = React.useState<false | "list" | "import">(false);
  const [problem, setProblem] = React.useState<string | null>(null);

  // Closing shows the new templates (refreshing earlier would close this with the results)
  const close = () => {
    const imported = Object.values(outcomes).some((o) => o.state === "done");
    setOpen(false);
    reset();
    if (imported) router.refresh();
  };

  const reset = () => {
    setToken("");
    setTemplates(null);
    setPicked(new Set());
    setOutcomes({});
    setProblem(null);
  };

  const list = async () => {
    setBusy("list");
    setProblem(null);
    try {
      const data = await post({ action: "list", token });
      setTemplates(data.templates ?? []);
      setPicked(new Set());
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Couldn't list the templates.");
    } finally {
      setBusy(false);
    }
  };

  const importPicked = async () => {
    if (!templates) return;
    const todo = templates.filter((t) => picked.has(t.id) && outcomes[t.id]?.state !== "done");
    setBusy("import");
    setOutcomes((o) => ({ ...o, ...Object.fromEntries(todo.map((t) => [t.id, { state: "waiting" } as Outcome])) }));
    for (const t of todo) {
      setOutcomes((o) => ({ ...o, [t.id]: { state: "working" } }));
      try {
        const data = await post({ action: "import", token, template: t });
        setOutcomes((o) => ({ ...o, [t.id]: { state: "done", id: data.id, fields: data.fields, examples: data.examples, notes: data.notes ?? [] } }));
      } catch (e) {
        setOutcomes((o) => ({ ...o, [t.id]: { state: "failed", error: e instanceof Error ? e.message : "Didn't import" } }));
      }
    }
    setBusy(false);
  };

  const pickedCount = picked.size;
  const doneCount = Object.values(outcomes).filter((o) => o.state === "done").length;
  const toggle = (id: string, on: boolean) =>
    setPicked((p) => {
      const n = new Set(p);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Download className="size-4" aria-hidden="true" />
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
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Import from Content Snare</DialogTitle>
            <DialogDescription>
              Each template comes over with its fields, instructions and example images, switched off so you can look it over first.
            </DialogDescription>
          </DialogHeader>

          {!templates ? (
            <div className="space-y-3">
              <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-2">
                <li>
                  In Content Snare, open{" "}
                  <a href="https://app.contentsnare.com/settings/security/access-tokens" target="_blank" rel="noopener noreferrer" className="text-ink underline">
                    Personal access tokens
                  </a>{" "}
                  and select Generate token.
                </li>
                <li>Tick Read templates, Read requests and Write requests. Write is for a draft that&rsquo;s made and deleted for each template.</li>
                <li>Copy the token (it starts with cs_pat_) and paste it here. It isn&rsquo;t saved.</li>
              </ol>
              <div>
                <Label htmlFor="cs-token">Personal access token</Label>
                <Input
                  id="cs-token"
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(e) => setToken(e.target.value.trim())}
                  placeholder="cs_pat_…"
                  className="mt-1.5 font-mono"
                  disabled={!!busy}
                />
              </div>
              <p className="text-[13px] text-ink-2">
                A template someone shared with you by link has to be in your Content Snare account first: open the link while signed in to
                Content Snare and import it there.
              </p>
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-ink-2">This Content Snare account has no request templates.</p>
          ) : (
            <div>
              <div className="flex items-center justify-between gap-3 pb-2">
                <p className="text-sm font-medium">
                  {templates.length} {templates.length === 1 ? "template" : "templates"} in Content Snare
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!!busy}
                  onClick={() => setPicked(pickedCount === templates.length ? new Set() : new Set(templates.map((t) => t.id)))}
                >
                  {pickedCount === templates.length ? "Clear" : "Pick all"}
                </Button>
              </div>
              <ul className="max-h-[50vh] divide-y divide-line overflow-y-auto rounded-[var(--tw-r-tile)] bg-tile">
                {templates.map((t) => {
                  const o = outcomes[t.id];
                  return (
                    <li key={t.id} className="flex items-start gap-3 px-3 py-2.5">
                      <Checkbox
                        id={`cs-${t.id}`}
                        aria-label={`Import ${t.name}`}
                        className="mt-0.5"
                        checked={picked.has(t.id)}
                        onCheckedChange={(v) => toggle(t.id, !!v)}
                        disabled={!!busy || o?.state === "done"}
                      />
                      <label htmlFor={`cs-${t.id}`} className="min-w-0 flex-1 text-sm">
                        <span className="font-medium text-ink">{t.name}</span>
                        {t.description && <span className="block truncate text-[13px] text-ink-2">{t.description}</span>}
                        {o?.state === "waiting" && <span className="block text-[13px] text-ink-2">Waiting…</span>}
                        {o?.state === "working" && (
                          <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
                            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Bringing it over…
                          </span>
                        )}
                        {o?.state === "done" && (
                          <span className="block text-[13px] text-ink-2">
                            <Check className="mr-1 inline size-3.5 align-[-2px]" aria-hidden="true" />
                            {o.fields} {o.fields === 1 ? "field" : "fields"}
                            {o.examples ? `, ${o.examples} ${o.examples === 1 ? "example" : "examples"}` : ""}.{" "}
                            <Link href={`/dashboard/templates/${o.id}/edit`} className="text-ink underline">
                              Look it over
                            </Link>
                            {o.notes.length > 0 && (
                              <ul className="mt-1 list-disc pl-4">
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
            </div>
          )}

          {problem && (
            <p className="text-sm text-late" role="alert">
              {problem}
            </p>
          )}
          <p className="sr-only" aria-live="polite">
            {busy === "import" ? "Importing" : doneCount ? `${doneCount} imported` : ""}
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={!!busy}>
              {doneCount ? "Done" : "Cancel"}
            </Button>
            {!templates ? (
              <Button type="button" onClick={() => void list()} disabled={!!busy || !token.startsWith("cs_pat_")}>
                {busy === "list" && <Loader2 className="animate-spin" aria-hidden="true" />}
                Show my templates
              </Button>
            ) : (
              templates.length > 0 && (
                <Button type="button" onClick={() => void importPicked()} disabled={!!busy || pickedCount === 0}>
                  {busy === "import" && <Loader2 className="animate-spin" aria-hidden="true" />}
                  {busy === "import" ? "Importing…" : `Import ${pickedCount || ""} ${pickedCount === 1 ? "template" : "templates"}`.replace("  ", " ")}
                </Button>
              )
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
