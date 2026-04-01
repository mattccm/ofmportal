"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Link2,
  Copy,
  Check,
  Loader2,
  Eye,
  Download,
  Lock,
  Clock,
  QrCode,
  X,
  ExternalLink,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { EXPIRATION_OPTIONS } from "@/lib/share-types";

type ShareResourceType = "UPLOAD" | "REQUEST" | "REPORT" | "COLLECTION";
type SharePermission = "VIEW" | "DOWNLOAD";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceType: ShareResourceType;
  resourceId: string;
  resourceTitle?: string;
}

interface ExistingShareLink {
  id: string;
  token: string;
  permission: SharePermission;
  hasPassword: boolean;
  expiresAt: string | null;
  viewCount: number;
  isActive: boolean;
  createdAt: string;
}

export function ShareDialog({
  open,
  onOpenChange,
  resourceType,
  resourceId,
  resourceTitle,
}: ShareDialogProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [existingLinks, setExistingLinks] = useState<ExistingShareLink[]>([]);
  const [isLoadingLinks, setIsLoadingLinks] = useState(false);

  // Form state
  const [permission, setPermission] = useState<SharePermission>("VIEW");
  const [enablePassword, setEnablePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [expiration, setExpiration] = useState("7d");

  // Load existing share links
  useEffect(() => {
    if (open) {
      loadExistingLinks();
    } else {
      // Reset state when dialog closes
      setShareUrl(null);
      setCopied(false);
      setShowQR(false);
      setEnablePassword(false);
      setPassword("");
      setPermission("VIEW");
      setExpiration("7d");
    }
  }, [open, resourceType, resourceId]);

  const loadExistingLinks = async () => {
    setIsLoadingLinks(true);
    try {
      const response = await fetch(
        `/api/share?resourceType=${resourceType}&resourceId=${resourceId}`
      );
      if (response.ok) {
        const data = await response.json();
        setExistingLinks(data.links || []);
      }
    } catch (error) {
      console.error("Failed to load existing links:", error);
    } finally {
      setIsLoadingLinks(false);
    }
  };

  const handleCreateLink = async () => {
    if (enablePassword && !password.trim()) {
      toast.error("Please enter a password");
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceType,
          resourceId,
          permission,
          password: enablePassword ? password : undefined,
          expiration,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create share link");
      }

      const data = await response.json();
      setShareUrl(data.url);
      toast.success("Share link created");
      loadExistingLinks();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create share link");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleDeactivateLink = async (linkId: string) => {
    try {
      const response = await fetch(`/api/share/${linkId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to deactivate link");
      }

      toast.success("Share link deactivated");
      loadExistingLinks();
    } catch {
      toast.error("Failed to deactivate link");
    }
  };

  const getResourceTypeLabel = () => {
    switch (resourceType) {
      case "UPLOAD":
        return "file";
      case "REQUEST":
        return "request";
      case "REPORT":
        return "report";
      case "COLLECTION":
        return "collection";
      default:
        return "content";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Share {getResourceTypeLabel()}
          </DialogTitle>
          <DialogDescription>
            {resourceTitle
              ? `Create a shareable link for "${resourceTitle}"`
              : `Create a shareable link for this ${getResourceTypeLabel()}`}
          </DialogDescription>
        </DialogHeader>

        {/* Generated Link Display */}
        {shareUrl && (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-green-800">
                  Share link created
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-green-700 hover:text-green-800"
                  onClick={() => setShowQR(!showQR)}
                >
                  <QrCode className="h-4 w-4 mr-1" />
                  {showQR ? "Hide QR" : "QR Code"}
                </Button>
              </div>
              <div className="flex gap-2">
                <Input
                  value={shareUrl}
                  readOnly
                  className="bg-white text-sm font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  asChild
                  className="shrink-0"
                >
                  <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>

              {/* QR Code */}
              {showQR && (
                <div className="mt-4 flex justify-center">
                  <div className="p-4 bg-white rounded-lg border">
                    <QRCodeDisplay url={shareUrl} />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShareUrl(null);
                  setCopied(false);
                  setShowQR(false);
                }}
              >
                Create Another Link
              </Button>
            </div>
          </div>
        )}

        {/* Create New Link Form */}
        {!shareUrl && (
          <div className="space-y-6">
            {/* Permission Level */}
            <div className="space-y-2">
              <Label>Permission level</Label>
              <Select
                value={permission}
                onValueChange={(value) => setPermission(value as SharePermission)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIEW">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      <span>View only</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="DOWNLOAD">
                    <div className="flex items-center gap-2">
                      <Download className="h-4 w-4 text-muted-foreground" />
                      <span>View and download</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {permission === "VIEW"
                  ? "Recipients can only view the content"
                  : "Recipients can view and download the content"}
              </p>
            </div>

            {/* Expiration */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Link expiration
              </Label>
              <Select value={expiration} onValueChange={setExpiration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRATION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Password Protection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="enable-password"
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  Password protection
                </Label>
                <Switch
                  id="enable-password"
                  checked={enablePassword}
                  onCheckedChange={setEnablePassword}
                />
              </div>
              {enablePassword && (
                <Input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              )}
            </div>

            {/* Create Button */}
            <Button
              onClick={handleCreateLink}
              disabled={isCreating}
              className="w-full"
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Link2 className="mr-2 h-4 w-4" />
                  Create Share Link
                </>
              )}
            </Button>
          </div>
        )}

        {/* Existing Links */}
        {existingLinks.length > 0 && !shareUrl && (
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Active share links
              </h4>
              {isLoadingLinks && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {existingLinks
                .filter((link) => link.isActive)
                .map((link) => (
                  <ExistingLinkItem
                    key={link.id}
                    link={link}
                    onDeactivate={() => handleDeactivateLink(link.id)}
                  />
                ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// QR Code Component
function QRCodeDisplay({ url }: { url: string }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    // Generate QR code using a simple API or library
    const generateQR = async () => {
      try {
        // Use QR code API (fallback to a placeholder)
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}`;
        setQrDataUrl(qrApiUrl);
      } catch {
        console.error("Failed to generate QR code");
      }
    };
    generateQR();
  }, [url]);

  if (!qrDataUrl) {
    return (
      <div className="w-[150px] h-[150px] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={qrDataUrl}
      alt="QR Code"
      width={150}
      height={150}
      className="rounded"
    />
  );
}

// Existing Link Item Component
interface ExistingLinkItemProps {
  link: ExistingShareLink;
  onDeactivate: () => void;
}

function ExistingLinkItem({ link, onDeactivate }: ExistingLinkItemProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/share/${link.token}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const isExpired = link.expiresAt && new Date(link.expiresAt) < new Date();

  return (
    <div
      className={`flex items-center justify-between p-2 rounded-lg border ${
        isExpired ? "bg-gray-50 opacity-60" : "bg-gray-50"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="flex items-center gap-1">
          {link.permission === "VIEW" ? (
            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          {link.hasPassword && (
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-mono truncate text-muted-foreground">
            ...{link.token.slice(-8)}
          </p>
          <p className="text-xs text-muted-foreground">
            {link.viewCount} views
            {isExpired && " (expired)"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleCopy}
          disabled={!!isExpired}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-red-500 hover:text-red-600"
          onClick={onDeactivate}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// Export share button component for easy integration
export function ShareButton({
  resourceType,
  resourceId,
  resourceTitle,
  variant = "outline",
  size = "default",
}: {
  resourceType: ShareResourceType;
  resourceId: string;
  resourceTitle?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "icon" | "icon-sm";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        {size === "icon" || size === "icon-sm" ? (
          <Link2 className="h-4 w-4" />
        ) : (
          <>
            <Link2 className="mr-2 h-4 w-4" />
            Share
          </>
        )}
      </Button>
      <ShareDialog
        open={open}
        onOpenChange={setOpen}
        resourceType={resourceType}
        resourceId={resourceId}
        resourceTitle={resourceTitle}
      />
    </>
  );
}
