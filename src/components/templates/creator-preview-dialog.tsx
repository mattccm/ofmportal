"use client";

import * as React from "react";
import { ExternalLink, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Segmented } from "@/components/messaging/plan-editor";
import type { RichContent, TemplateField } from "@/lib/template-types";
import { cn } from "@/lib/utils";

const DEVICES = {
  phone: { label: "Phone", w: 390, h: 844, note: "An iPhone-sized screen, where most creators upload" },
  tablet: { label: "Tablet", w: 820, h: 1180, note: "An iPad-sized screen" },
  laptop: { label: "Laptop", w: 1280, h: 800, note: "A laptop browser" },
  desktop: { label: "Desktop", w: 1440, h: 900, note: "A desktop browser" },
} as const;
type Device = keyof typeof DEVICES;

export interface PreviewDraft {
  name: string;
  description: string | null;
  richContent: RichContent | null;
  fields: TemplateField[];
  defaultDueDays: number;
}

/**
 * "Preview as creator": the real creator request page, in a phone, tablet or
 * desktop sized frame. Fully interactive and sandboxed: the framed page
 * (src/app/preview/...) uploads and sends nothing. With `message`, an unsaved
 * draft (a template being edited, a request being written) is posted in when
 * the frame is ready, so the preview matches what's on screen.
 */
export function CreatorPreviewDialog({
  open,
  onOpenChange,
  src,
  message,
  savedHref,
  savedLabel = "Open saved version",
  description = "The request as a creator gets it. Try everything: nothing is uploaded or sent.",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The framed preview page */
  src: string;
  /** Posted to the frame as { type, payload } when it says `${type}:ready` */
  message?: { type: string; payload: unknown };
  /** Opens the preview on its own, in a new tab */
  savedHref?: string;
  savedLabel?: string;
  description?: string;
}) {
  const [device, setDevice] = React.useState<Device>("phone");
  const frameRef = React.useRef<HTMLIFrameElement>(null);
  const [stage, setStage] = React.useState<HTMLDivElement | null>(null);
  const [box, setBox] = React.useState({ w: 0, h: 0 });
  const d = DEVICES[device];
  const bezel = device === "phone" ? 12 : device === "tablet" ? 14 : 0;

  // Keep the latest draft for when the frame asks for it
  const messageRef = React.useRef(message);
  React.useEffect(() => {
    messageRef.current = message;
  }, [message]);
  const [reload, setReload] = React.useState(0);
  const post = React.useCallback(() => {
    const m = messageRef.current;
    if (m) frameRef.current?.contentWindow?.postMessage({ type: m.type, payload: m.payload }, window.location.origin);
  }, []);
  // Start over: post the draft again, or load a saved request afresh
  const startOver = () => (messageRef.current ? post() : setReload((n) => n + 1));

  React.useEffect(() => {
    if (!open) return;
    const onMessage = (e: MessageEvent) => {
      const m = messageRef.current;
      if (m && e.origin === window.location.origin && e.data?.type === `${m.type}:ready` && e.source === frameRef.current?.contentWindow) post();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [open, post]);

  React.useEffect(() => {
    if (!stage) return;
    const ro = new ResizeObserver(([entry]) => setBox({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(stage);
    return () => ro.disconnect();
  }, [stage]);

  const outerW = d.w + bezel * 2;
  const outerH = d.h + bezel * 2;
  const scale = box.w && box.h ? Math.min(1, (box.w - 32) / outerW, (box.h - 56) / outerH) : 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className="inset-0 left-0 top-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-ground p-0 sm:max-w-none"
      >
        <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-[17px] font-semibold leading-snug text-ink">Preview as creator</DialogTitle>
            <DialogDescription className="text-[13px] text-ink-2">{description}</DialogDescription>
          </div>
          <Segmented
            label="Screen size"
            value={device}
            options={(Object.keys(DEVICES) as Device[]).map((k) => ({ id: k, label: DEVICES[k].label }))}
            onChange={setDevice}
          />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={startOver}>
              <RotateCcw aria-hidden="true" />
              Start over
            </Button>
            {savedHref && (
              <Button variant="ghost" size="sm" asChild>
                <a href={savedHref} target="_blank" rel="noopener">
                  <ExternalLink aria-hidden="true" />
                  <span className="hidden md:inline">{savedLabel}</span>
                </a>
              </Button>
            )}
            <Button variant="ghost" size="icon" aria-label="Close the preview" onClick={() => onOpenChange(false)}>
              <X aria-hidden="true" />
            </Button>
          </div>
        </header>

        <div ref={setStage} className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden bg-well">
          <div style={{ width: outerW * scale, height: outerH * scale }} className="relative">
            <div
              style={{ width: outerW, height: outerH, transform: `scale(${scale})`, transformOrigin: "top left", padding: bezel }}
              className={cn(
                "absolute left-0 top-0",
                device === "phone" && "rounded-[48px] bg-tile-hi",
                device === "tablet" && "rounded-[28px] bg-tile-hi",
                (device === "laptop" || device === "desktop") && "overflow-hidden rounded-[10px] ring-1 ring-line"
              )}
            >
              <iframe
                key={reload}
                ref={frameRef}
                title="The request as a creator sees it"
                src={src}
                style={{ width: d.w, height: d.h }}
                className={cn("block border-0 bg-ground", device === "phone" ? "rounded-[38px]" : device === "tablet" ? "rounded-[16px]" : "")}
              />
            </div>
          </div>
          <p className="mt-3 text-[13px] tabular-nums text-ink-2">
            {d.note} · {d.w} × {d.h}
            {scale < 1 ? ` · shown at ${Math.round(scale * 100)}%` : ""}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
