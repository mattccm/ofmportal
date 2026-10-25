"use client";

import * as React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Announcements,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, ChevronDown, GripVertical, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichContentEditor } from "@/components/templates/field-editor";
import { cn } from "@/lib/utils";
import type { TemplateField } from "@/lib/template-types";

export interface ComposeField {
  id: string;
  label: string;
  value: string;
  type: string;
  required: boolean;
  helpText?: string;
  richContent?: TemplateField["richContent"];
  acceptedFileTypes?: string[];
  maxFileSize?: number;
  maxFiles?: number;
  minFiles?: number;
}

export const FIELD_TYPES: { value: string; label: string }[] = [
  { value: "file", label: "Upload" },
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Choice" },
  { value: "checkbox", label: "Tick box" },
];

const typeLabel = (t: string) => FIELD_TYPES.find((x) => x.value === t)?.label ?? "Short text";

interface FieldListProps {
  fields: ComposeField[];
  onChange: (fields: ComposeField[]) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
  /** Ids of fields whose label is missing after a send attempt */
  invalidIds?: Set<string>;
  announce: (msg: string) => void;
}

export function FieldList({ fields, onChange, onRemove, disabled, invalidIds, announce }: FieldListProps) {
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const name = (id: string | number) => {
    const i = fields.findIndex((f) => f.id === id);
    return fields[i]?.label?.trim() || `Field ${i + 1}`;
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${name(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${name(active.id)} is over position ${fields.findIndex((f) => f.id === over.id) + 1} of ${fields.length}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `${name(active.id)} dropped at position ${fields.findIndex((f) => f.id === over.id) + 1} of ${fields.length}.` : `${name(active.id)} dropped.`,
    onDragCancel: ({ active }) => `Moving ${name(active.id)} cancelled.`,
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= fields.length) return;
    const next = [...fields];
    const [f] = next.splice(from, 1);
    next.splice(to, 0, f);
    onChange(next);
    announce(`${f.label || "Field"} moved to position ${to + 1} of ${fields.length}`);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = fields.findIndex((f) => f.id === active.id);
    const to = fields.findIndex((f) => f.id === over.id);
    const next = [...fields];
    const [f] = next.splice(from, 1);
    next.splice(to, 0, f);
    onChange(next);
  };

  const update = (id: string, patch: Partial<ComposeField>) =>
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "To move a field, press Space or Enter, use the arrow keys, then press Space or Enter again to drop it. Esc cancels.",
        },
      }}
    >
      <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
        <ol className="flex flex-col gap-1.5" aria-label="Fields, in the order the creator sees them">
          {fields.map((f, i) => (
            <FieldRow
              key={f.id}
              field={f}
              index={i}
              count={fields.length}
              open={!!open[f.id]}
              onToggle={() => setOpen((o) => ({ ...o, [f.id]: !o[f.id] }))}
              onUpdate={(patch) => update(f.id, patch)}
              onMove={(dir) => move(i, i + dir)}
              onRemove={() => onRemove(i)}
              disabled={disabled}
              invalid={invalidIds?.has(f.id)}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function FieldRow({
  field,
  index,
  count,
  open,
  onToggle,
  onUpdate,
  onMove,
  onRemove,
  disabled,
  invalid,
}: {
  field: ComposeField;
  index: number;
  count: number;
  open: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<ComposeField>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });
  const nm = field.label.trim() || `field ${index + 1}`;
  const panelId = `fp-${field.id}`;
  const iconBtn =
    "inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--tw-r-ctl)] text-icon transition-colors hover:bg-tile-hi hover:text-ink focus-visible:outline-2 focus-visible:outline-acc disabled:pointer-events-none disabled:text-ctl";

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-field-id={field.id}
      className={cn(
        "rounded-[var(--tw-r-tile)] bg-tile transition-colors",
        isDragging && "relative z-10 bg-tile-hi shadow-lg shadow-black/40",
        invalid && "outline outline-1 outline-late"
      )}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1.5 py-1.5 pl-1 pr-1.5 sm:grid-cols-[auto_minmax(0,1fr)_150px_auto]">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className={cn(iconBtn, "cursor-grab touch-none active:cursor-grabbing")}
          aria-label={`Drag to reorder ${nm}`}
          disabled={disabled}
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </button>
        <div className="col-span-2 flex min-w-0 items-center gap-2 sm:col-span-1">
          <label className="sr-only" htmlFor={`fl-${field.id}`}>
            Field name
          </label>
          <Input
            id={`fl-${field.id}`}
            data-field-name
            value={field.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder={`Field name, e.g. ${field.type === "file" ? "Cover photo" : "Caption ideas"}`}
            autoComplete="off"
            maxLength={80}
            aria-invalid={invalid || undefined}
            disabled={disabled}
            className="h-10 md:h-9"
          />
        </div>
        <div className="col-start-2 row-start-2 min-w-0 sm:col-start-3 sm:row-start-1">
          <Select value={field.type} onValueChange={(v) => onUpdate({ type: v })} disabled={disabled}>
            <SelectTrigger className="h-10 w-full md:h-9" aria-label={`Type of ${nm}`}>
              <SelectValue>{typeLabel(field.type)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-start-3 row-start-2 flex items-center sm:col-start-4 sm:row-start-1">
          <button type="button" className={iconBtn} onClick={() => onMove(-1)} disabled={disabled || index === 0} aria-label={`Move ${nm} up`}>
            <ArrowUp className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={iconBtn}
            onClick={() => onMove(1)}
            disabled={disabled || index === count - 1}
            aria-label={`Move ${nm} down`}
          >
            <ArrowDown className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={iconBtn}
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={`${open ? "Hide" : "Show"} options for ${nm}`}
          >
            <ChevronDown className={cn("size-4 transition-transform duration-200", open && "rotate-180")} aria-hidden="true" />
          </button>
          <button type="button" className={iconBtn} onClick={onRemove} disabled={disabled} aria-label={`Remove ${nm}`}>
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      {open && (
        <div id={panelId} className="flex flex-col gap-4 border-t border-line px-3 pb-4 pt-3 sm:pl-12">
          <div className="flex items-center justify-between gap-4">
            <label htmlFor={`fr-${field.id}`} className="text-sm">
              <span className="font-medium">Required</span>
              <span className="block text-[13px] text-ink-2">
                {field.required ? "The request can't be finished without it." : "The creator can skip it."}
              </span>
            </label>
            <Switch aria-label="Required"
              id={`fr-${field.id}`}
              checked={field.required}
              onCheckedChange={(v) => onUpdate({ required: !!v })}
              disabled={disabled}
            />
          </div>
          <div>
            <label htmlFor={`fh-${field.id}`} className="mb-2 block text-sm font-medium">
              Instructions for the creator <span className="font-normal text-ink-2">(optional)</span>
            </label>
            <AutoGrowTextarea
              id={`fh-${field.id}`}
              value={field.helpText || ""}
              onChange={(v) => onUpdate({ helpText: v })}
              placeholder="e.g. Natural light, no filters"
              disabled={disabled}
              minRows={2}
            />
          </div>
          {field.type !== "file" && (
            <div>
              <label htmlFor={`fv-${field.id}`} className="mb-2 block text-sm font-medium">
                Filled in for them <span className="font-normal text-ink-2">(optional)</span>
              </label>
              <Input
                id={`fv-${field.id}`}
                value={field.value}
                onChange={(e) => onUpdate({ value: e.target.value })}
                placeholder="A starting value the creator can change"
                disabled={disabled}
              />
            </div>
          )}
          {field.type === "file" && (
            <RichContentEditor
              richContent={field.richContent}
              onChange={(richContent) => onUpdate({ richContent })}
              title="Examples and references"
              description="Example photos, a video or links that show what you're after"
            />
          )}
        </div>
      )}
    </li>
  );
}

/** A textarea that grows with its text and never shows a resize grip. */
export function AutoGrowTextarea({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  minRows = 3,
  maxLength,
  invalid,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minRows?: number;
  maxLength?: number;
  invalid?: boolean;
  describedBy?: string;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <Textarea
      ref={ref}
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      rows={minRows}
      maxLength={maxLength}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className="min-h-0 resize-none overflow-hidden"
    />
  );
}
