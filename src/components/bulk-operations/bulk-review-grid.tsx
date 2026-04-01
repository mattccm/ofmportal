"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  Search,
  Check,
  X,
  SkipForward,
  Play,
  Image as ImageIcon,
  Video,
  File,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  List,
  Filter,
  Star,
  MessageSquare,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Keyboard,
  MoreHorizontal,
  ZoomIn,
  User,
  Clock,
  Eye,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ProgressTracker } from "./progress-tracker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { OperationTemplates } from "./operation-templates";
import { DryRunPreview, InlineDryRunPreview } from "./dry-run-preview";
import { CompactSmartSelection } from "./smart-selection-presets";
import { KeyboardShortcutsModal, KeyboardHint } from "./keyboard-shortcuts-modal";
import { cn } from "@/lib/utils";
import {
  DEFAULT_REJECT_TEMPLATES,
  BULK_REVIEW_SHORTCUTS,
  type QuickRejectTemplate,
  type DryRunResult,
  type DryRunItem,
  createEnhancedUndoWindow,
  UNDO_STORAGE_KEY,
} from "@/lib/bulk-operations";
import { useBulkReviewKeyboard, BULK_REVIEW_KEYBOARD_SHORTCUTS } from "@/hooks/use-bulk-review-keyboard";

// Types
interface Upload {
  id: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  thumbnailUrl?: string;
  previewUrl?: string;
  uploadedAt: string;
  creator: {
    id: string;
    name: string;
    email: string;
  };
  request: {
    id: string;
    title: string;
  };
}

interface BulkReviewGridProps {
  onComplete?: (result: ReviewResult) => void;
  onCancel?: () => void;
}

interface ReviewResult {
  operationId: string;
  approved: number;
  rejected: number;
  total: number;
  canUndo: boolean;
  undoExpiresAt: string;
}

type ReviewAction = "approve" | "reject" | "skip" | null;
type ViewMode = "grid" | "list";

interface ReviewState {
  uploadId: string;
  action: ReviewAction;
  rating?: number;
  notes?: string;
  rejectTemplateId?: string;
}

export function BulkReviewGrid({
  onComplete,
  onCancel,
}: BulkReviewGridProps) {
  // Data states
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // View states
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [creatorFilter, setCreatorFilter] = useState<string>("all");
  const [currentIndex, setCurrentIndex] = useState(0);

  // Selection states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reviewStates, setReviewStates] = useState<Map<string, ReviewState>>(new Map());

  // Action states
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<string | "selected" | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [selectedRejectTemplate, setSelectedRejectTemplate] = useState<string | null>(null);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Processing states
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [processResult, setProcessResult] = useState<ReviewResult | null>(null);

  // Preview states
  const [previewUpload, setPreviewUpload] = useState<Upload | null>(null);

  // Enhanced features state
  const [showDryRunPreview, setShowDryRunPreview] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch pending uploads
  useEffect(() => {
    async function fetchUploads() {
      setIsLoading(true);
      try {
        const response = await fetch("/api/uploads?status=PENDING");
        if (response.ok) {
          const data = await response.json();
          setUploads(data.uploads || data);
        }
      } catch (error) {
        console.error("Failed to fetch uploads:", error);
        toast.error("Failed to load uploads");
      } finally {
        setIsLoading(false);
      }
    }

    fetchUploads();
  }, []);

  // Get unique creators for filter
  const creators = useMemo(() => {
    const creatorMap = new Map<string, { id: string; name: string }>();
    uploads.forEach((u) => {
      if (!creatorMap.has(u.creator.id)) {
        creatorMap.set(u.creator.id, u.creator);
      }
    });
    return Array.from(creatorMap.values());
  }, [uploads]);

  // Filter uploads
  const filteredUploads = useMemo(() => {
    return uploads.filter((upload) => {
      // Search filter
      if (searchQuery) {
        const search = searchQuery.toLowerCase();
        if (
          !upload.originalName.toLowerCase().includes(search) &&
          !upload.creator.name.toLowerCase().includes(search) &&
          !upload.request.title.toLowerCase().includes(search)
        ) {
          return false;
        }
      }

      // Creator filter
      if (creatorFilter !== "all" && upload.creator.id !== creatorFilter) {
        return false;
      }

      return true;
    });
  }, [uploads, searchQuery, creatorFilter]);

  // Current upload for focus mode
  const currentUpload = filteredUploads[currentIndex];

  // Get review state for an upload
  const getReviewState = useCallback((uploadId: string): ReviewState | undefined => {
    return reviewStates.get(uploadId);
  }, [reviewStates]);

  // Set review action
  const setReviewAction = useCallback((uploadId: string, action: ReviewAction, extras?: Partial<ReviewState>) => {
    setReviewStates((prev) => {
      const next = new Map(prev);
      next.set(uploadId, {
        uploadId,
        action,
        ...extras,
      });
      return next;
    });
  }, []);

  // Toggle selection
  const toggleSelection = useCallback((uploadId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(uploadId)) {
        next.delete(uploadId);
      } else {
        next.add(uploadId);
      }
      return next;
    });
  }, []);

  // Select all from a creator
  const selectAllFromCreator = useCallback((creatorId: string) => {
    const creatorUploads = filteredUploads
      .filter((u) => u.creator.id === creatorId)
      .map((u) => u.id);
    setSelectedIds(new Set(creatorUploads));
  }, [filteredUploads]);

  // Select/deselect all
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredUploads.map((u) => u.id)));
  }, [filteredUploads]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Bulk actions on selection
  const approveSelected = useCallback(() => {
    selectedIds.forEach((id) => {
      setReviewAction(id, "approve");
    });
    toast.success(`Marked ${selectedIds.size} item(s) for approval`);
  }, [selectedIds, setReviewAction]);

  const openRejectDialog = useCallback((target: string | "selected") => {
    setRejectTarget(target);
    setRejectNotes("");
    setSelectedRejectTemplate(null);
    setShowRejectDialog(true);
  }, []);

  const confirmReject = useCallback(() => {
    const notes = selectedRejectTemplate
      ? DEFAULT_REJECT_TEMPLATES.find((t) => t.id === selectedRejectTemplate)?.message || rejectNotes
      : rejectNotes;

    if (rejectTarget === "selected") {
      selectedIds.forEach((id) => {
        setReviewAction(id, "reject", {
          notes,
          rejectTemplateId: selectedRejectTemplate || undefined,
        });
      });
      toast.success(`Marked ${selectedIds.size} item(s) for rejection`);
    } else if (rejectTarget) {
      setReviewAction(rejectTarget, "reject", {
        notes,
        rejectTemplateId: selectedRejectTemplate || undefined,
      });
      toast.success("Marked item for rejection");
    }

    setShowRejectDialog(false);
    setRejectTarget(null);
  }, [rejectTarget, selectedIds, rejectNotes, selectedRejectTemplate, setReviewAction]);

  // Navigation
  const goToNext = useCallback(() => {
    if (currentIndex < filteredUploads.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex, filteredUploads.length]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);


  // Generate dry run preview
  const generateDryRunPreview = useCallback(async (): Promise<DryRunResult> => {
    const reviewsToProcess = Array.from(reviewStates.values()).filter(
      (r) => r.action === "approve" || r.action === "reject"
    );

    const items: DryRunItem[] = reviewsToProcess.map((review) => {
      const upload = uploads.find((u) => u.id === review.uploadId);
      return {
        id: review.uploadId,
        name: upload?.originalName || review.uploadId,
        currentState: { status: "PENDING" },
        proposedChange: { status: review.action === "approve" ? "APPROVED" : "REJECTED" },
        changeDescription: review.action === "approve"
          ? "Will be approved"
          : `Will be rejected${review.notes ? ` with note: "${review.notes.slice(0, 50)}..."` : ""}`,
        warningMessage: review.action === "reject" && !review.notes
          ? "No rejection reason provided"
          : undefined,
      };
    });

    const approvalCount = reviewsToProcess.filter((r) => r.action === "approve").length;
    const rejectionCount = reviewsToProcess.filter((r) => r.action === "reject").length;

    const warnings: string[] = [];
    if (rejectionCount > 0) {
      const noReasonCount = reviewsToProcess.filter(
        (r) => r.action === "reject" && !r.notes
      ).length;
      if (noReasonCount > 0) {
        warnings.push(`${noReasonCount} rejection(s) have no reason provided`);
      }
    }

    return {
      operationType: "upload_review",
      willAffect: reviewsToProcess.length,
      items,
      estimatedDuration: reviewsToProcess.length * 200, // ~200ms per item
      warnings,
      canProceed: reviewsToProcess.length > 0,
    };
  }, [reviewStates, uploads]);

  // Process reviews
  const processReviews = useCallback(async () => {
    const reviewsToProcess = Array.from(reviewStates.values()).filter(
      (r) => r.action === "approve" || r.action === "reject"
    );

    if (reviewsToProcess.length === 0) {
      toast.error("No items marked for review");
      return;
    }

    setIsProcessing(true);
    setProcessProgress(0);

    try {
      // Separate approvals and rejections
      const approvals = reviewsToProcess.filter((r) => r.action === "approve").map((r) => r.uploadId);
      const rejections = reviewsToProcess.filter((r) => r.action === "reject");

      let totalProcessed = 0;
      const totalItems = reviewsToProcess.length;
      let approvedCount = 0;
      let rejectedCount = 0;
      let operationId = "";
      let undoExpiresAt = "";

      // Process approvals
      if (approvals.length > 0) {
        const response = await fetch("/api/uploads/bulk-review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uploadIds: approvals,
            action: "approve",
          }),
        });

        const data = await response.json();

        if (response.ok) {
          approvedCount = data.approved || 0;
          operationId = data.operationId || "";
          undoExpiresAt = data.undoExpiresAt || "";
        }

        totalProcessed += approvals.length;
        setProcessProgress((totalProcessed / totalItems) * 100);
      }

      // Process rejections
      if (rejections.length > 0) {
        const response = await fetch("/api/uploads/bulk-review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uploadIds: rejections.map((r) => r.uploadId),
            action: "reject",
            notes: rejections[0]?.notes, // Use first rejection's notes as default
          }),
        });

        const data = await response.json();

        if (response.ok) {
          rejectedCount = data.rejected || 0;
          operationId = data.operationId || operationId;
          undoExpiresAt = data.undoExpiresAt || undoExpiresAt;
        }

        totalProcessed += rejections.length;
        setProcessProgress(100);
      }

      const result: ReviewResult = {
        operationId,
        approved: approvedCount,
        rejected: rejectedCount,
        total: reviewsToProcess.length,
        canUndo: true,
        undoExpiresAt,
      };

      setProcessResult(result);

      // Store undo data for 5-minute undo window
      if (operationId && undoExpiresAt) {
        try {
          const undoData = {
            operationId,
            type: "upload_review" as const,
            description: `Reviewed ${reviewsToProcess.length} upload(s): ${approvedCount} approved, ${rejectedCount} rejected`,
            affectedCount: reviewsToProcess.length,
            affectedIds: reviewsToProcess.map((r) => r.uploadId),
            previousStates: reviewsToProcess.map((r) => ({
              id: r.uploadId,
              status: "PENDING",
            })),
            createdAt: new Date().toISOString(),
            expiresAt: undoExpiresAt,
          };

          // Store in localStorage for undo manager
          const stored = localStorage.getItem(UNDO_STORAGE_KEY);
          const operations = stored ? JSON.parse(stored) : [];
          operations.push(undoData);
          localStorage.setItem(UNDO_STORAGE_KEY, JSON.stringify(operations));
        } catch (error) {
          console.error("Failed to store undo data:", error);
        }
      }

      // Remove processed uploads from list
      const processedIds = new Set(reviewsToProcess.map((r) => r.uploadId));
      setUploads((prev) => prev.filter((u) => !processedIds.has(u.id)));
      setReviewStates(new Map());
      setSelectedIds(new Set());

      if (approvedCount > 0) {
        toast.success(`Approved ${approvedCount} upload(s)`);
      }
      if (rejectedCount > 0) {
        toast.success(`Rejected ${rejectedCount} upload(s)`);
      }

      onComplete?.(result);
    } catch (error) {
      console.error("Failed to process reviews:", error);
      toast.error("Failed to process reviews");
    } finally {
      setIsProcessing(false);
    }
  }, [reviewStates, onComplete]);

  // Enhanced keyboard shortcuts using custom hook
  const { shortcuts: keyboardShortcuts, showShortcuts: keyboardHelpOpen, setShowShortcuts: setKeyboardHelpOpen } = useBulkReviewKeyboard({
    items: filteredUploads.map((u) => u.id),
    currentIndex,
    columnsPerRow: viewMode === "grid" ? 4 : 1,
    onApprove: (uploadId) => {
      setReviewAction(uploadId, "approve");
    },
    onReject: (uploadId) => {
      openRejectDialog(uploadId);
    },
    onSkip: () => {
      // Skip handled by navigation
    },
    onNavigate: setCurrentIndex,
    onSelectAll: selectAll,
    onDeselectAll: deselectAll,
    onToggleSelect: toggleSelection,
    onConfirm: processReviews,
    onCancel: () => {
      setReviewStates(new Map());
      deselectAll();
    },
    onRate: (uploadId, rating) => {
      setReviewStates((prev) => {
        const next = new Map(prev);
        const existing = next.get(uploadId);
        next.set(uploadId, { ...existing, uploadId, action: existing?.action || null, rating });
        return next;
      });
    },
    onPreview: (uploadId) => {
      const upload = uploads.find((u) => u.id === uploadId);
      if (upload) setPreviewUpload(upload);
    },
    onSearch: () => searchInputRef.current?.focus(),
    onHelp: () => setShowShortcutsHelp(true),
    onViewChange: setViewMode,
    enabled: true,
  });

  // Sync keyboard help modal with local state
  useEffect(() => {
    if (keyboardHelpOpen) {
      setShowShortcutsHelp(true);
      setKeyboardHelpOpen(false);
    }
  }, [keyboardHelpOpen, setKeyboardHelpOpen]);

  // Get file icon
  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return ImageIcon;
    if (fileType.startsWith("video/")) return Video;
    return File;
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Stats
  const stats = useMemo(() => {
    let approveCount = 0;
    let rejectCount = 0;
    let skipCount = 0;

    reviewStates.forEach((state) => {
      if (state.action === "approve") approveCount++;
      else if (state.action === "reject") rejectCount++;
      else if (state.action === "skip") skipCount++;
    });

    return {
      total: filteredUploads.length,
      approved: approveCount,
      rejected: rejectCount,
      skipped: skipCount,
      remaining: filteredUploads.length - approveCount - rejectCount - skipCount,
    };
  }, [filteredUploads.length, reviewStates]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading uploads...</p>
        </div>
      </div>
    );
  }

  if (uploads.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
        <h3 className="mt-4 text-lg font-semibold">All caught up!</h3>
        <p className="mt-2 text-muted-foreground">
          There are no pending uploads to review.
        </p>
        <Button variant="outline" className="mt-4" onClick={onCancel}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Processing indicator */}
        {isProcessing && (
          <ProgressTracker
            title="Processing Reviews"
            status="in_progress"
            progress={processProgress}
            processedItems={Math.round((processProgress / 100) * stats.approved + stats.rejected)}
            totalItems={stats.approved + stats.rejected}
            successCount={0}
            failedCount={0}
          />
        )}

        {/* Toolbar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              {/* Search and filters */}
              <div className="flex flex-1 gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    placeholder="Search uploads... (press /)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <Select value={creatorFilter} onValueChange={setCreatorFilter}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="All Creators" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Creators</SelectItem>
                    {creators.map((creator) => (
                      <SelectItem key={creator.id} value={creator.id}>
                        {creator.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Smart selection dropdown */}
                <CompactSmartSelection
                  items={filteredUploads}
                  selectedIds={selectedIds}
                  onSelectionChange={setSelectedIds}
                  getItemId={(u) => u.id}
                  getItemCreatorId={(u) => u.creator.id}
                  creators={creators}
                />
              </div>

              {/* View controls */}
              <div className="flex gap-2">
                <Button
                  variant={viewMode === "grid" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setViewMode("grid")}
                  title="Grid view (G)"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setViewMode("list")}
                  title="List view (L)"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowShortcutsHelp(true)}
                  title="Keyboard shortcuts (?)"
                >
                  <Keyboard className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Stats bar */}
            <div className="flex flex-wrap gap-4 mt-4 text-sm">
              <span className="text-muted-foreground">
                {stats.total} total
              </span>
              {selectedIds.size > 0 && (
                <span className="font-medium text-primary">
                  {selectedIds.size} selected
                </span>
              )}
              {stats.approved > 0 && (
                <span className="flex items-center gap-1 text-green-600">
                  <Check className="h-4 w-4" />
                  {stats.approved} to approve
                </span>
              )}
              {stats.rejected > 0 && (
                <span className="flex items-center gap-1 text-red-600">
                  <X className="h-4 w-4" />
                  {stats.rejected} to reject
                </span>
              )}
            </div>

            {/* Bulk action buttons */}
            {selectedIds.size > 0 && (
              <div className="flex gap-2 mt-4 pt-4 border-t">
                <Button
                  variant="default"
                  size="sm"
                  onClick={approveSelected}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Check className="mr-2 h-4 w-4" />
                  Approve Selected ({selectedIds.size})
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => openRejectDialog("selected")}
                >
                  <X className="mr-2 h-4 w-4" />
                  Reject Selected
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAll}>
                  Clear Selection
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Grid/List view */}
        <div
          ref={gridRef}
          className={cn(
            viewMode === "grid"
              ? "grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
              : "space-y-2"
          )}
        >
          {filteredUploads.map((upload, index) => {
            const reviewState = getReviewState(upload.id);
            const isSelected = selectedIds.has(upload.id);
            const FileIcon = getFileIcon(upload.fileType);

            if (viewMode === "grid") {
              return (
                <Card
                  key={upload.id}
                  className={cn(
                    "relative overflow-hidden cursor-pointer transition-all group",
                    isSelected && "ring-2 ring-primary",
                    reviewState?.action === "approve" && "ring-2 ring-green-500 bg-green-50 dark:bg-green-950/20",
                    reviewState?.action === "reject" && "ring-2 ring-red-500 bg-red-50 dark:bg-red-950/20"
                  )}
                  onClick={() => toggleSelection(upload.id)}
                >
                  {/* Thumbnail */}
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    {upload.thumbnailUrl ? (
                      <img
                        src={upload.thumbnailUrl}
                        alt={upload.originalName}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <FileIcon className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}

                    {/* Overlay actions */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReviewAction(upload.id, "approve");
                            }}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Approve (A)</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              openRejectDialog(upload.id);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Reject (R)</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewUpload(upload);
                            }}
                          >
                            <ZoomIn className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Preview</TooltipContent>
                      </Tooltip>
                    </div>

                    {/* Selection checkbox */}
                    <div className="absolute top-2 left-2">
                      <Checkbox
                        checked={isSelected}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={() => toggleSelection(upload.id)}
                        className="bg-white"
                      />
                    </div>

                    {/* Status badge */}
                    {reviewState?.action && (
                      <div className="absolute top-2 right-2">
                        <Badge
                          className={cn(
                            reviewState.action === "approve" && "bg-green-500",
                            reviewState.action === "reject" && "bg-red-500"
                          )}
                        >
                          {reviewState.action === "approve" ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <CardContent className="p-3">
                    <p className="font-medium text-sm truncate" title={upload.originalName}>
                      {upload.originalName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {upload.creator.name}
                    </p>
                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                      <span>{formatFileSize(upload.fileSize)}</span>
                      <span>{format(new Date(upload.uploadedAt), "MMM d")}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            } else {
              // List view
              return (
                <Card
                  key={upload.id}
                  className={cn(
                    "cursor-pointer transition-all",
                    isSelected && "ring-2 ring-primary",
                    reviewState?.action === "approve" && "ring-2 ring-green-500 bg-green-50 dark:bg-green-950/20",
                    reviewState?.action === "reject" && "ring-2 ring-red-500 bg-red-50 dark:bg-red-950/20"
                  )}
                  onClick={() => toggleSelection(upload.id)}
                >
                  <CardContent className="p-3 flex items-center gap-4">
                    <Checkbox
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onCheckedChange={() => toggleSelection(upload.id)}
                    />

                    {/* Thumbnail */}
                    <div className="h-16 w-24 bg-muted rounded overflow-hidden flex-shrink-0">
                      {upload.thumbnailUrl ? (
                        <img
                          src={upload.thumbnailUrl}
                          alt={upload.originalName}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <FileIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{upload.originalName}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {upload.creator.name}
                        </span>
                        <span>{upload.request.title}</span>
                        <span>{formatFileSize(upload.fileSize)}</span>
                      </div>
                    </div>

                    {/* Status */}
                    {reviewState?.action && (
                      <Badge
                        className={cn(
                          reviewState.action === "approve" && "bg-green-500",
                          reviewState.action === "reject" && "bg-red-500"
                        )}
                      >
                        {reviewState.action === "approve" ? "Approve" : "Reject"}
                      </Badge>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        size="icon-sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReviewAction(upload.id, "approve");
                        }}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          openRejectDialog(upload.id);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button size="icon-sm" variant="outline">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => setPreviewUpload(upload)}>
                            <ZoomIn className="mr-2 h-4 w-4" />
                            Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => selectAllFromCreator(upload.creator.id)}>
                            <User className="mr-2 h-4 w-4" />
                            Select all from {upload.creator.name}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              );
            }
          })}
        </div>

        {/* Submit button */}
        {(stats.approved > 0 || stats.rejected > 0) && (
          <div className="sticky bottom-4 bg-background p-4 border rounded-lg shadow-lg">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="font-medium">
                  {stats.approved + stats.rejected} item(s) ready to process
                </span>
                <span className="text-muted-foreground ml-2">
                  ({stats.approved} approve, {stats.rejected} reject)
                </span>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <KeyboardHint shortcut="Enter" label="to process" />
                  <span className="mx-1">|</span>
                  <KeyboardHint shortcut="Escape" label="to clear" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setReviewStates(new Map());
                  }}
                >
                  Clear All
                </Button>
                <DryRunPreview
                  operationType="upload_review"
                  selectedItems={Array.from(reviewStates.keys()).filter(
                    (id) => {
                      const state = reviewStates.get(id);
                      return state?.action === "approve" || state?.action === "reject";
                    }
                  )}
                  onPreview={generateDryRunPreview}
                  onExecute={processReviews}
                  isExecuting={isProcessing}
                  disabled={stats.approved + stats.rejected === 0}
                />
              </div>
            </div>
          </div>
        )}

        {/* Reject dialog */}
        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Upload(s)</DialogTitle>
              <DialogDescription>
                Select a reason or write a custom message for the rejection.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Quick Reject Templates</Label>
                <div className="grid grid-cols-2 gap-2">
                  {DEFAULT_REJECT_TEMPLATES.map((template) => (
                    <Button
                      key={template.id}
                      variant={selectedRejectTemplate === template.id ? "default" : "outline"}
                      size="sm"
                      className="justify-start"
                      onClick={() => {
                        setSelectedRejectTemplate(template.id);
                        setRejectNotes(template.message);
                      }}
                    >
                      {template.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rejectNotes">Message</Label>
                <Textarea
                  id="rejectNotes"
                  value={rejectNotes}
                  onChange={(e) => {
                    setRejectNotes(e.target.value);
                    setSelectedRejectTemplate(null);
                  }}
                  placeholder="Provide feedback for the creator..."
                  rows={4}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmReject}>
                <X className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Keyboard shortcuts help */}
        <Dialog open={showShortcutsHelp} onOpenChange={setShowShortcutsHelp}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Keyboard Shortcuts</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {Object.entries(BULK_REVIEW_SHORTCUTS).map(([key, { label }]) => (
                <div key={key} className="flex items-center justify-between py-2">
                  <span>{label}</span>
                  <kbd className="px-2 py-1 bg-muted rounded text-sm font-mono">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button onClick={() => setShowShortcutsHelp(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview dialog */}
        <Dialog open={!!previewUpload} onOpenChange={() => setPreviewUpload(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{previewUpload?.originalName}</DialogTitle>
              <DialogDescription>
                From {previewUpload?.creator.name} - {previewUpload?.request.title}
              </DialogDescription>
            </DialogHeader>

            <div className="aspect-video bg-muted rounded-lg overflow-hidden">
              {previewUpload?.previewUrl || previewUpload?.thumbnailUrl ? (
                previewUpload.fileType.startsWith("video/") ? (
                  <video
                    src={previewUpload.previewUrl}
                    controls
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img
                    src={previewUpload.previewUrl || previewUpload.thumbnailUrl}
                    alt={previewUpload.originalName}
                    className="w-full h-full object-contain"
                  />
                )
              ) : (
                <div className="flex items-center justify-center h-full">
                  <File className="h-16 w-16 text-muted-foreground" />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={() => {
                  if (previewUpload) {
                    setReviewAction(previewUpload.id, "approve");
                    setPreviewUpload(null);
                  }
                }}
              >
                <Check className="mr-2 h-4 w-4" />
                Approve
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (previewUpload) {
                    openRejectDialog(previewUpload.id);
                    setPreviewUpload(null);
                  }
                }}
              >
                <X className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

export default BulkReviewGrid;
