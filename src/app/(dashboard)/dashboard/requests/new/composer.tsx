"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Layers, Loader2, Plus, Repeat, Search, Send, Star, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAutosave } from "@/hooks/use-autosave";
import { AutosaveIndicator } from "@/components/forms/autosave-indicator";
import { RecoveryDialog } from "@/components/forms/recovery-dialog";
import { clearFormData } from "@/lib/form-storage";
import { cn } from "@/lib/utils";
import { expandQuantityFields, type TemplateField } from "@/lib/template-types";
import { flipLayout, usePressFeedback } from "@/components/title-wall";
import { TemplateCover } from "@/components/templates/template-cover";
import { fieldSpec } from "@/components/templates/template-spec";
import { DueDateField, addDaysIso } from "@/components/requests/deadline-picker";
import { ReminderSchedulePreview } from "@/components/requests/reminder-schedule-preview";
import { FieldExamplesDisplay } from "@/components/portal/field-examples-display";
import { FieldList, AutoGrowTextarea, type ComposeField } from "./field-list";
import { NotificationLines, PhonePreview } from "./phone-preview";
import type { ComposeData, ComposeTemplate } from "./data";

/* ------------------------------------------------------------------------ */

type Urgency = "LOW" | "NORMAL" | "HIGH" | "URGENT";
type Mode = "creators" | "group";
const BLANK = "__blank";
const FORM_ID = "new-request-form";
const RECENT_KEY = "uploadportal_recent_templates";
const FAV_KEY = "uploadportal_favorite_templates";

const URGENCY: { value: Urgency; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

interface Draft extends Record<string, unknown> {
  mode: Mode;
  creatorIds: string[];
  groupId: string;
  templateId: string;
  title: string;
  description: string;
  noteTouched: boolean;
  dueDate: string;
  urgency: Urgency;
  sendNotification: boolean;
  customFields: ComposeField[];
}

function readList(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function writeList(key: string, v: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* private mode: favourites simply don't persist */
  }
}

function list(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
const plural = (n: number, w: string) => `${n} ${n === 1 ? w : `${w}s`}`;

function htmlToPlain(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
function plainToHtml(text: string) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function templateDescription(t: ComposeTemplate) {
  let d = t.description || "";
  const rc = t.richContent?.description?.trim();
  if (rc && htmlToPlain(rc) !== htmlToPlain(d)) d = d ? `${d}\n\n${rc}` : rc;
  return d;
}

function fieldsFrom(t: ComposeTemplate): ComposeField[] {
  return expandQuantityFields(t.fields as TemplateField[]).map((f) => ({
    id: f.id,
    label: f.label,
    value: f.defaultValue !== undefined ? String(f.defaultValue) : "",
    type: f.type,
    required: f.required,
    helpText: f.helpText,
    richContent: f.richContent,
    acceptedFileTypes: f.acceptedFileTypes,
    maxFileSize: f.maxFileSize,
    maxFiles: f.maxFiles,
    minFiles: f.minFiles,
  }));
}

/* ------------------------------------------------------------------------ */

export function Composer({ data, agencyName }: { data: ComposeData; agencyName: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const qCreator = sp.get("creatorId");
  const qGroup = sp.get("groupId");
  const qTemplate = sp.get("templateId");

  const { creators, groups, templates } = data;
  const byId = React.useMemo(() => new Map(creators.map((c) => [c.id, c])), [creators]);

  // ---------- state ----------
  const [templateId, setTemplateId] = React.useState<string>("");
  const [mode, setMode] = React.useState<Mode>(qGroup ? "group" : "creators");
  const [creatorIds, setCreatorIds] = React.useState<string[]>(qCreator && byId.has(qCreator) ? [qCreator] : []);
  const [groupId, setGroupId] = React.useState<string>(qGroup ?? "");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [note, setNote] = React.useState("");
  const [noteTouched, setNoteTouched] = React.useState(false);
  const [dueDate, setDueDate] = React.useState(addDaysIso(7));
  const [urgency, setUrgency] = React.useState<Urgency>("NORMAL");
  const [sendNotification, setSendNotification] = React.useState(true);
  const [fields, setFields] = React.useState<ComposeField[]>([]);
  const [previewFor, setPreviewFor] = React.useState<string | null>(qCreator ?? null);
  const [view, setView] = React.useState<"form" | "preview">("form");
  const [sending, setSending] = React.useState<false | "send" | "draft">(false);
  const [tried, setTried] = React.useState(false);
  const [creatorQuery, setCreatorQuery] = React.useState("");
  const [tplQuery, setTplQuery] = React.useState("");
  const [favs, setFavs] = React.useState<string[]>([]);
  const [recent, setRecent] = React.useState<string[]>([]);
  const [recovery, setRecovery] = React.useState(false);
  const [lastAdded, setLastAdded] = React.useState<string | null>(null);
  const [live, setLive] = React.useState("");

  const wallRef = React.useRef<HTMLUListElement>(null);
  const pageRef = React.useRef<HTMLDivElement>(null);
  usePressFeedback(pageRef);

  React.useEffect(() => {
    setFavs(readList(FAV_KEY));
    setRecent(readList(RECENT_KEY));
  }, []);

  // in the folded row, bring the picked cover into view
  React.useEffect(() => {
    const wall = wallRef.current;
    const li = wall?.querySelector<HTMLElement>(`[data-tpl="${templateId}"]`);
    if (!wall || !li || wall.scrollWidth <= wall.clientWidth + 2) return;
    wall.scrollTo({ left: li.offsetLeft - wall.offsetLeft, behavior: "auto" });
  }, [templateId]);

  const template = templates.find((t) => t.id === templateId) ?? null;
  const picked = !!templateId;

  // ---------- who ----------
  const group = groups.find((g) => g.id === groupId) ?? null;
  const recipients = React.useMemo(() => {
    const ids = mode === "group" ? group?.memberIds ?? [] : creatorIds;
    return ids.map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => !!c);
  }, [mode, group, creatorIds, byId]);
  const previewCreator =
    recipients.find((c) => c.id === previewFor) ?? recipients[0] ?? null;

  // ---------- autosave & recovery ----------
  const draft: Draft = React.useMemo(
    () => ({
      mode,
      creatorIds,
      groupId,
      templateId,
      title,
      description: noteTouched ? plainToHtml(note) : description,
      noteTouched,
      dueDate,
      urgency,
      sendNotification,
      customFields: fields,
    }),
    [mode, creatorIds, groupId, templateId, title, note, noteTouched, description, dueDate, urgency, sendNotification, fields]
  );
  const autosave = useAutosave<Draft>({
    formId: FORM_ID,
    data: draft,
    debounceMs: 1500,
    enabled: picked,
    onConflict: () => setRecovery(true),
  });

  const restore = () => {
    const r = autosave.recover() as (Partial<Draft> & { creatorId?: string; selectionMode?: string }) | null;
    if (!r) return;
    // drafts from the old three-step form used creatorId / selectionMode
    const ids = r.creatorIds ?? (r.creatorId ? [r.creatorId] : []);
    setMode(r.mode ?? (r.selectionMode === "group" ? "group" : "creators"));
    setCreatorIds(ids.filter((id) => byId.has(id)));
    setGroupId(r.groupId ?? "");
    setTemplateId(r.templateId || BLANK);
    setTitle(r.title ?? "");
    setDescription(r.description ?? "");
    setNote(htmlToPlain(r.description ?? ""));
    setNoteTouched(false);
    setDueDate(r.dueDate ?? "");
    setUrgency((r.urgency as Urgency) ?? "NORMAL");
    setSendNotification(r.sendNotification ?? true);
    setFields(Array.isArray(r.customFields) ? r.customFields : []);
    toast.success("Your draft is back");
  };

  // ---------- picking a template ----------
  const fieldsEdited = React.useRef(false);
  const applyTemplate = React.useCallback(
    (id: string, opts: { quiet?: boolean } = {}) => {
      const t = templates.find((x) => x.id === id) ?? null;
      const prev = { templateId, fields, title, note, description, noteTouched, dueDate, urgency };
      const titleWasDefault =
        !title.trim() || title === (templates.find((x) => x.id === templateId)?.name ?? "");
      const wasEdited = fieldsEdited.current;

      const mutate = () => {
        setTemplateId(id);
        if (t) {
          setFields(fieldsFrom(t));
          if (titleWasDefault) setTitle(t.name);
          const d = templateDescription(t);
          if (!noteTouched || !note.trim()) {
            setDescription(d);
            setNote(htmlToPlain(d));
            setNoteTouched(false);
          }
          setDueDate(addDaysIso(t.defaultDueDays));
          setUrgency(t.defaultUrgency);
          const r = [t.id, ...readList(RECENT_KEY).filter((x) => x !== t.id)].slice(0, 5);
          writeList(RECENT_KEY, r);
        } else {
          if (titleWasDefault) setTitle("");
          if (!fields.length || !wasEdited) setFields([]);
        }
        fieldsEdited.current = false;
      };

      // A quiet (linked-in) pick runs inside an effect, where flushSync can't
      // flush and nobody is watching the wall move: just apply it
      const first = !templateId;
      if (first && !opts.quiet && wallRef.current) {
        flipLayout(wallRef.current.querySelectorAll("[data-tpl]"), () => flushSync(mutate), { duration: 0.45 });
      } else {
        mutate();
      }

      if (!opts.quiet) {
        setLive(t ? `${t.name} picked. ${plural(fieldsFrom(t).length, "field")} filled in.` : "Blank request. Add the fields you need.");
        if (wasEdited && prev.templateId && prev.templateId !== id) {
          toast(`Fields replaced with ${t ? `${t.name}’s` : "a blank list"}`, {
            action: {
              label: "Undo",
              onClick: () => {
                setTemplateId(prev.templateId);
                setFields(prev.fields);
                setTitle(prev.title);
                setNote(prev.note);
                setDescription(prev.description);
                setNoteTouched(prev.noteTouched);
                setDueDate(prev.dueDate);
                setUrgency(prev.urgency);
                fieldsEdited.current = true;
                toast("Your fields are back");
              },
            },
          });
        }
      }
    },
    [templates, templateId, fields, title, note, description, noteTouched, dueDate, urgency]
  );

  // ?templateId= link in
  const linked = React.useRef(false);
  React.useEffect(() => {
    if (linked.current) return;
    linked.current = true;
    if (qTemplate && templates.some((t) => t.id === qTemplate)) applyTemplate(qTemplate, { quiet: true });
  }, [qTemplate, templates, applyTemplate]);

  const setFieldsEdited = (next: ComposeField[]) => {
    fieldsEdited.current = true;
    setFields(next);
  };

  const addField = () => {
    const f: ComposeField = { id: `field-${Date.now()}`, label: "", value: "", type: "file", required: true };
    setFieldsEdited([...fields, f]);
    setLastAdded(f.id);
    requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>(`[data-field-id="${f.id}"] [data-field-name]`)?.focus();
    });
  };

  const removeField = (i: number) => {
    const f = fields[i];
    const next = fields.filter((_, j) => j !== i);
    setFieldsEdited(next);
    requestAnimationFrame(() => {
      const target = next[Math.min(i, next.length - 1)];
      const el = target
        ? document.querySelector<HTMLInputElement>(`[data-field-id="${target.id}"] [data-field-name]`)
        : document.getElementById("add-field");
      el?.focus();
    });
    toast(`${f.label.trim() || "Field"} removed`, {
      action: {
        label: "Undo",
        onClick: () => {
          setFields((cur) => {
            const c = [...cur];
            c.splice(i, 0, f);
            return c;
          });
          toast(`${f.label.trim() || "Field"} is back`);
        },
      },
    });
  };

  // ---------- favourites ----------
  const toggleFav = (id: string) => {
    const next = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id];
    setFavs(next);
    writeList(FAV_KEY, next);
  };

  const sortedTemplates = React.useMemo(() => {
    const q = tplQuery.trim().toLowerCase();
    const rank = (t: ComposeTemplate) =>
      (favs.includes(t.id) ? 1e6 : 0) + (recent.includes(t.id) ? 1e3 * (5 - recent.indexOf(t.id)) : 0) + t.usageCount;
    return templates
      .filter((t) => !q || t.name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q))
      .sort((a, b) => rank(b) - rank(a));
  }, [templates, favs, recent, tplQuery]);

  // ---------- validation ----------
  const today = addDaysIso(0);
  const problems: { target: string; msg: string }[] = [];
  if (!recipients.length)
    problems.push({ target: "who", msg: mode === "group" ? (group ? "That group has no creators in it yet. Add some on the Groups page, or pick creators." : "Pick a group, or switch to creators.") : "Pick at least one creator." });
  if (!title.trim()) problems.push({ target: "title", msg: "Give the request a title. Only the creator sees it, inside the portal." });
  const unnamed = fields.filter((f) => !f.label.trim());
  if (unnamed.length) problems.push({ target: "fields", msg: `${plural(unnamed.length, "field")} still ${unnamed.length === 1 ? "needs" : "need"} a name.` });
  if (dueDate && dueDate < today) problems.push({ target: "due", msg: "The due date has passed. Pick today or later." });
  const showProblems = tried && problems.length > 0;
  const invalidIds = new Set(tried ? unnamed.map((f) => f.id) : []);

  const focusProblem = (target: string) => {
    const el =
      target === "who"
        ? document.querySelector<HTMLElement>("#who button, #who [role=combobox], #who input")
        : target === "title"
          ? document.getElementById("req-title")
          : target === "fields"
            ? document.querySelector<HTMLElement>("[aria-invalid=true][data-field-name]")
            : document.querySelector<HTMLElement>("#due button");
    el?.focus();
  };

  // ---------- submit ----------
  const submit = async (asDraft: boolean) => {
    setTried(true);
    if (problems.length) {
      setView("form");
      requestAnimationFrame(() => focusProblem(problems[0].target));
      return;
    }
    setSending(asDraft ? "draft" : "send");
    const richContent = template?.richContent
      ? {
          exampleText: template.richContent.exampleText,
          exampleImages: template.richContent.exampleImages,
          exampleVideoUrl: template.richContent.exampleVideoUrl,
          referenceLinks: template.richContent.referenceLinks,
        }
      : undefined;
    const body = (creatorId: string) => ({
      creatorId,
      templateId: template?.id,
      title: title.trim(),
      description: noteTouched ? plainToHtml(note) : description,
      dueDate: dueDate || undefined,
      urgency,
      requirements: { quantity: "", format: "", resolution: "", notes: "" },
      fields: fields.map((f) => ({ ...f, label: f.label.trim() })),
      richContent,
      saveAsDraft: asDraft,
      sendNotification: asDraft ? false : sendNotification,
    });
    try {
      const results = await Promise.all(
        recipients.map((c) =>
          fetch("/api/requests", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body(c.id)),
          })
            .then((r) => r.json())
            .catch(() => ({ error: true }))
        )
      );
      const ok = results.filter((r) => r && r.id);
      const failed = results.length - ok.length;
      if (!ok.length) {
        toast.error("Nothing was sent. Check your connection and try again; your draft is kept.");
        setSending(false);
        return;
      }
      clearFormData(FORM_ID);
      const who = recipients.length === 1 ? recipients[0].name : plural(ok.length, "creator");
      if (failed) toast.warning(`Sent to ${plural(ok.length, "creator")}. ${failed} didn't go through; try those again from Requests.`);
      else toast.success(asDraft ? `Saved as a draft for ${who}` : `Request sent to ${who}`);
      router.push(ok.length === 1 ? `/dashboard/requests/${ok[0].id}` : "/dashboard/requests");
    } catch {
      toast.error("Couldn't create the request. Give it another try.");
      setSending(false);
    }
  };

  // ---------- copy ----------
  const top = Math.max(0, ...templates.map((t) => t.usageCount));
  const leaders = templates.filter((t) => t.usageCount === top && top > 0).map((t) => t.name);
  const lede = templates.length
    ? `${plural(data.totalRequests, "request")} sent so far from ${plural(templates.length, "template")}.${
        leaders.length ? ` ${list(leaders.slice(0, 3))} ${leaders.length === 1 ? "leads" : "lead"} with ${top}${leaders.length > 1 ? " each" : ""}.` : ""
      }`
    : "No templates yet. Start a blank request, or build a template you can reuse.";

  const sendLabel = !recipients.length
    ? mode === "group" && group
      ? "Group is empty"
      : "Pick a creator"
    : recipients.length === 1
      ? `Send to ${recipients[0].name}`
      : `Send to ${recipients.length} creators`;

  const whoHint = !recipients.length
    ? mode === "group"
      ? "Each creator in the group gets their own copy."
      : "Pick one creator or several; each gets their own copy."
    : recipients.length === 1
      ? recipients[0].preferredContact === null
        ? `${recipients[0].name} gets their own copy.`
        : `${recipients[0].name} hears about it by ${recipients[0].hasPhone && recipients[0].preferredContact !== "EMAIL" ? "text and email" : "email"}.`
      : `${list(recipients.slice(0, 4).map((c) => c.name))}${recipients.length > 4 ? ` and ${recipients.length - 4} more` : ""} each get their own copy.`;

  const filteredCreators = creators.filter(
    (c) => !creatorQuery.trim() || c.name.toLowerCase().includes(creatorQuery.toLowerCase()) || (c.email ?? "").toLowerCase().includes(creatorQuery.toLowerCase())
  );

  const examples =
    (template?.richContent?.exampleImages?.length ?? 0) +
    (template?.richContent?.exampleVideoUrl ? 1 : 0) +
    (template?.richContent?.referenceLinks?.length ?? 0);

  const segBtn = (on: boolean) =>
    cn(
      "inline-flex h-10 items-center justify-center gap-2 rounded-[6px] px-3.5 text-sm font-medium transition-colors duration-150 md:h-8",
      "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-acc",
      on ? "!bg-tile-hi text-ink" : "text-ink-2 hover:text-ink"
    );

  /* ====================================================================== */

  return (
    <div ref={pageRef} className="pb-10">
      <RecoveryDialog
        open={recovery}
        onOpenChange={setRecovery}
        data={autosave.recoverableData}
        onRestore={restore}
        onDiscard={() => {
          autosave.dismissRecovery();
          toast("Old draft cleared");
        }}
        formName="request"
        fieldLabels={{ title: "Title", dueDate: "Due date", urgency: "Priority", templateId: "Template", mode: "Sent to" }}
        excludeFields={["sendNotification", "noteTouched", "creatorIds", "customFields", "description", "groupId"]}
      />

      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight tracking-[-0.01em] sm:text-[26px]">New request</h1>
          <p className="mt-1 max-w-[70ch] text-[15px] text-ink">{lede}</p>
        </div>
        <nav aria-label="Other ways to send" className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/requests/batch">
              <Users className="size-4" aria-hidden="true" />
              Different titles per creator
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/bundles">
              <Layers className="size-4" aria-hidden="true" />
              Send a bundle
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/recurring-requests">
              <Repeat className="size-4" aria-hidden="true" />
              Make it recurring
            </Link>
          </Button>
        </nav>
      </header>

      {/* ---------------- templates ---------------- */}
      <section aria-labelledby="tpl-h" className="mt-7">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h2 id="tpl-h" className="text-[17px] font-semibold">
            {picked ? "Template" : "Start from a template"}
            <span className="ml-3 text-sm font-normal text-ink-2">
              {picked
                ? template
                  ? `${template.name}. Pick another to swap the fields.`
                  : "Blank. Pick a template to fill the fields in."
                : `${plural(templates.length, "template")} to start from`}
            </span>
          </h2>
          {templates.length > 6 && (
            <label className="relative w-full sm:w-64">
              <span className="sr-only">Find a template</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-icon" aria-hidden="true" />
              <Input value={tplQuery} onChange={(e) => setTplQuery(e.target.value)} placeholder="Find a template" className="pl-9" />
            </label>
          )}
        </div>
        <ul
          ref={wallRef}
          className={cn(
            "mt-3 list-none",
            picked
              ? "flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              : "grid grid-cols-1 gap-[var(--tw-gap)] sm:grid-cols-2 xl:grid-cols-3"
          )}
        >
          {sortedTemplates.map((t) => {
            const fl = expandQuantityFields(t.fields as TemplateField[]);
            const on = templateId === t.id;
            return (
              <li key={t.id} data-tpl={t.id} className={cn(picked && "w-[196px] shrink-0 snap-start sm:w-[220px]")}>
                <TemplateCover
                  name={t.name}
                  usageCount={t.usageCount}
                  lastUsedAt={t.lastUsedAt}
                  description={t.description}
                  fields={fl.map((f) => ({ label: f.label, spec: fieldSpec(f) }))}
                  compact={picked}
                  pressed={on}
                  dim={picked && !on}
                  onPress={() => applyTemplate(t.id)}
                  ariaLabel={`${t.name}: ${fl.length ? plural(fl.length, "field") : "no fields yet"}`}
                  foot={picked ? (on ? "Picked" : plural(fl.length, "field")) : undefined}
                  actions={
                    picked ? undefined : (
                      <button
                        type="button"
                        onClick={() => toggleFav(t.id)}
                        aria-pressed={favs.includes(t.id)}
                        aria-label={favs.includes(t.id) ? `Unpin ${t.name}` : `Pin ${t.name} to the front`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-[var(--tw-r-ctl)] px-2 text-[13px] text-ink-2 aria-pressed:!bg-transparent hover:!bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-acc"
                      >
                        <Star className={cn("size-3.5", favs.includes(t.id) && "fill-current text-ink")} aria-hidden="true" />
                        {favs.includes(t.id) ? "Pinned" : "Pin"}
                      </button>
                    )
                  }
                />
              </li>
            );
          })}
          <li key={BLANK} data-tpl={BLANK} className={cn(picked && "w-[196px] shrink-0 snap-start sm:w-[220px]")}>
            <TemplateCover
              name="Blank request"
              usageCount={0}
              foot={picked ? (templateId === BLANK ? "Picked" : "No fields") : "Write the fields yourself"}
              description={picked ? undefined : "For a one-off. You add each field, and can save it as a template later."}
              compact={picked}
              pressed={templateId === BLANK}
              dim={picked && templateId !== BLANK}
              onPress={() => applyTemplate(BLANK)}
              aside={null}
            />
          </li>
        </ul>
        {tplQuery && sortedTemplates.length === 0 && (
          <p className="mt-3 text-sm text-ink-2">No template matches “{tplQuery}”. Clear the search, or start blank.</p>
        )}
      </section>

      {!picked ? (
        <p className="mt-6 text-sm text-ink-2">
          Pick a template above to start. Its fields, due date and priority fill in, and you can change any of them.
        </p>
      ) : (
        <>
          {/* phone and tablet: one region at a time */}
          <div role="group" aria-label="Show" className="mt-6 inline-flex rounded-[var(--tw-r-ctl)] bg-well p-1 min-[1100px]:hidden">
            <button type="button" aria-pressed={view === "form"} className={segBtn(view === "form")} onClick={() => setView("form")}>
              Compose
            </button>
            <button type="button" aria-pressed={view === "preview"} className={segBtn(view === "preview")} onClick={() => setView("preview")}>
              Preview on their phone
            </button>
          </div>

          <div className="mt-5 grid items-start gap-8 min-[1100px]:mt-7 min-[1100px]:grid-cols-[minmax(0,1fr)_372px]">
            {/* ---------------- the form ---------------- */}
            <form
              aria-labelledby="cmp-h"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void submit(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.target instanceof HTMLInputElement) e.preventDefault();
              }}
              className={cn("min-w-0", view === "preview" && "max-[1099px]:hidden")}
            >
              <h2 id="cmp-h" className="text-[22px] font-semibold leading-snug tracking-[-0.01em]">
                {template ? template.name : "Blank request"}
                <span className="ml-3 text-sm font-normal tracking-normal text-ink-2">
                  {template ? `${plural(fields.length, "field")} filled in from the template` : "Add the fields you need"}
                </span>
              </h2>

              {/* who */}
              <fieldset className="mt-6 min-w-0" aria-describedby="who-hint">
                <legend className="mb-2 text-sm font-medium">Send to</legend>
                {groups.length > 0 && (
                  <div role="group" aria-label="Pick by" className="mb-3 inline-flex rounded-[var(--tw-r-ctl)] bg-well p-1">
                    <button type="button" aria-pressed={mode === "creators"} className={segBtn(mode === "creators")} onClick={() => setMode("creators")}>
                      Creators
                    </button>
                    <button type="button" aria-pressed={mode === "group"} className={segBtn(mode === "group")} onClick={() => setMode("group")}>
                      A group
                    </button>
                  </div>
                )}
                <div id="who">
                  {mode === "creators" ? (
                    creators.length === 0 ? (
                      <p className="text-sm text-ink-2">
                        No creators yet.{" "}
                        <Link className="text-ink underline" href="/dashboard/creators/invite">
                          Invite one
                        </Link>{" "}
                        and they show up here.
                      </p>
                    ) : (
                      <>
                        {creators.length > 8 && (
                          <label className="relative mb-2 block max-w-xs">
                            <span className="sr-only">Find a creator</span>
                            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-icon" aria-hidden="true" />
                            <Input value={creatorQuery} onChange={(e) => setCreatorQuery(e.target.value)} placeholder="Find a creator" className="pl-9" />
                          </label>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {filteredCreators.map((c) => {
                            const on = creatorIds.includes(c.id);
                            const initials = c.name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
                            return (
                              <button
                                key={c.id}
                                type="button"
                                aria-pressed={on}
                                data-press=""
                                onClick={() => {
                                  const next = on ? creatorIds.filter((x) => x !== c.id) : [...creatorIds, c.id];
                                  setCreatorIds(next);
                                  if (on && previewFor === c.id) setPreviewFor(next[0] ?? null);
                                  if (!on && !next.slice(0, -1).length) setPreviewFor(c.id);
                                }}
                                className={cn(
                                  "inline-flex h-11 items-center gap-2.5 rounded-full py-0 pl-1.5 pr-4 text-sm font-medium transition-colors duration-150",
                                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acc",
                                  on ? "!bg-tile-hi shadow-[inset_0_0_0_1px_var(--tw-ink)]" : "bg-tile hover:bg-tile-hi"
                                )}
                              >
                                <span
                                  aria-hidden="true"
                                  className={cn(
                                    "flex size-8 items-center justify-center rounded-full text-xs font-semibold",
                                    on ? "bg-ink text-ground" : "bg-raised text-ink"
                                  )}
                                >
                                  {initials}
                                </span>
                                {c.name}
                                {c.preferredContact !== null && (
                                  <small className="hidden text-[13px] font-normal text-ink-2 sm:inline">
                                    {c.hasPhone && c.preferredContact !== "EMAIL" ? "Text and email" : "Email"}
                                  </small>
                                )}
                              </button>
                            );
                          })}
                          {filteredCreators.length === 0 && (
                            <p className="text-sm text-ink-2">No creator matches “{creatorQuery}”.</p>
                          )}
                        </div>
                      </>
                    )
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {groups.map((g) => {
                        const on = groupId === g.id;
                        return (
                          <button
                            key={g.id}
                            type="button"
                            aria-pressed={on}
                            data-press=""
                            onClick={() => setGroupId(on ? "" : g.id)}
                            className={cn(
                              "inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors duration-150",
                              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acc",
                              on ? "!bg-tile-hi shadow-[inset_0_0_0_1px_var(--tw-ink)]" : "bg-tile hover:bg-tile-hi"
                            )}
                          >
                            {g.name}
                            <small className="text-[13px] font-normal text-ink-2">{plural(g.memberIds.length, "creator")}</small>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <p id="who-hint" className="mt-2 text-[13px] text-ink-2">
                  {whoHint}
                  {groups.length === 0 && (
                    <>
                      {" "}
                      <Link href="/dashboard/creators/groups" className="text-ink underline">
                        Make a group
                      </Link>{" "}
                      to send to the same creators often.
                    </>
                  )}
                </p>
              </fieldset>

              {/* title */}
              <div className="mt-6">
                <label htmlFor="req-title" className="mb-2 block text-sm font-medium">
                  Title
                </label>
                <Input
                  id="req-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoComplete="off"
                  maxLength={120}
                  placeholder="e.g. October set"
                  aria-invalid={(tried && !title.trim()) || undefined}
                  aria-describedby="title-hint"
                  disabled={!!sending}
                />
                <p id="title-hint" className="mt-2 text-[13px] text-ink-2">
                  Shown in the portal and inside the email. Never in a text or an email subject, so a locked phone shows nothing.
                </p>
              </div>

              {/* fields */}
              <fieldset className="mt-6 min-w-0">
                <legend className="mb-2 text-sm font-medium">
                  Fields <span className="font-normal text-ink-2">({fields.length}) · drag or use the arrows to reorder</span>
                </legend>
                {fields.length === 0 ? (
                  <p className="rounded-[var(--tw-r-tile)] bg-tile-dim px-4 py-3.5 text-sm text-ink-2">
                    No fields yet. Each field is one thing the creator sends: a cover photo, a teaser clip, caption ideas.
                  </p>
                ) : (
                  <FieldList
                    fields={fields}
                    onChange={setFieldsEdited}
                    onRemove={removeField}
                    disabled={!!sending}
                    invalidIds={invalidIds}
                    announce={setLive}
                  />
                )}
                <Button id="add-field" type="button" variant="outline" size="sm" className="mt-2" onClick={addField} disabled={!!sending}>
                  <Plus className="size-4" aria-hidden="true" />
                  Add a field
                </Button>
              </fieldset>

              {/* due + priority */}
              <div className="mt-6 flex flex-col gap-6">
                <fieldset className="min-w-0">
                  <legend className="mb-2 text-sm font-medium">Due</legend>
                  <DueDateField
                    id="due"
                    value={dueDate}
                    onChange={setDueDate}
                    invalid={tried && !!dueDate && dueDate < today}
                    disabled={!!sending}
                    quick={
                      template && ![3, 7, 14].includes(template.defaultDueDays) && template.defaultDueDays > 0
                        ? [
                            { days: template.defaultDueDays, label: `${template.defaultDueDays} days (template)` },
                            { days: 3, label: "3 days" },
                            { days: 7, label: "1 week" },
                            { days: 14, label: "2 weeks" },
                          ].sort((a, b) => a.days - b.days)
                        : undefined
                    }
                  />
                </fieldset>
                <fieldset className="min-w-0">
                  <legend className="mb-2 text-sm font-medium">Priority</legend>
                  <div role="group" aria-label="Priority" className="inline-flex rounded-[var(--tw-r-ctl)] bg-well p-1">
                    {URGENCY.map((u) => (
                      <button
                        key={u.value}
                        type="button"
                        aria-pressed={urgency === u.value}
                        className={segBtn(urgency === u.value)}
                        onClick={() => setUrgency(u.value)}
                        disabled={!!sending}
                      >
                        {u.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[13px] text-ink-2">Sets which reminder rule applies.</p>
                </fieldset>
              </div>

              {/* reminders */}
              {dueDate && dueDate >= today && previewCreator && (
                <div className="mt-4">
                  <ReminderSchedulePreview creatorId={previewCreator.id} urgency={urgency} dueDate={dueDate} />
                </div>
              )}

              {/* note */}
              <div className="mt-6">
                <label htmlFor="req-note" className="mb-2 block text-sm font-medium">
                  Note to the creator <span className="font-normal text-ink-2">(optional)</span>
                </label>
                <AutoGrowTextarea
                  id="req-note"
                  value={note}
                  onChange={(v) => {
                    setNote(v);
                    setNoteTouched(true);
                  }}
                  placeholder="Anything they should know: the theme, the outfit, what to avoid"
                  disabled={!!sending}
                  minRows={3}
                  maxLength={4000}
                  describedBy="note-hint"
                />
                <p id="note-hint" className="mt-2 text-[13px] text-ink-2">
                  Shown at the top of the request, under “From {agencyName}”.
                </p>
              </div>

              {template?.richContent && examples > 0 && (
                <div className="mt-6">
                  <FieldExamplesDisplay richContent={template.richContent} fieldLabel={template.name} variant="inline" />
                  <p className="mt-2 text-[13px] text-ink-2">
                    From the template. Change them in the{" "}
                    <Link href={`/dashboard/templates/${template.id}/edit`} className="text-ink underline">
                      template editor
                    </Link>
                    .
                  </p>
                </div>
              )}

              {/* notify */}
              <div className="mt-6 flex items-start justify-between gap-6 rounded-[var(--tw-r-tile)] bg-tile px-4 py-3.5">
                <label htmlFor="notify" className="text-sm">
                  <span id="notify-label" className="font-medium">Let {recipients.length > 1 ? "them" : recipients[0] ? recipients[0].name.split(" ")[0] : "them"} know now</span>
                  <span className="block text-[13px] text-ink-2">
                    {sendNotification
                      ? "An email, plus a text for creators who prefer texts. Neither carries the title."
                      : "Nothing is sent. They see it next time they open the portal."}
                  </span>
                </label>
                <Switch aria-labelledby="notify-label" id="notify" checked={sendNotification} onCheckedChange={(v) => setSendNotification(!!v)} disabled={!!sending} />
              </div>

              {showProblems && (
                <div role="alert" className="mt-5 rounded-[var(--tw-r-ctl)] bg-tile px-4 py-3">
                  <p className="text-sm font-medium">Before it can go:</p>
                  <ul className="mt-1 flex flex-col gap-0.5 text-sm">
                    {problems.map((p) => (
                      <li key={p.target}>
                        <button type="button" className="text-left text-late underline-offset-2 hover:underline" onClick={() => focusProblem(p.target)}>
                          {p.msg}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* send */}
              <div className="sticky bottom-0 z-10 -mx-1 mt-6 flex flex-wrap items-center gap-3 bg-ground px-1 pb-3 pt-3">
                <Button
                  type="submit"
                  disabled={!recipients.length || !!sending}
                  className="h-11 px-5 text-[15px] md:h-11 max-sm:w-full"
                  data-press=""
                >
                  {sending === "send" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
                  {sending === "send" ? "Sending" : sendLabel}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 md:h-11 max-sm:flex-1"
                  disabled={!recipients.length || !!sending}
                  onClick={() => void submit(true)}
                >
                  {sending === "draft" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                  Save as draft
                </Button>
                <AutosaveIndicator status={autosave.status} lastSavedText={autosave.lastSavedText} className="text-[13px]" />
              </div>
            </form>

            {/* ---------------- the creator's phone ---------------- */}
            <aside
              aria-labelledby="prev-h"
              className={cn(
                "flex flex-col gap-3 min-[1100px]:sticky min-[1100px]:top-5",
                view === "form" && "max-[1099px]:hidden",
                "max-[1099px]:items-center max-[1099px]:[&>*]:w-full max-[1099px]:[&>*]:max-w-[420px]"
              )}
            >
              <div className="flex min-h-8 items-center justify-between gap-2.5">
                <h2 id="prev-h" className="text-[17px] font-semibold">
                  On {previewCreator ? `${previewCreator.name.split(" ")[0]}’s` : "their"} phone
                </h2>
                {recipients.length > 1 && (
                  <div role="group" aria-label="Preview for" className="inline-flex max-w-[60%] overflow-x-auto rounded-[var(--tw-r-ctl)] bg-well p-1">
                    {recipients.slice(0, 6).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={previewCreator?.id === c.id}
                        className={cn(segBtn(previewCreator?.id === c.id), "h-8 shrink-0 px-2.5 text-[13px] md:h-7")}
                        onClick={() => setPreviewFor(c.id)}
                      >
                        {c.name.split(" ")[0]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <NotificationLines
                creator={previewCreator}
                emailFrom={data.emailFrom}
                portalHost={data.portalHost}
                notify={sendNotification}
                title={title}
                dueDate={dueDate && dueDate >= today ? dueDate : ""}
              />
              <PhonePreview
                creator={previewCreator}
                title={title}
                dueDate={dueDate && dueDate >= today ? dueDate : ""}
                note={noteTouched ? note : description}
                fields={fields}
                agencyName={agencyName}
                examples={examples}
                lastAddedId={lastAdded}
              />
              <p className="text-[13px] text-ink-2">
                {previewCreator
                  ? [
                      previewCreator.preferredContact === null
                        ? `${previewCreator.name} is told the way they prefer.`
                        : `${previewCreator.name} prefers ${
                            previewCreator.preferredContact === "BOTH" ? "texts and email" : previewCreator.preferredContact === "SMS" ? "texts" : "email"
                          }${previewCreator.preferredContact !== "EMAIL" && !previewCreator.hasPhone ? ", but has no phone number, so it goes by email" : ""}.`,
                      previewCreator.timezone ? `Their time zone is ${previewCreator.timezone.replace(/_/g, " ")}.` : "",
                    ]
                      .filter(Boolean)
                      .join(" ")
                  : "Pick a creator to see their name and how they are reached."}
              </p>
            </aside>
          </div>
        </>
      )}
      <p className="sr-only" aria-live="polite">
        {live}
      </p>
    </div>
  );
}
