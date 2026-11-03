"use client";

import * as React from "react";
import { toast } from "sonner";
import { BrandingProvider } from "@/components/providers/branding-provider";
import { CreatorChrome } from "@/components/portal/creator-chrome";
import { CreatorRequestView, type Comment, type CreatorRequestData, type UploadFile } from "@/components/portal/creator-request-view";
import { REQUEST_PREVIEW_MESSAGE } from "@/lib/template-request";

export interface SavedRequestPreview {
  request: CreatorRequestData;
  uploads?: UploadFile[];
  comments?: Comment[];
  creatorName?: string;
}

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function RequestPreviewClient({ saved, waitForDraft }: { saved: SavedRequestPreview | null; waitForDraft: boolean }) {
  const [shown, setShown] = React.useState<SavedRequestPreview | null>(waitForDraft ? null : saved);
  const [version, setVersion] = React.useState(0);
  const tz = React.useMemo(() => browserTimeZone(), []);

  React.useEffect(() => {
    if (!waitForDraft) return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== REQUEST_PREVIEW_MESSAGE) return;
      setShown(e.data.payload as SavedRequestPreview);
      // A fresh draft starts the preview over
      setVersion((v) => v + 1);
    };
    window.addEventListener("message", onMessage);
    // Tell the new-request screen we're listening
    window.parent?.postMessage({ type: `${REQUEST_PREVIEW_MESSAGE}:ready` }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, [waitForDraft]);

  const name = shown?.creatorName;
  const preview = React.useMemo(
    () => (shown ? { request: shown.request, uploads: shown.uploads, comments: shown.comments } : null),
    [shown]
  );

  return (
    <BrandingProvider>
      <CreatorChrome
        creator={{ name: name || "Creator preview", email: name ? `What ${name.split(" ")[0]} sees` : "What a creator sees" }}
        pathname={`/creator/requests/${shown?.request.id ?? "preview"}`}
        viewerTz={tz}
        onLogout={() => toast("This is a preview: only the request works here.")}
        preview
      >
        {preview ? (
          <CreatorRequestView key={version} requestId={preview.request.id} preview={preview} />
        ) : (
          <div className="px-4 pt-6 text-[15px] text-ink-2" role="status">
            {waitForDraft ? "Loading the preview…" : "This request isn't available."}
          </div>
        )}
      </CreatorChrome>
    </BrandingProvider>
  );
}
