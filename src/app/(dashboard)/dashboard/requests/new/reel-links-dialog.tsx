"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MAX_REEL_LINKS, parseReelLinks, type ReelLink, type ReelResult } from "@/lib/reel-links";
import type { ComposeField } from "./field-list";

/**
 * "Add reels from links": paste Instagram links, and each reel becomes an
 * upload field ("Reel 1", "Reel 2"...) with that reel as its example video.
 * The new fields copy the settings and instructions of the request's first
 * upload field with an example video (the template's reel slot), and replace
 * those slots, or go after the other fields.
 */

const BATCH = 10;

/** The field new reels are modelled on: the first upload field with an example video, else the first upload field */
export function reelPattern(fields: ComposeField[]): ComposeField | undefined {
  return fields.find((f) => f.type === "file" && f.richContent?.exampleVideoUrl) ?? fields.find((f) => f.type === "file");
}

const isReelSlot = (f: ComposeField) => f.type === "file" && !!f.richContent?.exampleVideoUrl;

export function withReels(
  fields: ComposeField[],
  reels: { url: string }[],
  { prefix, replace }: { prefix: string; replace: boolean }
): ComposeField[] {
  const pattern = reelPattern(fields);
  const name = prefix.trim() || "Reel";
  const kept = replace ? fields.filter((f) => !isReelSlot(f)) : fields;
  // Adding: carry on from the highest "Reel N" already there
  const numbered = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(\\d+)$`, "i");
  const start = replace ? 0 : Math.max(0, ...kept.map((f) => Number(f.label.trim().match(numbered)?.[1] ?? 0)));
  const rc = pattern?.richContent ?? {};
  const made: ComposeField[] = reels.map((r, i) => ({
    id: `field_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`,
    label: `${name} ${start + i + 1}`,
    value: "",
    type: "file",
    required: pattern?.required ?? true,
    helpText: pattern?.helpText,
    acceptedFileTypes: pattern?.acceptedFileTypes ?? ["image/*", "video/*"],
    maxFileSize: pattern?.maxFileSize,
    maxFiles: pattern?.maxFiles,
    minFiles: pattern?.minFiles,
    // The pattern's wording and display settings; this reel as the only example
    richContent: {
      description: rc.description,
      exampleText: rc.exampleText,
      instructionsLabel: rc.instructionsLabel,
      examplesLabel: rc.examplesLabel,
      showInstructionsToggle: rc.showInstructionsToggle,
      showExamplesToggle: rc.showExamplesToggle,
      exampleVideoUrl: r.url,
    },
  }));
  if (!replace) return [...kept, ...made];
  // In place of the first reel slot, so they stay where the template had them
  const at = fields.findIndex(isReelSlot);
  if (at < 0) return [...kept, ...made];
  const before = fields.slice(0, at).filter((f) => !isReelSlot(f));
  return [...before, ...made, ...kept.slice(before.length)];
}

export function ReelLinksDialog({
  open,
  onOpenChange,
  fields,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: ComposeField[];
  onAdd: (next: ComposeField[], count: number) => void;
}) {
  const [text, setText] = React.useState("");
  const [prefix, setPrefix] = React.useState("Reel");
  const [replace, setReplace] = React.useState(true);
  const [busy, setBusy] = React.useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = React.useState<{ link: ReelLink; error: string }[]>([]);
  const [problem, setProblem] = React.useState<string | null>(null);

  const links = React.useMemo(() => parseReelLinks(text), [text]);
  const slots = fields.filter(isReelSlot).length;
  const tooMany = links.length > MAX_REEL_LINKS;

  React.useEffect(() => {
    if (!open) return;
    setFailed([]);
    setProblem(null);
  }, [open]);

  const run = async () => {
    if (!links.length || tooMany) return;
    setBusy({ done: 0, total: links.length });
    setFailed([]);
    setProblem(null);
    const got: { link: ReelLink; result: ReelResult }[] = [];
    try {
      for (let i = 0; i < links.length; i += BATCH) {
        const batch = links.slice(i, i + BATCH);
        const res = await fetch("/api/examples/reels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ links: batch.map((l) => l.url) }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setProblem(data.error || "Couldn't fetch the reels. Try again in a minute.");
          break;
        }
        const results: ReelResult[] = Array.isArray(data.results) ? data.results : [];
        batch.forEach((link) => {
          const result = results.find((r) => r.code === link.code) ?? { code: link.code, ok: false as const, error: "No answer for this one" };
          got.push({ link, result });
        });
        setBusy({ done: Math.min(i + BATCH, links.length), total: links.length });
      }
    } catch {
      setProblem("Couldn't reach the portal. Check your connection and try again.");
    }

    const ok = got.flatMap(({ result }) => (result.ok ? [{ url: result.url }] : []));
    const bad = got.flatMap(({ link, result }) => (result.ok ? [] : [{ link, error: result.error }]));
    setBusy(null);
    if (ok.length) {
      onAdd(withReels(fields, ok, { prefix, replace: replace && slots > 0 }), ok.length);
      toast.success(`Added ${ok.length} ${ok.length === 1 ? "reel" : "reels"} as examples`);
    }
    if (bad.length) {
      setFailed(bad);
      // Keep only the ones to try again
      setText(bad.map((b) => b.link.url).join("\n"));
      // Anything added stays added; trying again adds after it
      if (ok.length) setReplace(false);
    } else if (ok.length) {
      setText("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add reels from links</DialogTitle>
          <DialogDescription>
            Paste Instagram reel or post links. Each one becomes an upload field with that reel as its example, for every creator this request goes to.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="reel-links">Links</Label>
            <Textarea
              id="reel-links"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder={"https://www.instagram.com/p/…\nhttps://www.instagram.com/reel/…"}
              className="mt-1.5 font-mono text-[13px]"
              disabled={!!busy}
              aria-describedby="reel-links-count"
            />
            <p id="reel-links-count" className={tooMany ? "mt-1.5 text-[13px] text-late" : "mt-1.5 text-[13px] text-ink-2"} aria-live="polite">
              {tooMany
                ? `${links.length} links: up to ${MAX_REEL_LINKS} at a time.`
                : links.length
                  ? `${links.length} ${links.length === 1 ? "reel" : "reels"} found.`
                  : "One per line, or paste them all at once."}
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="w-40">
              <Label htmlFor="reel-prefix">Name them</Label>
              <Input id="reel-prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} className="mt-1.5" disabled={!!busy} />
            </div>
            <p className="pb-2 text-[13px] text-ink-2">
              {prefix.trim() || "Reel"} 1, {prefix.trim() || "Reel"} 2…
            </p>
          </div>

          {slots > 0 && (
            <fieldset>
              <legend className="text-sm font-medium">The {slots} {slots === 1 ? "field" : "fields"} with an example video already here</legend>
              <div className="mt-1.5 space-y-1.5 text-sm">
                <label className="flex min-h-9 items-center gap-2">
                  <input type="radio" name="reel-mode" checked={replace} onChange={() => setReplace(true)} disabled={!!busy} className="size-4 accent-ink" />
                  Replace them with these reels
                </label>
                <label className="flex min-h-9 items-center gap-2">
                  <input type="radio" name="reel-mode" checked={!replace} onChange={() => setReplace(false)} disabled={!!busy} className="size-4 accent-ink" />
                  Keep them and add these after
                </label>
              </div>
            </fieldset>
          )}

          {problem && <p className="text-sm text-late" role="alert">{problem}</p>}
          {failed.length > 0 && (
            <div role="status">
              <p className="text-sm font-medium">
                {failed.length} {failed.length === 1 ? "link" : "links"} didn&rsquo;t work. They&rsquo;re left above to try again, or upload those yourself.
              </p>
              <ul className="mt-1.5 space-y-1 text-[13px] text-ink-2">
                {failed.map((f) => (
                  <li key={f.link.code}>
                    <span className="font-mono text-ink">{f.link.code}</span>: {f.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={!!busy}>
            {failed.length ? "Done" : "Cancel"}
          </Button>
          <Button type="button" onClick={() => void run()} disabled={!!busy || !links.length || tooMany}>
            {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
            {busy
              ? `Getting reels… ${busy.done} of ${busy.total}`
              : links.length
                ? `Get ${links.length} ${links.length === 1 ? "reel" : "reels"}`
                : "Get reels"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
