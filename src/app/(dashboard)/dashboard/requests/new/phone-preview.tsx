"use client";

import * as React from "react";
import {
  ChevronLeft,
  Film,
  ImagePlus,
  Inbox,
  MapPinOff,
  MessageSquare,
  PenLine,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
import { formatDay, timeLeft } from "@/components/title-wall";
import { arrive } from "@/components/title-wall";
import { dayFromIso } from "@/components/requests/deadline-picker";
import type { ComposeField } from "./field-list";
import type { ComposeCreator } from "./data";

/* ------------------------------------------------------------------------ */
/* The lock-screen lines. These mirror src/lib/sms.ts and src/lib/email.ts   */
/* exactly, and like them never carry the request title.                    */
/* ------------------------------------------------------------------------ */

export function smsBody(creatorName: string, host: string) {
  // sendContentRequestSms + withSmsBrandPrefix ("CCM: ")
  return `${BRAND.name}: Hi ${creatorName}, you have a new content request. View it here: ${host || "your portal"}/portal/…`;
}
export const EMAIL_SUBJECT = "You have a new content request";

const firstName = (n: string) => n.split(" ")[0] || n;

function channelsFor(c: ComposeCreator | null) {
  // The request route always emails; it texts too when the creator has a
  // phone number and prefers SMS or both.
  const sms = !!c && c.hasPhone && (c.preferredContact === "SMS" || c.preferredContact === "BOTH");
  return { email: true, sms };
}

export function NotificationLines({
  creator,
  emailFrom,
  portalHost,
  notify,
  title,
  dueDate,
}: {
  creator: ComposeCreator | null;
  emailFrom: string;
  portalHost: string;
  notify: boolean;
  title: string;
  dueDate: string;
}) {
  if (!notify) {
    return (
      <p className="rounded-xl bg-tile px-3 py-2.5 text-[13px] text-ink-2">
        Nothing goes to their phone: notifications are off for this request.
      </p>
    );
  }
  const ch = channelsFor(creator);
  const name = creator?.name ?? "there";
  return (
    <div className="flex flex-col gap-1.5" aria-live="polite">
      {ch.sms && (
        <NoteLine icon={<MessageSquare className="size-4" />} app="Messages" body={smsBody(name, portalHost)} />
      )}
      <NoteLine icon={<Inbox className="size-4" />} app={`Mail · ${emailFrom}`} body={EMAIL_SUBJECT} />
      <p className="px-1 text-[13px] text-ink-2">
        Lock screens show only these lines. Opened, the email names the request:{" "}
        <span className="text-ink">
          {title.trim() || "Untitled request"}, due{" "}
          {dueDate
            ? dayFromIso(dueDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
            : "No specific due date"}
        </span>
        .
      </p>
    </div>
  );
}

function NoteLine({ icon, app, body }: { icon: React.ReactNode; app: string; body: string }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-2.5 rounded-xl bg-tile px-3 py-2.5 text-[13px] leading-normal">
      <span className="mt-0.5 text-icon" aria-hidden="true">
        {icon}
      </span>
      <b className="truncate font-semibold">{app}</b>
      <span className="text-ink-2">now</span>
      <p className="col-span-2 col-start-2 [overflow-wrap:anywhere]">{body}</p>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* The request on the creator's phone, in the creator world.                */
/* ------------------------------------------------------------------------ */

function uploadVerb(f: ComposeField): [React.ReactNode, string] {
  const kinds = f.acceptedFileTypes ?? [];
  const img = kinds.some((k) => k.startsWith("image"));
  const vid = kinds.some((k) => k.startsWith("video"));
  const hint = `${f.label} ${f.helpText ?? ""}`;
  if ((vid && !img) || (!kinds.length && /video|clip|reel/i.test(hint))) return [<Film key="v" className="size-3.5" />, "Add video"];
  if ((img && !vid) || (!kinds.length && /photo|still|picture|headshot|selfie/i.test(hint))) return [<ImagePlus key="p" className="size-3.5" />, "Add photos"];
  return [<Upload key="u" className="size-3.5" />, "Upload"];
}

function plain(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function PhonePreview({
  creator,
  title,
  dueDate,
  note,
  fields,
  agencyName,
  examples,
  lastAddedId,
}: {
  creator: ComposeCreator | null;
  title: string;
  dueDate: string;
  note: string;
  fields: ComposeField[];
  agencyName: string;
  examples: number;
  lastAddedId?: string | null;
}) {
  const scrRef = React.useRef<HTMLDivElement>(null);
  const shown = fields.filter((f) => f.label.trim() || f.helpText?.trim());
  const files = shown.filter((f) => f.type === "file");
  const details = shown.filter((f) => f.type !== "file");
  // The creator's own time left: their end of the due day
  const left = dueDate ? timeLeft(dueDate, new Date(), creator?.timezone ?? undefined) : null;
  const initials = creator
    ? creator.name
        .split(/\s+/)
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";
  const noteText = plain(note);

  React.useEffect(() => {
    if (!lastAddedId) return;
    const el = scrRef.current?.querySelector(`[data-pid="${lastAddedId}"]`);
    if (el) arrive(el);
  }, [lastAddedId]);

  return (
    <div className="w-full max-w-[372px] rounded-[34px] bg-tile p-2.5">
      <div
        ref={scrRef}
        tabIndex={0}
        aria-label={`The request as ${creator ? firstName(creator.name) : "the creator"} will see it`}
        className="h-[560px] overflow-y-auto rounded-[26px] bg-ground px-3.5 pb-5 [scrollbar-width:none] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-acc max-sm:h-[520px] [&::-webkit-scrollbar]:hidden"
      >
        <div className="sticky top-0 z-[1] flex h-12 items-center gap-2 bg-ground text-[13px] font-medium text-ink-2">
          <ChevronLeft className="size-3.5" aria-hidden="true" />
          Requests
          <span className="flex-1" />
          <span className="flex size-7 items-center justify-center rounded-[7px] text-[12px] font-extrabold text-ink shadow-[inset_0_0_0_1.5px_var(--tw-ink)]" aria-hidden="true">
            {BRAND.name}
          </span>
          <span className="flex size-7 items-center justify-center rounded-full bg-tile-hi text-[12px] font-semibold text-ink" aria-hidden="true">
            {initials}
          </span>
        </div>

        <p
          className={cn(
            "mt-1.5 text-[22px] font-bold leading-tight tracking-[-0.01em] [overflow-wrap:anywhere]",
            !title.trim() && "font-semibold text-ink-2"
          )}
        >
          {title.trim() || "Untitled request"}
        </p>
        <p className="mt-1.5 text-sm font-semibold">
          {left && dueDate ? (
            <>
              <span className={cn(left.urgent && "text-late")}>{left.text}</span>{" "}
              <span className="font-normal text-ink-2">· due {formatDay(dueDate)}</span>
            </>
          ) : (
            <span className="font-normal text-ink-2">No due date</span>
          )}
        </p>

        {shown.length > 0 && (
          <div className="mt-2.5 flex flex-col gap-1.5 text-[13px] text-ink-2">
            <span>
              0 of {shown.length} {shown.length === 1 ? "field" : "fields"} sent
            </span>
            <ol className="tw-lstrip" aria-hidden="true">
              {shown.map((f) => (
                <li key={f.id}>
                  <i className="tw-cell !h-1.5" data-state="waiting">
                    <span className="tw-cell-fill" />
                  </i>
                </li>
              ))}
            </ol>
          </div>
        )}

        {(noteText || examples > 0) && (
          <div className="mt-3 rounded-xl bg-tile px-3 py-2.5 text-[13px]">
            <b className="block font-semibold">From {agencyName}</b>
            {noteText && <p className="line-clamp-[8] whitespace-pre-line">{noteText}</p>}
            {examples > 0 && (
              <p className="mt-1 text-ink-2">
                {examples} {examples === 1 ? "example" : "examples"} to look at
              </p>
            )}
          </div>
        )}

        {files.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {files.map((f) => {
              const [ic, verb] = uploadVerb(f);
              return (
                <li key={f.id} data-pid={f.id} className="rounded-xl bg-tile p-3">
                  <b className="block text-sm font-semibold [overflow-wrap:anywhere]">
                    {f.label.trim() || "Untitled field"}
                    {!f.required && <span className="font-normal text-ink-2"> · optional</span>}
                  </b>
                  {f.helpText?.trim() && (
                    <small className="block text-xs text-ink-2 [overflow-wrap:anywhere]">{f.helpText}</small>
                  )}
                  <span className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg bg-raised px-3 text-[13px] font-semibold">
                    {ic}
                    {verb}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {details.length > 0 && (
          <ul className="mt-2 flex flex-col gap-2">
            {details.map((f) => (
              <li key={f.id} data-pid={f.id} className="rounded-xl bg-tile p-3">
                <b className="block text-sm font-semibold [overflow-wrap:anywhere]">
                  {f.label.trim() || "Untitled field"}
                  {!f.required && <span className="font-normal text-ink-2"> · optional</span>}
                </b>
                {f.helpText?.trim() && <small className="block text-xs text-ink-2">{f.helpText}</small>}
                <span className="mt-2 flex h-8 items-center rounded-lg bg-well px-3 text-[13px] text-ink-2 shadow-[inset_0_0_0_1px_var(--tw-ctl)]">
                  <PenLine className="mr-1.5 size-3.5" aria-hidden="true" />
                  {f.value || "Their answer"}
                </span>
              </li>
            ))}
          </ul>
        )}

        {shown.length === 0 ? (
          <p className="mt-3 text-[13px] text-ink-2">No fields yet. Add one and it appears here.</p>
        ) : (
          files.length > 0 && (
            <p className="mt-2.5 flex gap-2 text-xs text-ink-2">
              <MapPinOff className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>Location is removed from photos automatically. For videos, turn location off in your camera.</span>
            </p>
          )
        )}
      </div>
    </div>
  );
}
