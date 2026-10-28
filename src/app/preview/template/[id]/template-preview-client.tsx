"use client";

import * as React from "react";
import { toast } from "sonner";
import { BrandingProvider } from "@/components/providers/branding-provider";
import { CreatorChrome } from "@/components/portal/creator-chrome";
import { CreatorRequestView, type CreatorRequestData } from "@/components/portal/creator-request-view";
import { dueInDays } from "@/lib/due";
import { TEMPLATE_PREVIEW_MESSAGE, requestDescriptionFromTemplate, requestFieldsFromTemplate, requestRichContentFromTemplate } from "@/lib/template-request";
import type { RichContent, TemplateField } from "@/lib/template-types";

export interface PreviewTemplate {
  name: string;
  description: string | null;
  richContent: RichContent | null;
  fields: TemplateField[];
  defaultDueDays: number;
}

const PREVIEW_MESSAGE = TEMPLATE_PREVIEW_MESSAGE;

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** The request a creator would get from this template today, before anything is uploaded */
function requestFrom(t: PreviewTemplate, tz: string): CreatorRequestData {
  const due = dueInDays(t.defaultDueDays || 7, tz);
  return {
    id: "preview",
    title: t.name.trim() || "Untitled template",
    description: requestDescriptionFromTemplate(t) || null,
    dueDate: due.dueDate.toISOString(),
    dueOn: due.dueOn.toISOString().slice(0, 10),
    status: "PENDING",
    createdAt: new Date().toISOString(),
    requirements: { _richContent: requestRichContentFromTemplate(t) },
    fields: requestFieldsFromTemplate(t),
    fieldSubmissions: {},
  };
}

export function TemplatePreviewClient({ saved, waitForDraft }: { saved: PreviewTemplate | null; waitForDraft: boolean }) {
  const [template, setTemplate] = React.useState<PreviewTemplate | null>(waitForDraft ? null : saved);
  const [version, setVersion] = React.useState(0);
  const tz = React.useMemo(() => browserTimeZone(), []);

  React.useEffect(() => {
    if (!waitForDraft) return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== PREVIEW_MESSAGE) return;
      setTemplate(e.data.template as PreviewTemplate);
      // A fresh draft starts the preview over
      setVersion((v) => v + 1);
    };
    window.addEventListener("message", onMessage);
    // Tell the editor we're listening
    window.parent?.postMessage({ type: `${PREVIEW_MESSAGE}:ready` }, window.location.origin);
    // Opened on its own: fall back to the saved template
    const fallback = setTimeout(() => setTemplate((t) => t ?? saved), 2500);
    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(fallback);
    };
  }, [waitForDraft, saved]);

  const request = React.useMemo(() => (template ? requestFrom(template, tz) : null), [template, tz]);

  return (
    <BrandingProvider>
      <CreatorChrome
        creator={{ name: "Creator preview", email: "What a creator sees" }}
        pathname="/creator/requests/preview"
        viewerTz={tz}
        onLogout={() => toast("This is a preview: only the request works here.")}
        preview
      >
        {request ? (
          <CreatorRequestView key={version} requestId="preview" preview={{ request }} />
        ) : (
          <div className="px-4 pt-6 text-[15px] text-ink-2" role="status">
            {waitForDraft ? "Loading the preview…" : "This template isn't available."}
          </div>
        )}
      </CreatorChrome>
    </BrandingProvider>
  );
}
