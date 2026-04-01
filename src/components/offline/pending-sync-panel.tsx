'use client';

import { useState, useCallback } from 'react';
import {
  Clock,
  Upload,
  MessageSquare,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  File,
  FileImage,
  FileVideo,
  FileAudio,
  FileText,
  MoreVertical,
  X,
  ArrowUpCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOffline } from '@/hooks/use-offline';
import {
  deletePendingUpload,
  deleteDraft,
  type PendingUpload,
  type Draft,
} from '@/lib/offline-storage';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog-enhanced';

// ============================================
// Types
// ============================================

interface PendingSyncPanelProps {
  maxHeight?: string;
  showHeader?: boolean;
  className?: string;
}

type TabType = 'all' | 'uploads' | 'drafts';

// ============================================
// Helper Functions
// ============================================

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.startsWith('video/')) return FileVideo;
  if (mimeType.startsWith('audio/')) return FileAudio;
  if (mimeType.startsWith('text/')) return FileText;
  return File;
}

function getStatusColor(status: PendingUpload['status']): string {
  switch (status) {
    case 'pending':
      return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    case 'uploading':
      return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    case 'failed':
      return 'bg-red-500/10 text-red-500 border-red-500/20';
    case 'completed':
      return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function getStatusLabel(status: PendingUpload['status']): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'uploading':
      return 'Uploading';
    case 'failed':
      return 'Failed';
    case 'completed':
      return 'Completed';
    default:
      return status;
  }
}

// ============================================
// Main Component
// ============================================

export function PendingSyncPanel({
  maxHeight = '400px',
  showHeader = true,
  className,
}: PendingSyncPanelProps) {
  const {
    isOffline,
    pendingUploads,
    pendingDrafts,
    isSyncing,
    syncNow,
    retryFailed,
  } = useOffline();

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{
    type: 'upload' | 'draft';
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter items based on active tab
  const filteredUploads =
    activeTab === 'drafts'
      ? []
      : pendingUploads.filter((u) => u.status !== 'completed');
  const filteredDrafts = activeTab === 'uploads' ? [] : pendingDrafts;

  const totalPending = filteredUploads.length + filteredDrafts.length;
  const failedCount = filteredUploads.filter((u) => u.status === 'failed').length;

  const handleDelete = useCallback(
    async (type: 'upload' | 'draft', id: string, name: string) => {
      setItemToDelete({ type, id, name });
      setDeleteDialogOpen(true);
    },
    []
  );

  const confirmDelete = useCallback(async () => {
    if (!itemToDelete) return;

    setIsDeleting(true);
    try {
      if (itemToDelete.type === 'upload') {
        await deletePendingUpload(itemToDelete.id);
      } else {
        await deleteDraft(itemToDelete.id);
      }
    } catch (error) {
      console.error('Failed to delete item:', error);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  }, [itemToDelete]);

  // ============================================
  // Empty State
  // ============================================

  if (totalPending === 0) {
    return (
      <div className={cn('rounded-lg border bg-card', className)}>
        {showHeader && (
          <div className="border-b px-4 py-3">
            <h3 className="font-semibold">Pending Sync</h3>
          </div>
        )}
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 mb-4">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <p className="font-medium text-foreground">All synced!</p>
          <p className="text-sm text-muted-foreground mt-1">
            No pending items to sync
          </p>
        </div>
      </div>
    );
  }

  // ============================================
  // Render
  // ============================================

  return (
    <div className={cn('rounded-lg border bg-card', className)}>
      {/* Header */}
      {showHeader && (
        <div className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Pending Sync</h3>
              <Badge variant="secondary" className="rounded-full">
                {totalPending}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {failedCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={retryFailed}
                  className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                >
                  <AlertCircle className="h-4 w-4 mr-1" />
                  Retry {failedCount} failed
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={syncNow}
                disabled={isOffline || isSyncing}
              >
                <RefreshCw
                  className={cn('h-4 w-4 mr-1', isSyncing && 'animate-spin')}
                />
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b px-4">
        <div className="flex gap-4">
          {(['all', 'uploads', 'drafts'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'py-2.5 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'uploads' && filteredUploads.length > 0 && (
                <span className="ml-1.5 text-xs">({pendingUploads.filter(u => u.status !== 'completed').length})</span>
              )}
              {tab === 'drafts' && pendingDrafts.length > 0 && (
                <span className="ml-1.5 text-xs">({pendingDrafts.length})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Items List */}
      <ScrollArea style={{ maxHeight }}>
        <div className="divide-y">
          {/* Pending Uploads */}
          {filteredUploads.map((upload) => (
            <PendingUploadItem
              key={upload.id}
              upload={upload}
              onDelete={() => handleDelete('upload', upload.id, upload.fileName)}
            />
          ))}

          {/* Drafts */}
          {filteredDrafts.map((draft) => (
            <DraftItem
              key={draft.id}
              draft={draft}
              onDelete={() => handleDelete('draft', draft.id, draft.type)}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Offline notice */}
      {isOffline && (
        <div className="border-t bg-amber-500/5 px-4 py-3">
          <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Items will sync automatically when you are back online
          </p>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete pending item?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this {itemToDelete?.type}? This action
              cannot be undone and the item will not be synced.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-500 hover:bg-red-600"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================
// Pending Upload Item Component
// ============================================

interface PendingUploadItemProps {
  upload: PendingUpload;
  onDelete: () => void;
}

function PendingUploadItem({ upload, onDelete }: PendingUploadItemProps) {
  const FileIcon = getFileIcon(upload.fileType);

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
      {/* File Icon / Thumbnail */}
      <div className="flex-shrink-0">
        {upload.thumbnail ? (
          <div className="h-10 w-10 rounded-lg overflow-hidden bg-muted">
            <img
              src={upload.thumbnail}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <FileIcon className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{upload.fileName}</p>
          <Badge
            variant="outline"
            className={cn('text-xs', getStatusColor(upload.status))}
          >
            {upload.status === 'uploading' && (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            )}
            {getStatusLabel(upload.status)}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <span>{formatFileSize(upload.fileSize)}</span>
          <span>-</span>
          <span>{formatRelativeTime(upload.createdAt)}</span>
          {upload.retryCount > 0 && (
            <>
              <span>-</span>
              <span className="text-amber-500">
                {upload.retryCount} {upload.retryCount === 1 ? 'retry' : 'retries'}
              </span>
            </>
          )}
        </div>
        {upload.error && (
          <p className="text-xs text-red-500 mt-1 truncate">{upload.error}</p>
        )}
      </div>

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={onDelete}
            className="text-red-500 focus:text-red-500"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ============================================
// Draft Item Component
// ============================================

interface DraftItemProps {
  draft: Draft;
  onDelete: () => void;
}

function DraftItem({ draft, onDelete }: DraftItemProps) {
  const getTypeIcon = () => {
    switch (draft.type) {
      case 'comment':
      case 'reply':
        return MessageSquare;
      case 'message':
        return ArrowUpCircle;
      case 'note':
        return FileText;
      default:
        return MessageSquare;
    }
  };

  const Icon = getTypeIcon();

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
      {/* Icon */}
      <div className="flex-shrink-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm capitalize">{draft.type}</p>
          <Badge variant="outline" className="text-xs">
            Draft
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
          {draft.content || 'Empty draft'}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Last edited {formatRelativeTime(draft.updatedAt)}
        </p>
      </div>

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={onDelete}
            className="text-red-500 focus:text-red-500"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ============================================
// Compact Pending Sync Summary
// ============================================

interface PendingSyncSummaryProps {
  className?: string;
}

export function PendingSyncSummary({ className }: PendingSyncSummaryProps) {
  const { pendingUploads, pendingDrafts, isSyncing, syncNow, isOffline } =
    useOffline();

  const pendingUploadsCount = pendingUploads.filter(
    (u) => u.status !== 'completed'
  ).length;
  const failedUploadsCount = pendingUploads.filter(
    (u) => u.status === 'failed'
  ).length;
  const totalPending = pendingUploadsCount + pendingDrafts.length;

  if (totalPending === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-lg border p-3',
        'bg-amber-500/5 border-amber-500/20',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10">
          <Clock className="h-4 w-4 text-amber-500" />
        </div>
        <div>
          <p className="text-sm font-medium">
            {totalPending} pending {totalPending === 1 ? 'item' : 'items'}
          </p>
          <p className="text-xs text-muted-foreground">
            {pendingUploadsCount > 0 && `${pendingUploadsCount} uploads`}
            {pendingUploadsCount > 0 && pendingDrafts.length > 0 && ', '}
            {pendingDrafts.length > 0 && `${pendingDrafts.length} drafts`}
            {failedUploadsCount > 0 && (
              <span className="text-red-500">
                {' '}
                ({failedUploadsCount} failed)
              </span>
            )}
          </p>
        </div>
      </div>

      <Button
        size="sm"
        variant="outline"
        onClick={syncNow}
        disabled={isOffline || isSyncing}
        className="border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
      >
        {isSyncing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        <span className="ml-2">Sync</span>
      </Button>
    </div>
  );
}
