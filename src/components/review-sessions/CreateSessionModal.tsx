"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  Video,
  Image as ImageIcon,
  FileText,
  Users,
  Play,
  X,
  Search,
  Settings,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  CreateSessionModalProps,
  CreateSessionRequest,
  ReviewUploadInfo,
  DEFAULT_SESSION_SETTINGS,
  ReviewSessionSettings,
} from "@/types/review-session";

export function CreateSessionModal({
  isOpen,
  onClose,
  onCreateSession,
  availableUploads,
  teamMembers,
}: CreateSessionModalProps) {
  const [sessionName, setSessionName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedUploadIds, setSelectedUploadIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<ReviewSessionSettings>(DEFAULT_SESSION_SETTINGS);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter uploads based on search
  const filteredUploads = useMemo(() => {
    if (!searchQuery) return availableUploads;
    const query = searchQuery.toLowerCase();
    return availableUploads.filter(
      (upload) =>
        upload.originalName.toLowerCase().includes(query) ||
        upload.creatorName.toLowerCase().includes(query) ||
        upload.requestTitle.toLowerCase().includes(query)
    );
  }, [availableUploads, searchQuery]);

  // Group uploads by creator
  const uploadsByCreator = useMemo(() => {
    const grouped = new Map<string, ReviewUploadInfo[]>();
    filteredUploads.forEach((upload) => {
      const existing = grouped.get(upload.creatorName) || [];
      grouped.set(upload.creatorName, [...existing, upload]);
    });
    return grouped;
  }, [filteredUploads]);

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("video/")) return <Video className="h-4 w-4" />;
    if (fileType.startsWith("image/")) return <ImageIcon className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const toggleUpload = (uploadId: string) => {
    setSelectedUploadIds((prev) =>
      prev.includes(uploadId)
        ? prev.filter((id) => id !== uploadId)
        : [...prev, uploadId]
    );
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllUploads = () => {
    setSelectedUploadIds(filteredUploads.map((u) => u.id));
  };

  const clearSelectedUploads = () => {
    setSelectedUploadIds([]);
  };

  const handleCreate = async () => {
    if (!sessionName.trim()) {
      setError("Please enter a session name");
      return;
    }

    if (selectedUploadIds.length === 0) {
      setError("Please select at least one item to review");
      return;
    }

    setError(null);
    setIsCreating(true);

    try {
      const request: CreateSessionRequest = {
        name: sessionName.trim(),
        description: description.trim() || undefined,
        uploadIds: selectedUploadIds,
        inviteUserIds: selectedUserIds.length > 0 ? selectedUserIds : undefined,
        settings,
      };

      await onCreateSession(request);
      // Reset form and close
      setSessionName("");
      setDescription("");
      setSelectedUploadIds([]);
      setSelectedUserIds([]);
      setSettings(DEFAULT_SESSION_SETTINGS);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-red-500" />
            Start Live Review Session
          </DialogTitle>
          <DialogDescription>
            Create a collaborative review session to review content with your team in real-time.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left column - Session details and uploads */}
          <div className="space-y-4 flex flex-col overflow-hidden">
            <div className="space-y-2">
              <Label htmlFor="session-name">Session Name *</Label>
              <Input
                id="session-name"
                placeholder="e.g., Weekly Content Review"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="What are we reviewing today?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            {/* Upload selection */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <Label>Select Content to Review *</Label>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">
                    {selectedUploadIds.length} selected
                  </span>
                  {selectedUploadIds.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearSelectedUploads}
                      className="h-6 px-2"
                    >
                      Clear
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectAllUploads}
                    className="h-6 px-2"
                  >
                    Select All
                  </Button>
                </div>
              </div>

              <div className="relative mb-2">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search uploads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>

              <ScrollArea className="flex-1 border rounded-md">
                <div className="p-2 space-y-3">
                  {Array.from(uploadsByCreator.entries()).map(([creatorName, uploads]) => (
                    <div key={creatorName}>
                      <div className="text-sm font-medium text-muted-foreground mb-1 px-2">
                        {creatorName} ({uploads.length})
                      </div>
                      <div className="space-y-1">
                        {uploads.map((upload) => (
                          <div
                            key={upload.id}
                            className={`flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-accent ${
                              selectedUploadIds.includes(upload.id)
                                ? "bg-accent border border-primary"
                                : ""
                            }`}
                            onClick={() => toggleUpload(upload.id)}
                          >
                            <Checkbox
                              checked={selectedUploadIds.includes(upload.id)}
                              onCheckedChange={() => toggleUpload(upload.id)}
                            />
                            {upload.thumbnailUrl ? (
                              <img
                                src={upload.thumbnailUrl}
                                alt=""
                                className="h-8 w-8 rounded object-cover"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                                {getFileIcon(upload.fileType)}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">
                                {upload.originalName}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {upload.requestTitle}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {filteredUploads.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No uploads found
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Right column - Team and settings */}
          <div className="space-y-4 flex flex-col overflow-hidden">
            {/* Team selection */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4" />
                <Label>Invite Team Members (optional)</Label>
              </div>
              <ScrollArea className="flex-1 border rounded-md">
                <div className="p-2 space-y-1">
                  {teamMembers.map((member) => (
                    <div
                      key={member.id}
                      className={`flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-accent ${
                        selectedUserIds.includes(member.id)
                          ? "bg-accent border border-primary"
                          : ""
                      }`}
                      onClick={() => toggleUser(member.id)}
                    >
                      <Checkbox
                        checked={selectedUserIds.includes(member.id)}
                        onCheckedChange={() => toggleUser(member.id)}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.avatar || undefined} />
                        <AvatarFallback>
                          {member.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{member.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {member.email}
                        </div>
                      </div>
                    </div>
                  ))}
                  {teamMembers.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No team members available
                    </div>
                  )}
                </div>
              </ScrollArea>
              {selectedUserIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {selectedUserIds.map((userId) => {
                    const member = teamMembers.find((m) => m.id === userId);
                    return (
                      <Badge key={userId} variant="secondary" className="gap-1">
                        {member?.name}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => toggleUser(userId)}
                        />
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Settings */}
            <div className="border rounded-md">
              <button
                type="button"
                className="w-full flex items-center justify-between p-3 hover:bg-accent"
                onClick={() => setShowSettings(!showSettings)}
              >
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span className="font-medium">Session Settings</span>
                </div>
                {showSettings ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              {showSettings && (
                <div className="p-3 border-t space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-votes" className="text-sm">
                      Show votes immediately
                    </Label>
                    <Switch
                      id="show-votes"
                      checked={settings.showVotesImmediately}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, showVotesImmediately: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="allow-chat" className="text-sm">
                      Enable chat
                    </Label>
                    <Switch
                      id="allow-chat"
                      checked={settings.allowChat}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, allowChat: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="host-navigate" className="text-sm">
                      Only host can navigate
                    </Label>
                    <Switch
                      id="host-navigate"
                      checked={settings.onlyHostCanNavigate}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, onlyHostCanNavigate: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auto-advance" className="text-sm">
                      Auto-advance after voting
                    </Label>
                    <Switch
                      id="auto-advance"
                      checked={settings.autoAdvance}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, autoAdvance: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="allow-voice-notes" className="text-sm">
                      Allow voice notes
                    </Label>
                    <Switch
                      id="allow-voice-notes"
                      checked={settings.allowVoiceNotes}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, allowVoiceNotes: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="allow-annotations" className="text-sm">
                      Allow annotations
                    </Label>
                    <Switch
                      id="allow-annotations"
                      checked={settings.allowAnnotations}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, allowAnnotations: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="conflict-highlighting" className="text-sm">
                      Highlight voting conflicts
                    </Label>
                    <Switch
                      id="conflict-highlighting"
                      checked={settings.conflictHighlighting}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, conflictHighlighting: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="session-recording" className="text-sm">
                      Enable session recording
                    </Label>
                    <Switch
                      id="session-recording"
                      checked={settings.enableSessionRecording}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, enableSessionRecording: checked })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || selectedUploadIds.length === 0}
            className="gap-2"
          >
            {isCreating ? (
              <>
                <span className="animate-spin">...</span>
                Creating...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Start Session ({selectedUploadIds.length} items)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateSessionModal;
