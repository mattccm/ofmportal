'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Calendar,
  Clock,
  User,
  Tag,
  Search,
  Filter,
  MoreVertical,
  Trash2,
  ExternalLink,
  RefreshCw,
  Download,
  CloudOff,
  CheckCircle2,
  AlertCircle,
  Archive,
  Inbox,
  Eye,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getOfflineRequests,
  getOfflineRequest,
  deleteOfflineRequest,
  type CachedRequest,
} from '@/lib/offline-storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOffline } from '@/hooks/use-offline';

// ============================================
// Types
// ============================================

interface OfflineRequestViewerProps {
  maxHeight?: string;
  showSearch?: boolean;
  showFilters?: boolean;
  onViewRequest?: (request: CachedRequest) => void;
  className?: string;
}

type StatusFilter = 'all' | 'active' | 'completed' | 'archived';
type SortOption = 'recent' | 'deadline' | 'alphabetical';

// ============================================
// Helper Functions
// ============================================

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

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
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(new Date(timestamp).toISOString());
}

function getStatusIcon(status: CachedRequest['status']) {
  switch (status) {
    case 'active':
      return Inbox;
    case 'completed':
      return CheckCircle2;
    case 'archived':
      return Archive;
    default:
      return FileText;
  }
}

function getStatusColor(status: CachedRequest['status']): string {
  switch (status) {
    case 'active':
      return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    case 'completed':
      return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    case 'archived':
      return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

// ============================================
// Main Component
// ============================================

export function OfflineRequestViewer({
  maxHeight = '500px',
  showSearch = true,
  showFilters = true,
  onViewRequest,
  className,
}: OfflineRequestViewerProps) {
  const { isOffline, pendingActions } = useOffline();

  const [requests, setRequests] = useState<CachedRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [selectedRequest, setSelectedRequest] = useState<CachedRequest | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load cached requests
  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const cached = await getOfflineRequests();
      setRequests(cached);
    } catch (error) {
      console.error('Failed to load cached requests:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Filter and sort requests
  const filteredRequests = requests
    .filter((request) => {
      // Status filter
      if (statusFilter !== 'all' && request.status !== statusFilter) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          request.title.toLowerCase().includes(query) ||
          request.description?.toLowerCase().includes(query)
        );
      }

      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return b.cachedAt - a.cachedAt;
        case 'deadline':
          if (!a.deadline && !b.deadline) return 0;
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        case 'alphabetical':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

  // Handle request selection
  const handleViewRequest = (request: CachedRequest) => {
    if (onViewRequest) {
      onViewRequest(request);
    } else {
      setSelectedRequest(request);
      setDetailsOpen(true);
    }
  };

  // Handle delete
  const handleDelete = (id: string) => {
    setRequestToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!requestToDelete) return;

    setIsDeleting(true);
    try {
      await deleteOfflineRequest(requestToDelete);
      await loadRequests();
    } catch (error) {
      console.error('Failed to delete request:', error);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setRequestToDelete(null);
    }
  };

  // ============================================
  // Loading State
  // ============================================

  if (isLoading) {
    return (
      <div className={cn('rounded-lg border bg-card', className)}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // ============================================
  // Empty State
  // ============================================

  if (requests.length === 0) {
    return (
      <div className={cn('rounded-lg border bg-card', className)}>
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
            <CloudOff className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium text-foreground">No cached requests</p>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            Requests you view while online will be available here for offline access
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
      {/* Header with Search and Filters */}
      <div className="border-b p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Cached Requests</h3>
            <p className="text-sm text-muted-foreground">
              {filteredRequests.length} of {requests.length} requests
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadRequests}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Search and Filters */}
        {(showSearch || showFilters) && (
          <div className="flex flex-col sm:flex-row gap-3">
            {showSearch && (
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search cached requests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}

            {showFilters && (
              <div className="flex gap-2">
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as StatusFilter)}
                >
                  <SelectTrigger className="w-[130px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={sortBy}
                  onValueChange={(value) => setSortBy(value as SortOption)}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Most Recent</SelectItem>
                    <SelectItem value="deadline">Deadline</SelectItem>
                    <SelectItem value="alphabetical">Alphabetical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Request List */}
      <ScrollArea style={{ maxHeight }}>
        {filteredRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <Search className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No matching requests found</p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredRequests.map((request) => (
              <RequestItem
                key={request.id}
                request={request}
                onView={() => handleViewRequest(request)}
                onDelete={() => handleDelete(request.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Offline indicator */}
      {isOffline && (
        <div className="border-t bg-amber-500/5 px-4 py-3">
          <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            You are viewing cached data. Some information may be outdated.
          </p>
        </div>
      )}

      {/* Request Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          {selectedRequest && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedRequest.title}</DialogTitle>
                <DialogDescription>
                  Cached {formatRelativeTime(selectedRequest.cachedAt)}
                </DialogDescription>
              </DialogHeader>
              <RequestDetails request={selectedRequest} />
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete cached request?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the request from your offline cache. You can reload
              it later when online.
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
// Request Item Component
// ============================================

interface RequestItemProps {
  request: CachedRequest;
  onView: () => void;
  onDelete: () => void;
}

function RequestItem({ request, onView, onDelete }: RequestItemProps) {
  const StatusIcon = getStatusIcon(request.status);

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3',
        'hover:bg-muted/50 transition-colors cursor-pointer group'
      )}
      onClick={onView}
    >
      {/* Status Icon */}
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0',
          request.status === 'active'
            ? 'bg-blue-500/10 text-blue-500'
            : request.status === 'completed'
            ? 'bg-emerald-500/10 text-emerald-500'
            : 'bg-gray-500/10 text-gray-500'
        )}
      >
        <StatusIcon className="h-5 w-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{request.title}</p>
          <Badge
            variant="outline"
            className={cn('text-xs capitalize', getStatusColor(request.status))}
          >
            {request.status}
          </Badge>
        </div>
        {request.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {request.description}
          </p>
        )}
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
          {request.deadline && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(request.deadline)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Cached {formatRelativeTime(request.cachedAt)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => {
          e.stopPropagation();
          onView();
        }}>
          <Eye className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView()}>
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete()}
              className="text-red-500 focus:text-red-500"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove from Cache
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    </div>
  );
}

// ============================================
// Request Details Component
// ============================================

interface RequestDetailsProps {
  request: CachedRequest;
}

function RequestDetails({ request }: RequestDetailsProps) {
  const { isOffline } = useOffline();
  const StatusIcon = getStatusIcon(request.status);

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div
        className={cn(
          'flex items-center gap-3 p-4 rounded-lg',
          request.status === 'active'
            ? 'bg-blue-500/10'
            : request.status === 'completed'
            ? 'bg-emerald-500/10'
            : 'bg-gray-500/10'
        )}
      >
        <StatusIcon
          className={cn(
            'h-5 w-5',
            request.status === 'active'
              ? 'text-blue-500'
              : request.status === 'completed'
              ? 'text-emerald-500'
              : 'text-gray-500'
          )}
        />
        <div>
          <p className="font-medium capitalize">{request.status}</p>
          <p className="text-sm text-muted-foreground">
            Last updated {formatDate(request.updatedAt)}
          </p>
        </div>
      </div>

      {/* Description */}
      {request.description && (
        <div>
          <h4 className="text-sm font-medium mb-2">Description</h4>
          <p className="text-sm text-muted-foreground">{request.description}</p>
        </div>
      )}

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-4">
        {request.deadline && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-1">
              Deadline
            </h4>
            <p className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {formatDate(request.deadline)}
            </p>
          </div>
        )}

        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-1">
            Created
          </h4>
          <p className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            {formatDate(request.createdAt)}
          </p>
        </div>

        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-1">
            Cached
          </h4>
          <p className="text-sm flex items-center gap-2">
            <Download className="h-4 w-4 text-muted-foreground" />
            {formatRelativeTime(request.cachedAt)}
          </p>
        </div>
      </div>

      {/* Offline Notice */}
      {isOffline && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-600 dark:text-amber-400">
              Limited functionality offline
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Some features like uploading files and sending messages will be queued
              until you are back online.
            </p>
          </div>
        </div>
      )}

      {/* Action Button */}
      <div className="flex gap-3">
        <Button className="flex-1" disabled={isOffline}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Open Request
        </Button>
      </div>
    </div>
  );
}
