"use client";

import * as React from "react";
import Link from "next/link";
import { Copy, FolderInput, MoreHorizontal, Pencil, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { TemplateCover, type TemplateCoverField } from "./template-cover";

interface TemplateCategory {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

interface TemplateCardProps {
  id: string;
  name: string;
  description?: string | null;
  category?: TemplateCategory | null;
  fieldCount: number;
  fields?: TemplateCoverField[];
  usageCount: number;
  lastUsedAt?: string | Date | null;
  isActive: boolean;
  updatedAt: Date;
  onDuplicate?: () => Promise<void>;
  onDelete?: () => Promise<void>;
  /** Groups the template can move to; shows "Move to group" when given with onMove */
  groups?: { id: string; name: string }[];
  /** Move to a group (null for Ungrouped) */
  onMove?: (groupId: string | null) => void;
  /** False hides Edit and makes the card open nothing (templates.edit) */
  canEdit?: boolean;
  /** False hides Send (requests.create) */
  canSend?: boolean;
  /** Show the group's name after the title (off on a group's own shelf) */
  showGroup?: boolean;
}

function plain(html: string | null | undefined): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * A template on the shelf: a typeset title card (TemplateCover) with its
 * usage after the title, and Send / Edit / more actions at its foot.
 */
export function TemplateCard({
  id,
  name,
  description,
  category,
  fieldCount,
  fields,
  usageCount,
  lastUsedAt,
  isActive,
  onDuplicate,
  onDelete,
  groups,
  onMove,
  canEdit = true,
  canSend = true,
  showGroup = false,
}: TemplateCardProps) {
  const [confirm, setConfirm] = React.useState(false);
  const [busy, setBusy] = React.useState<false | "copy" | "delete">(false);

  const duplicate = async () => {
    if (!onDuplicate) return;
    setBusy("copy");
    try {
      await onDuplicate();
      toast.success(`Copy of ${name} made`);
    } catch {
      toast.error("Couldn't copy the template. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!onDelete) return;
    setBusy("delete");
    try {
      await onDelete();
      toast.success(`${name} deleted`);
      setConfirm(false);
    } catch {
      toast.error("Couldn't delete the template. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const hasMenu = canEdit || !!onDuplicate || !!onDelete || (!!onMove && !!groups?.length);
  const aside = [showGroup ? category?.name : null, !isActive ? "Switched off" : null].filter(Boolean).join(" · ");

  return (
    <>
      <TemplateCover
        name={name}
        usageCount={usageCount}
        lastUsedAt={lastUsedAt}
        description={plain(description)}
        fields={fields}
        foot={fieldCount ? `${fieldCount} ${fieldCount === 1 ? "field" : "fields"}` : "No fields yet"}
        href={canEdit ? `/dashboard/templates/${id}/edit` : undefined}
        ariaLabel={canEdit ? `Edit ${name}` : undefined}
        muted={!isActive}
        aside={aside ? <span> · {aside}</span> : null}
        actions={
          <>
            {isActive && canSend && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/dashboard/requests/new?templateId=${id}`}>
                  <Send className="size-4" aria-hidden="true" />
                  Send
                </Link>
              </Button>
            )}
            {hasMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" aria-label={`More for ${name}`} disabled={!!busy}>
                  <MoreHorizontal className="size-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {canEdit && (
                  <DropdownMenuItem asChild>
                    <Link href={`/dashboard/templates/${id}/edit`}>
                      <Pencil className="size-4" aria-hidden="true" />
                      Edit
                    </Link>
                  </DropdownMenuItem>
                )}
                {onMove && groups && groups.length > 0 && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <FolderInput className="size-4" aria-hidden="true" />
                      Move to group
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuRadioGroup
                        value={category?.id ?? "__none"}
                        onValueChange={(v) => onMove(v === "__none" ? null : v)}
                      >
                        {groups.map((g) => (
                          <DropdownMenuRadioItem key={g.id} value={g.id}>
                            {g.name}
                          </DropdownMenuRadioItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioItem value="__none">Ungrouped</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
                {onDuplicate && (
                  <DropdownMenuItem onClick={duplicate}>
                    <Copy className="size-4" aria-hidden="true" />
                    Make a copy
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <>
                    {(canEdit || !!onDuplicate || (!!onMove && !!groups?.length)) && <DropdownMenuSeparator />}
                    <DropdownMenuItem className="text-late focus:text-late" onClick={() => setConfirm(true)}>
                      <Trash2 className="size-4" aria-hidden="true" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            )}
          </>
        }
      />
      <DeleteConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        itemName={name}
        itemType="template"
        description={
          usageCount
            ? `Requests already sent from ${name} keep their fields. You can't send new ones from it.`
            : undefined
        }
        loading={busy === "delete"}
        onConfirm={remove}
      />
    </>
  );
}

export function TemplateCardSkeleton() {
  return (
    <div className="flex min-h-[236px] flex-col gap-3 rounded-[var(--tw-r-tile)] bg-tile px-[18px] py-4">
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="mt-auto h-5 w-16" />
    </div>
  );
}

export function EmptyTemplates() {
  return (
    <div className="rounded-[var(--tw-r-tile)] bg-tile-dim px-6 py-10">
      <h3 className="text-[17px] font-semibold">No templates yet</h3>
      <p className="mt-1 max-w-[52ch] text-sm text-ink-2">
        A template is a request you send often: its fields, due date and priority. Build one and it
        fills in the new-request form for you.
      </p>
      <Button asChild className="mt-4">
        <Link href="/dashboard/templates/new">Build a template</Link>
      </Button>
    </div>
  );
}

export default TemplateCard;
