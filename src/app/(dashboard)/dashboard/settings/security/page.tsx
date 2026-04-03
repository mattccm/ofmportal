"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Key,
  Lock,
  Unlock,
  Smartphone,
  Monitor,
  Globe,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  RefreshCw,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ArrowLeft,
  Download,
  QrCode,
  KeyRound,
  History,
  Laptop,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
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
import { RevokeConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SessionList, type SessionData } from "@/components/security/session-card";
import { SessionTimeoutWarning } from "@/components/security/session-timeout-warning";
import { TrustedDevices } from "@/components/security/trusted-devices";

// Types
interface Session {
  id: string;
  sessionToken: string;
  current: boolean;
  device: string;
  browser: string;
  os: string;
  ip: string;
  location: string;
  lastActive: string;
  createdAt: string;
}

interface SecurityLog {
  id: string;
  action: string;
  description: string;
  entityType: string;
  entityId: string;
  ipAddress: string;
  userAgent: string;
  device: { browser: string; os: string };
  timestamp: string;
  success: boolean;
}

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
}

// Password strength calculator
function calculatePasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;

  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;

  if (score <= 2) return { score, label: "Weak", color: "bg-red-500" };
  if (score <= 4) return { score, label: "Fair", color: "bg-yellow-500" };
  if (score <= 5) return { score, label: "Good", color: "bg-blue-500" };
  return { score, label: "Strong", color: "bg-green-500" };
}

export default function SecuritySettingsPage() {
  const { data: session, update: updateSession } = useSession();

  // State
  const [isLoading, setIsLoading] = React.useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = React.useState(false);
  const [lastPasswordChange, setLastPasswordChange] = React.useState<string | null>(null);
  const [sessions, setSessions] = React.useState<Session[]>([]);
  const [securityLogs, setSecurityLogs] = React.useState<SecurityLog[]>([]);
  const [apiKeys, setApiKeys] = React.useState<ApiKey[]>([]);
  const [backupCodesStatus, setBackupCodesStatus] = React.useState<{
    hasBackupCodes: boolean;
    remainingCodes: number;
    generatedAt?: string;
  } | null>(null);

  // Dialog states
  const [show2FASetupDialog, setShow2FASetupDialog] = React.useState(false);
  const [show2FADisableDialog, setShow2FADisableDialog] = React.useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = React.useState(false);
  const [showBackupCodesDialog, setShowBackupCodesDialog] = React.useState(false);
  const [showApiKeyDialog, setShowApiKeyDialog] = React.useState(false);
  const [showNewApiKeyDialog, setShowNewApiKeyDialog] = React.useState(false);
  const [showRevokeApiKeyDialog, setShowRevokeApiKeyDialog] = React.useState(false);
  const [apiKeyToRevoke, setApiKeyToRevoke] = React.useState<ApiKey | null>(null);
  const [isRevokingApiKey, setIsRevokingApiKey] = React.useState(false);

  // Form states
  const [twoFASetupData, setTwoFASetupData] = React.useState<{
    secret: string;
    qrCode: string;
  } | null>(null);
  const [twoFACode, setTwoFACode] = React.useState("");
  const [disablePassword, setDisablePassword] = React.useState("");
  const [passwordForm, setPasswordForm] = React.useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = React.useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [newApiKeyForm, setNewApiKeyForm] = React.useState({
    name: "",
    expiresIn: "90d",
  });
  const [newApiKey, setNewApiKey] = React.useState<string | null>(null);
  const [backupCodes, setBackupCodes] = React.useState<string[]>([]);
  const [backupCodesPassword, setBackupCodesPassword] = React.useState("");

  // Loading states
  const [isSettingUp2FA, setIsSettingUp2FA] = React.useState(false);
  const [isVerifying2FA, setIsVerifying2FA] = React.useState(false);
  const [isDisabling2FA, setIsDisabling2FA] = React.useState(false);
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);
  const [isGeneratingBackupCodes, setIsGeneratingBackupCodes] = React.useState(false);
  const [isCreatingApiKey, setIsCreatingApiKey] = React.useState(false);
  const [isTerminatingSession, setIsTerminatingSession] = React.useState<string | null>(null);
  const [isTerminatingAll, setIsTerminatingAll] = React.useState(false);

  // Track session metadata on page load
  React.useEffect(() => {
    // Update session metadata when page loads
    fetch("/api/auth/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }).catch(() => {
      // Silently fail - not critical
    });
  }, []);

  // Extend session callback for timeout warning
  const handleExtendSession = React.useCallback(async () => {
    await fetch("/api/auth/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  }, []);

  // Fetch initial data
  React.useEffect(() => {
    async function fetchData() {
      try {
        const [passwordRes, sessionsRes, logsRes, apiKeysRes, backupRes] = await Promise.all([
          fetch("/api/auth/password"),
          fetch("/api/auth/sessions"),
          fetch("/api/auth/security-logs?limit=20"),
          fetch("/api/auth/api-keys"),
          fetch("/api/auth/2fa/backup-codes"),
        ]);

        if (passwordRes.ok) {
          const data = await passwordRes.json();
          setLastPasswordChange(data.lastChanged);
        }

        if (sessionsRes.ok) {
          const data = await sessionsRes.json();
          setSessions(data.sessions || []);
        }

        if (logsRes.ok) {
          const data = await logsRes.json();
          setSecurityLogs(data.logs || []);
        }

        if (apiKeysRes.ok) {
          const data = await apiKeysRes.json();
          setApiKeys(data.keys || []);
        }

        if (backupRes.ok) {
          const data = await backupRes.json();
          setBackupCodesStatus(data);
          setTwoFactorEnabled(data.twoFactorEnabled || false);
        }
      } catch (error) {
        console.error("Error fetching security data:", error);
        toast.error("Failed to load security settings");
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  // 2FA Setup
  const handleSetup2FA = async () => {
    setIsSettingUp2FA(true);
    try {
      const response = await fetch("/api/auth/2fa/setup", { method: "POST" });
      if (!response.ok) throw new Error("Failed to setup 2FA");

      const data = await response.json();
      setTwoFASetupData({ secret: data.secret, qrCode: data.qrCode });
      setShow2FASetupDialog(true);
    } catch (error) {
      toast.error("Failed to setup 2FA");
    } finally {
      setIsSettingUp2FA(false);
    }
  };

  const handleVerify2FA = async () => {
    if (twoFACode.length !== 6) {
      toast.error("Please enter a 6-digit code");
      return;
    }

    setIsVerifying2FA(true);
    try {
      const response = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: twoFACode }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Invalid code");
      }

      setTwoFactorEnabled(true);
      setShow2FASetupDialog(false);
      setTwoFACode("");
      setTwoFASetupData(null);
      await updateSession({ twoFactorEnabled: true });
      toast.success("Two-factor authentication enabled!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to verify code");
    } finally {
      setIsVerifying2FA(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!disablePassword) {
      toast.error("Please enter your password");
      return;
    }

    setIsDisabling2FA(true);
    try {
      const response = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePassword }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to disable 2FA");
      }

      setTwoFactorEnabled(false);
      setShow2FADisableDialog(false);
      setDisablePassword("");
      await updateSession({ twoFactorEnabled: false });
      toast.success("Two-factor authentication disabled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to disable 2FA");
    } finally {
      setIsDisabling2FA(false);
    }
  };

  // Password Change
  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await fetch("/api/auth/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordForm),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to change password");
      }

      const data = await response.json();
      setLastPasswordChange(data.lastChanged);
      setShowPasswordDialog(false);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success("Password changed successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Backup Codes
  const handleGenerateBackupCodes = async () => {
    if (!backupCodesPassword) {
      toast.error("Please enter your password");
      return;
    }

    setIsGeneratingBackupCodes(true);
    try {
      const response = await fetch("/api/auth/2fa/backup-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: backupCodesPassword }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate backup codes");
      }

      const data = await response.json();
      setBackupCodes(data.codes);
      setBackupCodesStatus({
        hasBackupCodes: true,
        remainingCodes: data.codes.length,
        generatedAt: data.generatedAt,
      });
      setBackupCodesPassword("");
      toast.success("Backup codes generated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate backup codes");
    } finally {
      setIsGeneratingBackupCodes(false);
    }
  };

  const downloadBackupCodes = () => {
    const content = backupCodes.join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  // API Keys
  const handleCreateApiKey = async () => {
    if (!newApiKeyForm.name.trim()) {
      toast.error("Please enter a name for the API key");
      return;
    }

    setIsCreatingApiKey(true);
    try {
      const response = await fetch("/api/auth/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newApiKeyForm),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create API key");
      }

      const data = await response.json();
      setNewApiKey(data.key.apiKey);
      setApiKeys((prev) => [...prev, {
        id: data.key.id,
        name: data.key.name,
        prefix: data.key.prefix,
        createdAt: data.key.createdAt,
        expiresAt: data.key.expiresAt,
        lastUsedAt: null,
      }]);
      setShowApiKeyDialog(false);
      setShowNewApiKeyDialog(true);
      setNewApiKeyForm({ name: "", expiresIn: "90d" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create API key");
    } finally {
      setIsCreatingApiKey(false);
    }
  };

  const handleRevokeApiKey = async () => {
    if (!apiKeyToRevoke) return;

    setIsRevokingApiKey(true);
    try {
      const response = await fetch("/api/auth/api-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId: apiKeyToRevoke.id }),
      });

      if (!response.ok) throw new Error("Failed to revoke API key");

      setApiKeys((prev) => prev.filter((key) => key.id !== apiKeyToRevoke.id));
      setShowRevokeApiKeyDialog(false);
      setApiKeyToRevoke(null);
      toast.success("API key revoked");
    } catch (error) {
      toast.error("Failed to revoke API key");
    } finally {
      setIsRevokingApiKey(false);
    }
  };

  const openRevokeApiKeyDialog = (key: ApiKey) => {
    setApiKeyToRevoke(key);
    setShowRevokeApiKeyDialog(true);
  };

  // Session Management
  const handleTerminateSession = async (sessionId: string) => {
    setIsTerminatingSession(sessionId);
    try {
      const response = await fetch("/api/auth/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) throw new Error("Failed to terminate session");

      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      toast.success("Session terminated");
    } catch (error) {
      toast.error("Failed to terminate session");
    } finally {
      setIsTerminatingSession(null);
    }
  };

  const handleTerminateAllSessions = async () => {
    setIsTerminatingAll(true);
    try {
      const response = await fetch("/api/auth/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terminateAll: true }),
      });

      if (!response.ok) throw new Error("Failed to terminate sessions");

      // Keep only the current session in UI
      setSessions((prev) => prev.filter((s) => s.current));
      toast.success("All other sessions terminated");
    } catch (error) {
      toast.error("Failed to terminate sessions");
    } finally {
      setIsTerminatingAll(false);
    }
  };

  // Copy to clipboard - handled by CopyButton component

  // Password strength
  const passwordStrength = calculatePasswordStrength(passwordForm.newPassword);

  // Format date
  const formatDate = (date: string | null | undefined) => {
    if (!date) return "Never";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading security settings...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Session Timeout Warning */}
      <SessionTimeoutWarning
        warningTime={5 * 60 * 1000} // 5 minutes warning
        sessionTimeout={30 * 60 * 1000} // 30 minutes total
        onExtendSession={handleExtendSession}
        enabled={true}
      />

      <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
        {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/dashboard/settings/profile">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 flex items-center justify-center">
            <Shield className="h-6 w-6 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Security Settings</h1>
            <p className="text-muted-foreground">
              Manage your account security and authentication
            </p>
          </div>
        </div>
      </div>

      {/* Security Overview */}
      <Card className="card-elevated overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-500" />
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                twoFactorEnabled ? "bg-emerald-500/10" : "bg-amber-500/10"
              }`}>
                {twoFactorEnabled ? (
                  <ShieldCheck className="h-6 w-6 text-emerald-500" />
                ) : (
                  <ShieldAlert className="h-6 w-6 text-amber-500" />
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Two-Factor Auth</p>
                <p className="font-semibold">
                  {twoFactorEnabled ? "Enabled" : "Not Enabled"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Key className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Password Changed</p>
                <p className="font-semibold text-sm">
                  {lastPasswordChange ? formatDate(lastPasswordChange) : "Unknown"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Monitor className="h-6 w-6 text-violet-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Sessions</p>
                <p className="font-semibold">{sessions.length} devices</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="authentication" className="space-y-6">
        <TabsList variant="line">
          <TabsTrigger value="authentication">
            <Lock className="h-4 w-4 mr-2" />
            Authentication
          </TabsTrigger>
          <TabsTrigger value="sessions">
            <Laptop className="h-4 w-4 mr-2" />
            Sessions
          </TabsTrigger>
          <TabsTrigger value="logs">
            <History className="h-4 w-4 mr-2" />
            Security Log
          </TabsTrigger>
          <TabsTrigger value="api-keys">
            <KeyRound className="h-4 w-4 mr-2" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="trusted-devices">
            <Smartphone className="h-4 w-4 mr-2" />
            Trusted Devices
          </TabsTrigger>
        </TabsList>

        {/* Authentication Tab */}
        <TabsContent value="authentication" className="space-y-6">
          {/* Two-Factor Authentication */}
          <Card className="card-elevated">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                    twoFactorEnabled ? "bg-emerald-500/10" : "bg-muted"
                  }`}>
                    <Smartphone className={`h-5 w-5 ${
                      twoFactorEnabled ? "text-emerald-500" : "text-muted-foreground"
                    }`} />
                  </div>
                  <div>
                    <CardTitle>Two-Factor Authentication</CardTitle>
                    <CardDescription>
                      Add an extra layer of security to your account
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={twoFactorEnabled ? "default" : "secondary"}>
                  {twoFactorEnabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Two-factor authentication adds an extra layer of security by requiring
                a verification code from your authenticator app in addition to your password.
              </p>

              <div className="flex flex-wrap gap-3">
                {twoFactorEnabled ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setShowBackupCodesDialog(true)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Backup Codes
                      {backupCodesStatus?.remainingCodes !== undefined && (
                        <Badge variant="secondary" className="ml-2">
                          {backupCodesStatus.remainingCodes} remaining
                        </Badge>
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setShow2FADisableDialog(true)}
                    >
                      <Unlock className="h-4 w-4 mr-2" />
                      Disable 2FA
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={handleSetup2FA}
                    disabled={isSettingUp2FA}
                    className="btn-gradient"
                  >
                    {isSettingUp2FA ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 mr-2" />
                    )}
                    Enable 2FA
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Password Management */}
          <Card className="card-elevated">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Key className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <CardTitle>Password</CardTitle>
                  <CardDescription>
                    Manage your account password
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Last password change</p>
                    <p className="text-sm text-muted-foreground">
                      {lastPasswordChange ? formatDate(lastPasswordChange) : "Unknown"}
                    </p>
                  </div>
                </div>
                <Button onClick={() => setShowPasswordDialog(true)}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Change Password
                </Button>
              </div>

              <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-500">Password recommendations</p>
                    <ul className="mt-2 space-y-1 text-muted-foreground">
                      <li>Use at least 12 characters</li>
                      <li>Include uppercase and lowercase letters</li>
                      <li>Include numbers and special characters</li>
                      <li>Avoid using personal information</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="space-y-6">
          <Card className="card-elevated">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <Monitor className="h-5 w-5 text-violet-500" />
                </div>
                <div>
                  <CardTitle>Active Sessions</CardTitle>
                  <CardDescription>
                    Manage devices where you are logged in. Each session shows the
                    device, browser, and location based on IP address.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <SessionList
                sessions={sessions as SessionData[]}
                onRevokeSession={handleTerminateSession}
                onRevokeAllOther={handleTerminateAllSessions}
                isRevokingAll={isTerminatingAll}
                revokingSessionId={isTerminatingSession}
              />

              {/* Privacy Notice */}
              <div className="mt-6 p-4 rounded-xl border border-muted bg-muted/30">
                <div className="flex gap-3">
                  <Shield className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Privacy Notice</p>
                    <p className="mt-1">
                      IP addresses are partially masked for privacy. Location data is
                      approximate and based on your IP address. We do not store exact
                      GPS coordinates or precise location information.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Log Tab */}
        <TabsContent value="logs" className="space-y-6">
          <Card className="card-elevated">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <History className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <CardTitle>Security Activity</CardTitle>
                  <CardDescription>
                    Recent security-related events on your account
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {securityLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No security events found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {securityLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">
                          {log.description}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {log.ipAddress}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {log.device.browser} / {log.device.os}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(log.timestamp)}
                        </TableCell>
                        <TableCell>
                          {log.success ? (
                            <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Success
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-500 border-red-500/30">
                              <XCircle className="h-3 w-3 mr-1" />
                              Failed
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="api-keys" className="space-y-6">
          <Card className="card-elevated">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <KeyRound className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <CardTitle>API Keys</CardTitle>
                    <CardDescription>
                      Manage API keys for programmatic access
                    </CardDescription>
                  </div>
                </div>
                <Button onClick={() => setShowApiKeyDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create API Key
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {apiKeys.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <KeyRound className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No API keys created</p>
                  <p className="text-sm mt-1">
                    Create an API key to access the API programmatically
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Key</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeys.map((key) => (
                      <TableRow key={key.id}>
                        <TableCell className="font-medium">{key.name}</TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {key.prefix}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(key.createdAt)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {key.expiresAt ? formatDate(key.expiresAt) : "Never"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {key.lastUsedAt ? formatDate(key.lastUsedAt) : "Never"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openRevokeApiKeyDialog(key)}
                            className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trusted Devices Tab */}
        <TabsContent value="trusted-devices" className="space-y-6">
          <TrustedDevices />
        </TabsContent>
      </Tabs>

      {/* 2FA Setup Dialog */}
      <Dialog open={show2FASetupDialog} onOpenChange={setShow2FASetupDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              Set Up Two-Factor Authentication
            </DialogTitle>
            <DialogDescription>
              Scan the QR code with your authenticator app and enter the verification code.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* QR Code */}
            {twoFASetupData?.qrCode && (
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-white rounded-xl">
                  <Image
                    src={twoFASetupData.qrCode}
                    alt="2FA QR Code"
                    width={200}
                    height={200}
                    className="rounded"
                  />
                </div>

                <div className="w-full">
                  <Label className="text-xs text-muted-foreground">
                    Or enter this code manually:
                  </Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 p-2 bg-muted rounded font-mono text-sm break-all">
                      {twoFASetupData.secret}
                    </code>
                    <CopyButton
                      value={twoFASetupData.secret}
                      variant="ghost"
                      size="sm"
                      onCopySuccess={() => toast.success("Secret copied to clipboard")}
                    />
                  </div>
                </div>
              </div>
            )}

            <Separator />

            {/* Verification Code Input */}
            <div className="space-y-2">
              <Label htmlFor="2fa-code">Verification Code</Label>
              <Input
                id="2fa-code"
                placeholder="000000"
                value={twoFACode}
                onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="text-center text-2xl tracking-[0.5em] font-mono"
                maxLength={6}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShow2FASetupDialog(false);
                setTwoFACode("");
                setTwoFASetupData(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleVerify2FA}
              disabled={twoFACode.length !== 6 || isVerifying2FA}
              className="btn-gradient"
            >
              {isVerifying2FA ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4 mr-2" />
              )}
              Verify & Enable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2FA Disable Dialog */}
      <Dialog open={show2FADisableDialog} onOpenChange={setShow2FADisableDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Disable Two-Factor Authentication
            </DialogTitle>
            <DialogDescription>
              This will remove the extra layer of security from your account.
              Enter your password to confirm.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="disable-password">Password</Label>
              <Input
                id="disable-password"
                type="password"
                placeholder="Enter your password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShow2FADisableDialog(false);
                setDisablePassword("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisable2FA}
              disabled={!disablePassword || isDisabling2FA}
            >
              {isDisabling2FA ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Unlock className="h-4 w-4 mr-2" />
              )}
              Disable 2FA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              Change Password
            </DialogTitle>
            <DialogDescription>
              Choose a strong, unique password to protect your account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Current Password */}
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showPasswords.current ? "text" : "password"}
                  placeholder="Enter current password"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))
                  }
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() =>
                    setShowPasswords((prev) => ({ ...prev, current: !prev.current }))
                  }
                >
                  {showPasswords.current ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPasswords.new ? "text" : "password"}
                  placeholder="Enter new password"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))
                  }
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() =>
                    setShowPasswords((prev) => ({ ...prev, new: !prev.new }))
                  }
                >
                  {showPasswords.new ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Password Strength Indicator */}
              {passwordForm.newPassword && (
                <div className="space-y-2">
                  <div className="flex gap-1">
                    {[...Array(7)].map((_, i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full ${
                          i < passwordStrength.score
                            ? passwordStrength.color
                            : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs ${
                    passwordStrength.label === "Weak" ? "text-red-500" :
                    passwordStrength.label === "Fair" ? "text-yellow-500" :
                    passwordStrength.label === "Good" ? "text-blue-500" :
                    "text-green-500"
                  }`}>
                    Password strength: {passwordStrength.label}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showPasswords.confirm ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                  }
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() =>
                    setShowPasswords((prev) => ({ ...prev, confirm: !prev.confirm }))
                  }
                >
                  {showPasswords.confirm ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {passwordForm.confirmPassword &&
                passwordForm.newPassword !== passwordForm.confirmPassword && (
                  <p className="text-xs text-red-500">Passwords don&apos;t match</p>
                )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPasswordDialog(false);
                setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={
                !passwordForm.currentPassword ||
                !passwordForm.newPassword ||
                passwordForm.newPassword !== passwordForm.confirmPassword ||
                isChangingPassword
              }
              className="btn-gradient"
            >
              {isChangingPassword ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Key className="h-4 w-4 mr-2" />
              )}
              Change Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backup Codes Dialog */}
      <Dialog open={showBackupCodesDialog} onOpenChange={setShowBackupCodesDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Backup Codes
            </DialogTitle>
            <DialogDescription>
              {backupCodes.length > 0
                ? "Save these backup codes in a safe place. Each code can only be used once."
                : "Generate backup codes to use when you don't have access to your authenticator app."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {backupCodes.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-xl font-mono text-sm">
                  {backupCodes.map((code, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-muted-foreground">{i + 1}.</span>
                      <span>{code}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <CopyButton
                    value={backupCodes.join("\n")}
                    variant="outline"
                    label="Copy All"
                    showIcon
                    className="flex-1"
                    onCopySuccess={() => toast.success("Backup codes copied to clipboard")}
                  />
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={downloadBackupCodes}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>

                <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
                  <div className="flex gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      These codes will only be shown once. Make sure to save them now.
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                {backupCodesStatus?.hasBackupCodes && (
                  <div className="p-4 rounded-xl bg-muted/50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Remaining codes</span>
                      <Badge variant="secondary">{backupCodesStatus.remainingCodes}</Badge>
                    </div>
                    {backupCodesStatus.generatedAt && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Generated: {formatDate(backupCodesStatus.generatedAt)}
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="backup-password">Enter your password to generate new codes</Label>
                  <Input
                    id="backup-password"
                    type="password"
                    placeholder="Enter your password"
                    value={backupCodesPassword}
                    onChange={(e) => setBackupCodesPassword(e.target.value)}
                  />
                </div>

                <Button
                  onClick={handleGenerateBackupCodes}
                  disabled={!backupCodesPassword || isGeneratingBackupCodes}
                  className="w-full btn-gradient"
                >
                  {isGeneratingBackupCodes ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Generate New Backup Codes
                </Button>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setShowBackupCodesDialog(false);
                setBackupCodes([]);
                setBackupCodesPassword("");
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create API Key Dialog */}
      <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Create API Key
            </DialogTitle>
            <DialogDescription>
              Create a new API key for programmatic access to your account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="api-key-name">Name</Label>
              <Input
                id="api-key-name"
                placeholder="e.g., Production Server"
                value={newApiKeyForm.name}
                onChange={(e) =>
                  setNewApiKeyForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-key-expires">Expiration</Label>
              <Select
                value={newApiKeyForm.expiresIn}
                onValueChange={(value) =>
                  setNewApiKeyForm((prev) => ({ ...prev, expiresIn: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30d">30 days</SelectItem>
                  <SelectItem value="90d">90 days</SelectItem>
                  <SelectItem value="1y">1 year</SelectItem>
                  <SelectItem value="never">Never</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowApiKeyDialog(false);
                setNewApiKeyForm({ name: "", expiresIn: "90d" });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateApiKey}
              disabled={!newApiKeyForm.name.trim() || isCreatingApiKey}
              className="btn-gradient"
            >
              {isCreatingApiKey ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New API Key Display Dialog */}
      <Dialog open={showNewApiKeyDialog} onOpenChange={setShowNewApiKeyDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-500">
              <CheckCircle2 className="h-5 w-5" />
              API Key Created
            </DialogTitle>
            <DialogDescription>
              Make sure to copy your API key now. You won&apos;t be able to see it again!
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <code className="flex-1 p-3 bg-muted rounded-lg font-mono text-sm break-all">
                {newApiKey}
              </code>
              <CopyButton
                value={newApiKey || ""}
                variant="outline"
                onCopySuccess={() => toast.success("API key copied to clipboard")}
              />
            </div>

            <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
              <div className="flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  This is the only time you&apos;ll see this API key. Store it securely.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setShowNewApiKeyDialog(false);
                setNewApiKey(null);
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke API Key Confirmation Dialog */}
      <RevokeConfirmDialog
        open={showRevokeApiKeyDialog}
        onOpenChange={(open) => {
          setShowRevokeApiKeyDialog(open);
          if (!open) setApiKeyToRevoke(null);
        }}
        itemName={apiKeyToRevoke?.name}
        itemType="API key"
        loading={isRevokingApiKey}
        onConfirm={handleRevokeApiKey}
      />
    </div>
    </>
  );
}
