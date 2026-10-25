"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Download, Eye, EyeOff, Grid3X3, List, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DayField } from "@/components/ui/day-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DiscreetPreview, StatePill, uploadStatusState } from "@/components/title-wall";
import { cn } from "@/lib/utils";
import { EmptyLine } from "./people-ui";

export interface VaultUpload {
  id: string;
  fileName: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  status: string;
  rating: number | null;
  uploadedAt: string | null;
  createdAt: string;
  request: { id: string; title: string };
  reviewedBy: { id: string; name: string } | null;
}

/** Upload review statuses, in the shared state vocabulary */
const STATUS: Record<string, true> = { PENDING: true, APPROVED: true, REJECTED: true };

const BLANK = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const kindOf = (t: string): "photo" | "video" | "text" => (t.startsWith("video/") ? "video" : t.startsWith("image/") ? "photo" : "text");

/**
 * A discreet preview whose signed thumbnail URL is only asked for when
 * someone shows intent (pointer down, focus, or the page toggle). Until then
 * nothing of the content is requested.
 */
function LazyPreview({ upload, revealed }: { upload: VaultUpload; revealed: boolean }) {
  const [src, setSrc] = React.useState<string | null>(null);
  const [own, setOwn] = React.useState(false);
  const asked = React.useRef(false);

  const ask = React.useCallback(async () => {
    if (asked.current) return;
    asked.current = true;
    try {
      const res = await fetch(`/api/uploads/${upload.id}/thumbnail`);
      const data = res.ok ? await res.json() : null;
      setSrc(data?.url ?? null);
    } catch {
      asked.current = false;
    }
  }, [upload.id]);

  React.useEffect(() => {
    if (revealed || own) void ask();
  }, [revealed, own, ask]);

  const kind = kindOf(upload.fileType);
  return (
    <div onPointerDown={() => void ask()} onFocusCapture={() => void ask()}>
      <DiscreetPreview
        src={src ?? BLANK}
        label={upload.originalName}
        kind={kind}
        caption={kind === "video" ? "Video" : kind === "photo" ? "Photo" : "File"}
        revealed={revealed || own}
        onRevealedChange={setOwn}
        aspect="1 / 1"
      />
    </div>
  );
}

export function CreatorUploads({
  creatorId,
  creatorName,
  initial,
}: {
  creatorId: string;
  creatorName: string;
  initial: VaultUpload[];
}) {
  const [uploads, setUploads] = React.useState(initial);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [view, setView] = React.useState<"grid" | "list">("grid");
  const [showAll, setShowAll] = React.useState(false);
  const [filters, setFilters] = React.useState({
    status: "all",
    contentType: "all",
    dateFrom: "",
    dateTo: "",
    sort: "uploadedAt",
    order: "desc",
  });
  const [open, setOpen] = React.useState<VaultUpload | null>(null);
  const [openUrl, setOpenUrl] = React.useState<string | null>(null);
  const [openLoading, setOpenLoading] = React.useState(false);
  const first = React.useRef(true);

  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const ctrl = new AbortController();
    (async () => {
      setLoading(true);
      setFailed(false);
      try {
        const params = new URLSearchParams();
        if (filters.status !== "all") params.set("status", filters.status);
        if (filters.contentType !== "all") params.set("contentType", filters.contentType);
        if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
        if (filters.dateTo) params.set("dateTo", filters.dateTo);
        params.set("sort", filters.sort);
        params.set("order", filters.order);
        const res = await fetch(`/api/creators/${creatorId}/uploads?${params}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setUploads(data.uploads ?? []);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setFailed(true);
      } finally {
        setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [creatorId, filters]);

  const exportAll = async () => {
    const id = toast.loading("Preparing the export");
    try {
      const res = await fetch(`/api/uploads/export?creatorId=${creatorId}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${creatorName.replace(/\s+/g, "-")}-content-${format(new Date(), "yyyy-MM-dd")}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded", { id });
    } catch {
      toast.error("The export could not be made. Try again.", { id });
    }
  };

  const openUpload = async (u: VaultUpload) => {
    setOpen(u);
    setOpenUrl(null);
    if (!u.fileType.startsWith("image/") && !u.fileType.startsWith("video/")) return;
    setOpenLoading(true);
    try {
      const res = await fetch(`/api/uploads/${u.id}/url`);
      const data = res.ok ? await res.json() : null;
      setOpenUrl(data?.url ?? null);
    } finally {
      setOpenLoading(false);
    }
  };

  const filtered = filters.status !== "all" || filters.contentType !== "all" || filters.dateFrom || filters.dateTo;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}>
          <SelectTrigger className="w-[150px]" aria-label="Review state">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any state</SelectItem>
            <SelectItem value="PENDING">To review</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Changes asked</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.contentType} onValueChange={(v) => setFilters((f) => ({ ...f, contentType: v }))}>
          <SelectTrigger className="w-[140px]" aria-label="File type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any type</SelectItem>
            <SelectItem value="image">Photos</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
            <SelectItem value="audio">Audio</SelectItem>
            <SelectItem value="document">Documents</SelectItem>
          </SelectContent>
        </Select>
        <div role="group" aria-label="Uploaded between" className="flex items-center gap-2">
          <DayField
            label="Uploaded from"
            placeholder="From"
            value={filters.dateFrom}
            max={filters.dateTo || undefined}
            onChange={(v) => setFilters((f) => ({ ...f, dateFrom: v }))}
            className="w-[150px]"
          />
          <span className="text-sm text-ink-2">to</span>
          <DayField
            label="Uploaded until"
            placeholder="Until"
            value={filters.dateTo}
            min={filters.dateFrom || undefined}
            onChange={(v) => setFilters((f) => ({ ...f, dateTo: v }))}
            className="w-[150px]"
          />
        </div>
        <Select
          value={`${filters.sort}-${filters.order}`}
          onValueChange={(v) => {
            const [sort, order] = v.split("-");
            setFilters((f) => ({ ...f, sort, order }));
          }}
        >
          <SelectTrigger className="w-[160px]" aria-label="Sort uploads">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="uploadedAt-desc">Newest first</SelectItem>
            <SelectItem value="uploadedAt-asc">Oldest first</SelectItem>
            <SelectItem value="status-asc">By state</SelectItem>
            <SelectItem value="rating-desc">Highest rated</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <Button variant="outline" size="sm" aria-pressed={showAll} onClick={() => setShowAll((s) => !s)}>
            {showAll ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            {showAll ? "Hide previews" : "Show previews"}
          </Button>
          <Button variant="outline" size="sm" onClick={exportAll}>
            <Download aria-hidden="true" />
            Export list
          </Button>
          <div role="group" aria-label="Layout" className="inline-flex rounded-[8px] bg-well p-0.5">
            {(["grid", "list"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                aria-label={v === "grid" ? "Grid" : "List"}
                onClick={() => setView(v)}
                className={cn(
                  "grid size-9 place-items-center rounded-[7px] text-icon hover:text-ink focus-visible:outline-2 focus-visible:outline-ring md:size-8",
                  view === v && "bg-tile-hi text-ink"
                )}
              >
                {v === "grid" ? <Grid3X3 className="size-4" aria-hidden="true" /> : <List className="size-4" aria-hidden="true" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-[10px] bg-tile-hi motion-safe:animate-pulse" />
          ))}
        </div>
      ) : failed ? (
        <EmptyLine>
          The uploads could not be loaded.{" "}
          <button type="button" className="font-medium text-ink underline underline-offset-[3px]" onClick={() => setFilters((f) => ({ ...f }))}>
            Try again
          </button>
        </EmptyLine>
      ) : uploads.length === 0 ? (
        <EmptyLine>
          {filtered
            ? "No upload matches these filters. Set any filter back to Any to widen the list."
            : `${creatorName} has not uploaded anything yet. Uploads appear here as soon as they arrive.`}
        </EmptyLine>
      ) : view === "grid" ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {uploads.map((u) => (
            <li key={u.id} className="min-w-0">
              <LazyPreview upload={u} revealed={showAll} />
              <div className="mt-2 flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => openUpload(u)}
                  className="min-w-0 truncate text-left text-sm font-medium text-ink underline-offset-[3px] hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {u.originalName}
                </button>
                {STATUS[u.status] && <StatePill state={uploadStatusState(u.status)} />}
              </div>
              <p className="text-[13px] text-ink-2">
                {formatFileSize(u.fileSize)}
                {u.rating ? ` · rated ${u.rating} of 5` : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="divide-y divide-line rounded-[10px] bg-tile">
          {uploads.map((u) => (
            <li key={u.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => openUpload(u)}
                  className="block max-w-full truncate text-left text-sm font-medium text-ink hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {u.originalName}
                </button>
                <p className="truncate text-[13px] text-ink-2">
                  {u.request.title} · {formatFileSize(u.fileSize)}
                  {u.uploadedAt ? ` · ${format(new Date(u.uploadedAt), "d MMM yyyy")}` : ""}
                </p>
              </div>
              {STATUS[u.status] && <StatePill state={uploadStatusState(u.status)} />}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">{open?.originalName}</DialogTitle>
          </DialogHeader>
          {open && (
            <div className="space-y-4">
              <div className="flex aspect-video items-center justify-center overflow-hidden rounded-[10px] bg-well">
                {openLoading ? (
                  <Loader2 className="size-6 animate-spin text-icon" aria-label="Loading" />
                ) : openUrl && open.fileType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URL
                  <img src={openUrl} alt={open.originalName} className="max-h-full max-w-full object-contain" />
                ) : openUrl && open.fileType.startsWith("video/") ? (
                  <video src={openUrl} controls className="max-h-full max-w-full" />
                ) : (
                  <p className="text-sm text-ink-2">No preview for this file type. Open the request to download it.</p>
                )}
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-ink-2">State</dt>
                  <dd className="mt-0.5">{STATUS[open.status] ? <StatePill state={uploadStatusState(open.status)} /> : open.status}</dd>
                </div>
                <div>
                  <dt className="text-ink-2">Size</dt>
                  <dd className="mt-0.5 font-medium">{formatFileSize(open.fileSize)}</dd>
                </div>
                <div>
                  <dt className="text-ink-2">Request</dt>
                  <dd className="mt-0.5">
                    <Link href={`/dashboard/requests/${open.request.id}`} className="font-medium underline underline-offset-[3px]">
                      {open.request.title}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-2">Uploaded</dt>
                  <dd className="mt-0.5 font-medium">
                    {open.uploadedAt ? format(new Date(open.uploadedAt), "d MMM yyyy, HH:mm") : "Not recorded"}
                  </dd>
                </div>
                {open.reviewedBy && (
                  <div>
                    <dt className="text-ink-2">Reviewed by</dt>
                    <dd className="mt-0.5 font-medium">{open.reviewedBy.name}</dd>
                  </div>
                )}
                {open.rating ? (
                  <div>
                    <dt className="text-ink-2">Rating</dt>
                    <dd className="mt-0.5 flex items-center gap-0.5" aria-label={`${open.rating} of 5`}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          aria-hidden="true"
                          className={cn("size-4", i < open.rating! ? "fill-ink text-ink" : "text-ctl-hi")}
                        />
                      ))}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
