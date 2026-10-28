"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface FieldSubmission {
  status: "PENDING" | "SUBMITTED" | "APPROVED" | "NEEDS_REVISION";
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  feedback?: string;
}

interface FieldReviewControlsProps {
  requestId: string;
  fieldId: string;
  submission?: FieldSubmission;
  /** Only show approve/request-changes actions when there is content to review. */
  hasUploads: boolean;
  onReviewed?: (
    fieldId: string,
    submission: FieldSubmission,
    requestStatus: string
  ) => void;
}

/**
 * Per-section review affordance for staff. Approves or requests changes on a
 * single template field via the existing field-review route, and surfaces the
 * rejection reason attached to that specific section.
 */
export function FieldReviewControls({
  requestId,
  fieldId,
  submission,
  hasUploads,
  onReviewed,
}: FieldReviewControlsProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState(submission?.feedback ?? "");
  const [action, setAction] = useState<null | "approve" | "request_changes">(
    null
  );

  const status = submission?.status;
  const needsRevision = status === "NEEDS_REVISION";
  const isApproved = status === "APPROVED";

  const submitReview = async (
    reviewAction: "approve" | "request_changes",
    feedback?: string
  ) => {
    setAction(reviewAction);
    try {
      const response = await fetch(
        `/api/requests/${requestId}/fields/${fieldId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: reviewAction, feedback }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to review section");
      }

      toast.success(
        reviewAction === "approve"
          ? "Section approved"
          : "Changes requested for this section"
      );
      setDialogOpen(false);
      onReviewed?.(fieldId, data.fieldSubmission, data.requestStatus);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to review section"
      );
    } finally {
      setAction(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Rejection reason attached to this specific section */}
      {needsRevision && submission?.feedback && (
        <div className="rounded-lg border border-late/30 bg-late/10 p-3 dark:bg-late/10">
          <p className="whitespace-pre-wrap break-words text-sm text-late dark:text-late">
            <span className="font-medium">Changes requested:</span>{" "}
            {submission.feedback}
          </p>
        </div>
      )}
      {isApproved && (
        <div className="flex items-center gap-1.5 text-sm text-approved">
          <CheckCircle2 className="h-4 w-4" />
          Section approved
        </div>
      )}

      {hasUploads && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-approved/30 text-approved hover:bg-approved/10 dark:hover:bg-approved/20"
            disabled={!!action || isApproved}
            onClick={() => submitReview("approve")}
          >
            {action === "approve" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Approve section
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-late/30 text-late hover:bg-late/10 dark:border-late/30 dark:hover:bg-late/10"
            disabled={!!action}
            onClick={() => {
              setReason(submission?.feedback ?? "");
              setDialogOpen(true);
            }}
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            Request changes
          </Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request changes for this section</DialogTitle>
            <DialogDescription>
              Explain what needs to change. The creator will see this reason on
              this specific section.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter the reason for this section..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={!!action}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => submitReview("request_changes", reason.trim())}
              disabled={!reason.trim() || !!action}
            >
              {action === "request_changes" && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Request changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
