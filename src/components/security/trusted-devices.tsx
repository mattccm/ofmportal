"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Smartphone,
  Monitor,
  Tablet,
  Trash2,
  Loader2,
  ShieldCheck,
  Globe,
  Clock,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { clearRememberToken, isIOSPWA } from "@/lib/remember-token";

interface TrustedDevice {
  id: string;
  deviceName: string | null;
  deviceType: string | null;
  ipAddress: string | null;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  createdAt: string;
  expiresAt: string;
}

function getDeviceIcon(deviceType: string | null) {
  switch (deviceType) {
    case "mobile":
      return Smartphone;
    case "tablet":
      return Tablet;
    default:
      return Monitor;
  }
}

function formatDate(date: string | null | undefined) {
  if (!date) return "Never";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(date: string | null | undefined) {
  if (!date) return "Never";
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  return formatDate(date);
}

export function TrustedDevices() {
  const [devices, setDevices] = React.useState<TrustedDevice[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRevoking, setIsRevoking] = React.useState<string | null>(null);
  const [isRevokingAll, setIsRevokingAll] = React.useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = React.useState(false);
  const [showRevokeAllDialog, setShowRevokeAllDialog] = React.useState(false);
  const [deviceToRevoke, setDeviceToRevoke] = React.useState<TrustedDevice | null>(null);
  const [isCurrentDevicePWA] = React.useState(() => isIOSPWA());

  // Fetch trusted devices
  const fetchDevices = React.useCallback(async () => {
    try {
      const response = await fetch("/api/auth/remember");
      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices || []);
      }
    } catch (error) {
      console.error("Error fetching trusted devices:", error);
      toast.error("Failed to load trusted devices");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // Revoke single device
  const handleRevokeDevice = async () => {
    if (!deviceToRevoke) return;

    setIsRevoking(deviceToRevoke.id);
    try {
      const response = await fetch(`/api/auth/remember?id=${deviceToRevoke.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to revoke device");

      setDevices((prev) => prev.filter((d) => d.id !== deviceToRevoke.id));
      toast.success("Device removed from trusted devices");

      // If this might be the current device, clear local token
      if (isCurrentDevicePWA) {
        await clearRememberToken();
      }
    } catch (error) {
      toast.error("Failed to remove device");
    } finally {
      setIsRevoking(null);
      setShowRevokeDialog(false);
      setDeviceToRevoke(null);
    }
  };

  // Revoke all devices
  const handleRevokeAllDevices = async () => {
    setIsRevokingAll(true);
    try {
      const response = await fetch("/api/auth/remember?all=true", {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to revoke devices");

      const data = await response.json();
      setDevices([]);
      toast.success(`Removed ${data.count} trusted device(s)`);

      // Clear local token since we revoked all
      await clearRememberToken();
    } catch (error) {
      toast.error("Failed to remove devices");
    } finally {
      setIsRevokingAll(false);
      setShowRevokeAllDialog(false);
    }
  };

  const openRevokeDialog = (device: TrustedDevice) => {
    setDeviceToRevoke(device);
    setShowRevokeDialog(true);
  };

  if (isLoading) {
    return (
      <Card className="card-elevated">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="card-elevated">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <CardTitle>Trusted Devices</CardTitle>
                <CardDescription>
                  Devices that can automatically sign you in using &quot;Stay signed in&quot;
                </CardDescription>
              </div>
            </div>
            {devices.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRevokeAllDialog(true)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <div className="text-center py-12">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <Smartphone className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground">No trusted devices</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                When you sign in with &quot;Stay signed in&quot; checked, your device will appear here.
                This is especially useful for mobile apps.
              </p>
              {isCurrentDevicePWA && (
                <div className="mt-4 p-3 rounded-xl border border-primary/20 bg-primary/5 max-w-sm mx-auto">
                  <div className="flex items-center gap-2 text-sm text-primary">
                    <Smartphone className="h-4 w-4" />
                    <span>You&apos;re using the app - sign out and sign back in with &quot;Stay signed in&quot; to enable this feature</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Mobile-friendly card view */}
              <div className="md:hidden space-y-3">
                {devices.map((device) => {
                  const DeviceIcon = getDeviceIcon(device.deviceType);
                  return (
                    <div
                      key={device.id}
                      className="p-4 rounded-xl border bg-card"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                            <DeviceIcon className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {device.deviceName || "Unknown Device"}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <Globe className="h-3 w-3" />
                              <span>{device.ipAddress || "Unknown IP"}</span>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openRevokeDialog(device)}
                          disabled={isRevoking === device.id}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          {isRevoking === device.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>
                            Last used: {formatRelativeTime(device.lastUsedAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop table view */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devices.map((device) => {
                      const DeviceIcon = getDeviceIcon(device.deviceType);
                      return (
                        <TableRow key={device.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                                <DeviceIcon className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">
                                  {device.deviceName || "Unknown Device"}
                                </p>
                                <p className="text-xs text-muted-foreground capitalize">
                                  {device.deviceType || "desktop"}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {device.ipAddress || "Unknown"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatRelativeTime(device.lastUsedAt)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(device.createdAt)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(device.expiresAt)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openRevokeDialog(device)}
                              disabled={isRevoking === device.id}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              {isRevoking === device.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Info notice */}
              <div className="mt-6 p-4 rounded-xl border border-muted bg-muted/30">
                <div className="flex gap-3">
                  <ShieldCheck className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">About Trusted Devices</p>
                    <p className="mt-1">
                      Trusted devices can automatically sign you in without entering your password.
                      This is useful for mobile apps that might lose their session.
                      Remove devices you no longer use or don&apos;t recognize.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Revoke Single Device Dialog */}
      <Dialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Remove Trusted Device
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove &quot;{deviceToRevoke?.deviceName || "this device"}&quot;?
              You&apos;ll need to sign in again on that device.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRevokeDialog(false);
                setDeviceToRevoke(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevokeDevice}
              disabled={isRevoking !== null}
            >
              {isRevoking ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Remove Device
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke All Devices Dialog */}
      <Dialog open={showRevokeAllDialog} onOpenChange={setShowRevokeAllDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Remove All Trusted Devices
            </DialogTitle>
            <DialogDescription>
              This will remove all {devices.length} trusted device(s).
              You&apos;ll need to sign in again on all devices and re-enable &quot;Stay signed in&quot; if desired.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRevokeAllDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevokeAllDevices}
              disabled={isRevokingAll}
            >
              {isRevokingAll ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Remove All Devices
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default TrustedDevices;
