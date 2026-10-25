"use client";

/**
 * Presentational parts of the request review player: the field selector
 * strip, the Up next bar, the preview stage and the Up next queue.
 * State lives in request-detail-client.tsx.
 */
import { useEffect, useRef, useState } from "react";
import { EyeOff, FileText, Film, Image as ImageIcon, Music, Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DiscreetPreview,
  FieldCell,
  FIELD_STATE_LABEL,
  FIELD_STATE_SHORT,
  StateIcon,
  uploadStatusState,
  upNextCountdown,
  useReducedMotion,
  type FieldState,
  type FieldSummary,
} from "@/components/title-wall";
import { VideoPlayer } from "@/components/preview";
import { cn } from "@/lib/utils";

// ------------------------------------------------------------------ helpers

export interface StageUpload {
  id: string;
  originalName: string;
  fileType: string;
  fileSize: string | number | bigint;
  status: string;
  uploadStatus: string;
  uploadedAt: Date | string | null;
  createdAt: Date | string;
  metadata?: unknown;
}

export function kindOf(fileType: string): "photo" | "video" | "audio" | "file" {
  if (fileType.startsWith("image/")) return "photo";
  if (fileType.startsWith("video/")) return "video";
  if (fileType.startsWith("audio/")) return "audio";
  return "file";
}

export const KIND_LABEL = { photo: "Photo", video: "Video", audio: "Audio", file: "File" } as const;

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / 1024 ** i;
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

export function formatDuration(sec: number): string {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "Video · 0:24 · 1080×1920 · 112 MB" */
export function uploadFacts(u: StageUpload): string {
  const meta = (u.metadata && typeof u.metadata === "object" ? u.metadata : {}) as Record<string, unknown>;
  const parts: string[] = [KIND_LABEL[kindOf(u.fileType)]];
  if (typeof meta.duration === "number" && meta.duration > 0) parts.push(formatDuration(meta.duration));
  if (typeof meta.width === "number" && typeof meta.height === "number") parts.push(`${meta.width}×${meta.height}`);
  parts.push(formatBytes(Number(u.fileSize)));
  return parts.join(" · ");
}

export const UPLOAD_STATUS_LABEL: Record<string, string> = {
  PENDING: "Ready to review",
  APPROVED: "Approved",
  REJECTED: "Needs changes",
};

// ------------------------------------------------------------------ field selector

/**
 * The field strip as the player's field selector: one segment per field,
 * its state as the bar, its name under it. The current field carries the
 * focus outline.
 */
export function FieldSelector({
  fields,
  currentId,
  onSelect,
}: {
  fields: FieldSummary[];
  currentId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav aria-label="Fields">
      <ol
        className="grid list-none gap-1.5 overflow-x-auto p-0 pb-1"
        // Each field is a segment of at most 240px, so a one- or two-field
        // request draws short labelled segments rather than one full-width
        // bar that reads as a progress bar
        style={{ gridTemplateColumns: `repeat(${fields.length}, minmax(96px, 240px))` }}
      >
        {fields.map((f) => {
          const current = f.id === currentId;
          return (
            <li key={f.id} className="min-w-0">
              <button
                type="button"
                onClick={() => onSelect(f.id as string)}
                aria-current={current ? "step" : undefined}
                aria-label={`${f.name}: ${FIELD_STATE_LABEL[f.state]}`}
                className="group flex w-full min-w-0 flex-col gap-1.5 rounded-[4px] pt-1 text-left focus-visible:outline-none"
              >
                <span
                  className={cn(
                    "block rounded-[3px] outline-offset-2 transition-[outline-color] duration-150",
                    current ? "outline outline-2 outline-acc" : "group-hover:outline group-hover:outline-1 group-hover:outline-ctl-hi group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-acc"
                  )}
                >
                  <FieldCell state={f.state} className="tw-cell-bar !block !h-2.5 !w-full !rounded-[2px]" />
                </span>
                <span className={cn("truncate text-[13px] leading-normal text-ink", current && "font-semibold")}>
                  {f.name}
                </span>
                <span className="-mt-1 flex min-w-0 items-center gap-1 text-[12px] leading-normal text-ink-2" aria-hidden="true">
                  <StateIcon state={f.state} className="size-3" />
                  <span className="truncate">{FIELD_STATE_SHORT[f.state]}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ------------------------------------------------------------------ up next

/**
 * After an approval: "Up next: Short videos" with a draining bar. Runs out →
 * onGo. Cancel stays on the current field. Under reduced motion there is no
 * countdown, only a Next field button.
 */
export function UpNextBar({ nextName, onGo, onCancel }: { nextName: string; onGo: () => void; onCancel: () => void }) {
  const bar = useRef<HTMLSpanElement>(null);
  const go = useRef(onGo);
  const reduced = useReducedMotion();
  useEffect(() => {
    go.current = onGo;
  }, [onGo]);
  useEffect(() => {
    if (reduced || !bar.current) return;
    const cancel = upNextCountdown(bar.current, 4, () => go.current());
    return () => cancel?.();
  }, [reduced]);

  return (
    <div role="status" className="relative overflow-hidden rounded-[8px] bg-tile-hi px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="min-w-0 flex-1 text-[15px] text-ink">
          Up next: <b className="font-semibold">{nextName}</b>
          {!reduced && <span className="text-ink-2"> in a moment</span>}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onGo}>
            {reduced ? "Next field" : "Go now"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Stay here
            <kbd className="ml-1 rounded-[3px] border border-ctl px-1 font-mono text-[12px] text-ink-2">Esc</kbd>
          </Button>
        </div>
      </div>
      {!reduced && (
        <span className="absolute inset-x-0 bottom-0 h-[3px] bg-line" aria-hidden="true">
          <span ref={bar} className="block h-full origin-left bg-ink" />
        </span>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ stage

const STAGE_ASPECT = "16 / 9";
/** Keeps Approve inside the first screen on a laptop */
const STAGE_MAX = "max-h-[40vh] min-h-[220px]";

/**
 * The preview stage for one upload. Hidden until revealed (peek by holding,
 * click, or the page's Show previews). A video plays in the existing player
 * only after reveal; the signed media URL is fetched at that moment.
 */
export function Stage({
  upload,
  label,
  thumbUrl,
  revealed,
  onRevealedChange,
  onOpenFrameNotes,
}: {
  upload: StageUpload;
  label: string;
  /** Signed thumbnail/poster URL (JSON fetched, image not loaded until reveal) */
  thumbUrl: string | null | undefined;
  revealed: boolean;
  onRevealedChange: (v: boolean) => void;
  onOpenFrameNotes?: (src: string) => void;
}) {
  const kind = kindOf(upload.fileType);
  const [videoSrc, setVideoSrc] = useState<{ id: string; url: string | null } | null>(null);

  useEffect(() => {
    if (kind !== "video" || !revealed) return;
    if (videoSrc?.id === upload.id) return;
    let live = true;
    fetch(`/api/uploads/${upload.id}/url`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setVideoSrc({ id: upload.id, url: d?.url ?? null }))
      .catch(() => live && setVideoSrc({ id: upload.id, url: null }));
    return () => {
      live = false;
    };
  }, [kind, revealed, upload.id, videoSrc?.id]);

  if (kind === "audio" || kind === "file") {
    const Icon = kind === "audio" ? Music : FileText;
    return (
      <div
        className={cn("flex w-full flex-col items-center justify-center gap-2 rounded-[10px] bg-well text-ink-2", STAGE_MAX)}
        style={{ aspectRatio: STAGE_ASPECT }}
      >
        <Icon className="size-6 text-icon" aria-hidden="true" />
        <p className="text-[14px]">{KIND_LABEL[kind]} file. Download it to review.</p>
      </div>
    );
  }

  if (kind === "video" && revealed) {
    const src = videoSrc?.id === upload.id ? videoSrc.url : undefined;
    return (
      <div className="space-y-2">
        <div className={cn("w-full overflow-hidden rounded-[10px] bg-well", STAGE_MAX)} style={{ aspectRatio: STAGE_ASPECT }}>
          {src === undefined ? (
            <div className="flex h-full items-center justify-center text-[14px] text-ink-2">Loading the video…</div>
          ) : src === null ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-[14px] text-ink-2">
              The video link didn&apos;t load. Hide and show the preview to try again, or download the file.
            </div>
          ) : (
            <VideoPlayer src={src} poster={thumbUrl ?? undefined} className="h-full w-full" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => onRevealedChange(false)}>
            <EyeOff className="size-4" />
            Hide video
          </Button>
          {src && onOpenFrameNotes && (
            <Button size="sm" variant="ghost" onClick={() => onOpenFrameNotes(src)}>
              <Clapperboard className="size-4" />
              Frame notes
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <DiscreetPreview
      // A transparent pixel keeps the plate a reveal button when a video has no poster yet
      src={thumbUrl ?? (kind === "video" ? TRANSPARENT : thumbUrl === undefined ? TRANSPARENT : null)}
      label={label}
      kind={kind}
      caption={uploadFacts(upload).split(" · ").slice(0, 2).join(" · ")}
      revealed={revealed}
      onRevealedChange={onRevealedChange}
      aspect={STAGE_ASPECT}
      className={cn("w-full rounded-[10px] [&_.tw-preview-img]:object-contain [&_.tw-preview-eye]:size-7", STAGE_MAX)}
    />
  );
}

const TRANSPARENT = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

// ------------------------------------------------------------------ upload picker

/** The uploads in the current field as a row of numbered chips (no imagery). */
export function UploadPicker({
  uploads,
  currentId,
  onSelect,
}: {
  uploads: StageUpload[];
  currentId: string | null;
  onSelect: (id: string) => void;
}) {
  if (uploads.length < 2) return null;
  return (
    <div role="group" aria-label="Files in this field" className="flex flex-wrap gap-1.5">
      {uploads.map((u, i) => {
        const kind = kindOf(u.fileType);
        const Icon = kind === "video" ? Film : kind === "photo" ? ImageIcon : FileText;
        const current = u.id === currentId;
        return (
          <button
            key={u.id}
            type="button"
            aria-pressed={current}
            onClick={() => onSelect(u.id)}
            title={`${KIND_LABEL[kind]} ${i + 1}: ${UPLOAD_STATUS_LABEL[u.status] ?? u.status}`}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-[8px] border px-2.5 text-[13px] tabular-nums transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acc",
              current ? "border-ink bg-tile-hi text-ink" : "border-ctl text-ink-2 hover:border-ctl-hi hover:text-ink"
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {i + 1}
            <StateIcon state={uploadStatusState(u.status)} className="size-3" />
          </button>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ queue

/**
 * The queue keeps its three standing groups even when one is empty, so a
 * one-field request still reads as "what is ready, what is still to come,
 * what is done". Needs changes shows only when something went back.
 */
const QUEUE_ORDER: { state: FieldState[]; title: string; always: boolean; empty: string; finishedEmpty?: string }[] = [
  { state: ["ready"], title: "Ready to review", always: true, empty: "Nothing waiting for you.", finishedEmpty: "Nothing was left to review." },
  { state: ["changes"], title: "Needs changes", always: false, empty: "" },
  { state: ["waiting", "overdue"], title: "To do", always: true, empty: "Every field has an upload." },
  { state: ["approved"], title: "Approved", always: true, empty: "Nothing approved yet." },
];

export function UpNextQueue({
  fields,
  currentId,
  metaFor,
  onSelect,
  finished = false,
}: {
  fields: FieldSummary[];
  currentId: string;
  metaFor: (id: string) => string;
  onSelect: (id: string) => void;
  finished?: boolean;
}) {
  return (
    <div className="space-y-3">
      {QUEUE_ORDER.map((g) => {
        const items = fields.filter((f) => g.state.includes(f.state));
        if (items.length === 0 && !g.always) return null;
        return (
          <section key={g.title} aria-label={g.title}>
            <h3 className={cn("text-[14px] font-semibold text-ink", items.length > 0 && "mb-1.5")}>
              {g.title} <span className="font-normal text-ink-2">{items.length}</span>
              {items.length === 0 && (
                <span className="ml-2 text-[13px] font-normal text-ink-2">{(finished && g.finishedEmpty) || g.empty}</span>
              )}
            </h3>
            {items.length === 0 ? null : (
            <ul className="space-y-1">
              {items.map((f) => {
                const current = f.id === currentId;
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(f.id as string)}
                      aria-current={current ? "true" : undefined}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-[8px] px-3 py-2.5 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acc",
                        current ? "bg-tile-hi" : "hover:bg-tile-hi"
                      )}
                    >
                      <FieldCell state={f.state} className="mt-[5px] shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-[14px] text-ink", current && "font-semibold")}>{f.name}</span>
                        <span className="block truncate text-[13px] text-ink-2">{metaFor(f.id as string)}</span>
                      </span>
                      {current && <span className="mt-0.5 shrink-0 text-[12px] text-ink-2">On screen</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
