import { expandQuantityFields, type RichContent, type TemplateField } from "./template-types";
import { asRichHtml, htmlToPlain } from "./rich-text";

/**
 * What a request made from a template carries: the composer sends exactly
 * this, and "Preview as creator" shows it, so the preview is the request the
 * creator will get. Pure.
 */

export interface TemplateLike {
  description: string | null;
  richContent?: RichContent | null;
  fields: TemplateField[];
}

/** One field as a request stores it */
export interface RequestFieldFromTemplate {
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

/** The note to the creator, with the template's instructions after it (once) */
export function requestDescriptionFromTemplate(t: TemplateLike): string {
  const d = t.description || "";
  const rc = t.richContent?.description?.trim();
  if (rc && htmlToPlain(rc) !== htmlToPlain(d)) {
    const instructions = asRichHtml(rc);
    return d ? `${d}\n\n${instructions}` : instructions;
  }
  return d;
}

/** The fields a request starts with: quantities expanded, defaults filled in */
export function requestFieldsFromTemplate(t: Pick<TemplateLike, "fields">): RequestFieldFromTemplate[] {
  return expandQuantityFields(t.fields).map((f) => ({
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

/** The template's examples and references (its instructions travel in the description) */
export function requestRichContentFromTemplate(t: Pick<TemplateLike, "richContent">): RichContent | undefined {
  const rc = t.richContent;
  if (!rc) return undefined;
  return {
    exampleText: rc.exampleText,
    exampleImages: rc.exampleImages,
    exampleVideoUrl: rc.exampleVideoUrl,
    referenceLinks: rc.referenceLinks,
  };
}

/** The template editor posts its unsaved template to "Preview as creator" with this message (same origin only) */
export const TEMPLATE_PREVIEW_MESSAGE = "ccm-template-preview";
