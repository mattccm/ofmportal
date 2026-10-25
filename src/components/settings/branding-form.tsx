"use client";

import * as React from "react";
import { useState, useCallback, useEffect } from "react";
import { Upload, X, RotateCcw, Save, Loader2, Eye, Palette, Mail, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
import { toast } from "sonner";
import {
  DEFAULT_BRANDING,
  type BrandingSettings,
} from "@/lib/branding";
import { useAutosave } from "@/hooks/use-autosave";
import { SaveStatusBar } from "@/components/forms/autosave-indicator";
import { RecoveryDialog } from "@/components/forms/recovery-dialog";
import { clearFormData } from "@/lib/form-storage";

interface BrandingFormProps {
  initialBranding?: BrandingSettings;
  agencyName?: string;
  onSave?: (branding: BrandingSettings) => Promise<void>;
}

const FORM_ID = "branding-settings-form";

/** Emails use dark ink for headers and buttons (see src/lib/email.ts) */
const EMAIL_INK = "#0e0f12";

// Logo Upload Component
function LogoUpload({
  label,
  value,
  onChange,
  description,
  variant = "light",
  assetType,
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  description?: string;
  variant?: "light" | "dark";
  assetType: "logoLight" | "logoDark" | "logoFavicon";
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/svg+xml", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Please use JPG, PNG, SVG, or WebP.");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 2MB.");
      return;
    }

    setIsUploading(true);

    try {
      // Upload to storage so we keep a hosted URL, not a base64 data URI
      // (data URIs bloat every branded email and portal load)
      const fd = new FormData();
      fd.append("file", file);
      fd.append("assetType", assetType);
      const res = await fetch("/api/agency/branding", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || "Failed to upload logo");
        return;
      }
      onChange(json.url);
    } catch {
      toast.error("Failed to upload logo");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const bgColor = variant === "dark" ? "bg-slate-800" : "bg-white";
  const borderColor = variant === "dark" ? "border-slate-600" : "border-border";

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div
        className={cn(
          "relative rounded-xl border-2 border-dashed p-4 transition-all",
          borderColor,
          isDragging && "border-primary bg-primary/5",
          "hover:border-primary/50"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/svg+xml,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
            e.target.value = "";
          }}
        />

        {value ? (
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "relative w-24 h-16 rounded-lg flex items-center justify-center p-2",
                bgColor
              )}
            >
              <img
                src={value}
                alt="Logo preview"
                className="max-w-full max-h-full object-contain"
              />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Logo uploaded</p>
              <p className="text-xs text-muted-foreground">
                Click to replace or drag a new file
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Replace
              </Button>
              <Button aria-label={`Remove ${label}`}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(null)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center py-4 cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? (
              <Loader2 className="h-8 w-8 text-muted-foreground animate-spin mb-2" />
            ) : (
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            )}
            <p className="text-sm font-medium text-foreground">
              {isUploading ? "Uploading..." : "Upload logo"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Drag and drop or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              JPG, PNG, SVG or WebP (max 2MB)
            </p>
          </div>
        )}
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

// Portal Preview Component
function PortalPreview({
  branding,
  agencyName,
}: {
  branding: BrandingSettings;
  agencyName?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-ground">
      {/* Preview Header */}
      <div className="border-b border-line bg-ground px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {branding.logoLight ? (
              <img
                src={branding.logoLight}
                alt="Logo"
                className="h-8 w-auto object-contain"
              />
            ) : (
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-semibold text-sm"
                style={{
                  background: BRAND.secondaryColor,
                }}
              >
                {agencyName?.charAt(0) || "A"}
              </div>
            )}
            <div>
              <p
                className="font-semibold text-sm"
                style={{ color: BRAND.inkColor }}
              >
                {branding.portalTitle || BRAND.productName}
              </p>
              <p className="text-xs text-muted-foreground">
                {agencyName || "Your Agency"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-muted" />
          </div>
        </div>
      </div>

      {/* Preview Content */}
      <div className="p-4 space-y-4">
        {/* Welcome Banner */}
        <div
          className="rounded-xl p-4 text-ink"
          style={{
            background: BRAND.secondaryColor,
          }}
        >
          <p className="text-xs opacity-80">Welcome back</p>
          <p className="font-semibold">Creator Name</p>
          <p className="text-sm opacity-90 mt-1">
            {branding.welcomeMessage || "Welcome to your content portal"}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-lg bg-tile p-3"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg opacity-20"
                  style={{ backgroundColor: BRAND.inkColor }}
                />
                <div>
                  <p className="text-xs text-muted-foreground">Stat {i}</p>
                  <p className="font-semibold text-sm">12</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Button Preview */}
        <div className="flex gap-2">
          <button
            className="flex-1 px-3 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: BRAND.primaryColor, color: BRAND.primaryInk }}
          >
            Primary Button
          </button>
          <button
            className="flex-1 px-3 py-2 rounded-lg text-sm font-medium border"
            style={{
              borderColor: "#3c4049",
              color: BRAND.inkColor,
            }}
          >
            Secondary
          </button>
        </div>
      </div>

      {/* Preview Label */}
      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/50 text-white text-[12px] font-medium">
        Preview
      </div>
    </div>
  );
}

// Email Preview Component
function EmailPreview({
  branding,
  agencyName,
}: {
  branding: BrandingSettings;
  agencyName?: string;
}) {
  return (
    <div className="rounded-xl border overflow-hidden bg-white">
      {/* Brand accent bar */}
      
      {/* Email Header (light, logo or agency name) */}
      <div className="px-6 py-4 border-b border-slate-100">
        {branding.logoLight && branding.emailLogoEnabled ? (
          <img
            src={branding.logoLight}
            alt="Logo"
            className="h-8 w-auto object-contain"
          />
        ) : (
          <p
            className="text-lg font-bold"
            style={{ color: EMAIL_INK }}
          >
            {branding.emailFromName || agencyName || BRAND.name}
          </p>
        )}
      </div>

      {/* Email Body */}
      <div className="px-6 py-5 space-y-3">
        <p className="text-lg font-bold text-slate-900">
          New content request
        </p>
        <p className="text-sm text-slate-600">Hi Creator,</p>
        <p className="text-sm text-slate-600">
          You have a new content request waiting for you. Open your portal to
          view the details and upload your content.
        </p>
        <div className="pt-1">
          <button
            className="px-6 py-2.5 rounded-lg text-sm font-semibold"
            style={{
              backgroundColor: EMAIL_INK,
              color: "#ffffff",
            }}
          >
            View request
          </button>
        </div>
      </div>

      {/* Email Footer */}
      <div className="px-6 py-3 border-t border-slate-100 bg-slate-50">
        <p className="text-xs text-slate-500">
          {branding.emailSignature || `Sent by ${agencyName || "your agency"}`}
        </p>
      </div>

      {/* Preview Label */}
      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/50 text-white text-[12px] font-medium">
        Preview
      </div>
    </div>
  );
}

// Main Branding Form Component
export function BrandingForm({
  initialBranding,
  agencyName,
  onSave,
}: BrandingFormProps) {
  const [branding, setBranding] = useState<BrandingSettings>(
    initialBranding || DEFAULT_BRANDING
  );
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);

  // Autosave hook
  const {
    status: autosaveStatus,
    lastSavedAt,
    hasRecoverableData,
    recoverableData,
    recover,
    dismissRecovery,
  } = useAutosave({
    formId: FORM_ID,
    data: branding,
    enabled: true,
    debounceMs: 1500,
  });

  // Show recovery dialog when recoverable data exists
  useEffect(() => {
    if (hasRecoverableData && recoverableData) {
      setShowRecoveryDialog(true);
    }
  }, [hasRecoverableData, recoverableData]);

  // Handle recovery restore
  const handleRestore = () => {
    const restored = recover();
    if (restored) {
      setBranding(restored as BrandingSettings);
      toast.success("Previous branding restored");
    }
    setShowRecoveryDialog(false);
  };

  // Handle recovery discard
  const handleDiscard = () => {
    dismissRecovery();
    setShowRecoveryDialog(false);
    toast.info("Discarded saved branding");
  };

  // Track changes
  useEffect(() => {
    if (initialBranding) {
      const changed = JSON.stringify(branding) !== JSON.stringify(initialBranding);
      setHasChanges(changed);
    }
  }, [branding, initialBranding]);

  // Update a single field
  const updateField = useCallback(<K extends keyof BrandingSettings>(
    field: K,
    value: BrandingSettings[K]
  ) => {
    setBranding((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Reset to defaults
  const handleReset = useCallback(() => {
    setBranding(DEFAULT_BRANDING);
    toast.info("Branding reset to defaults");
  }, []);

  // Save changes
  const handleSave = async () => {
    if (!onSave) return;

    setIsSaving(true);
    try {
      await onSave(branding);
      setHasChanges(false);
      clearFormData(FORM_ID); // Clear autosaved data on successful submit
      toast.success("Branding saved");
    } catch (error) {
      toast.error("Failed to save branding");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Recovery Dialog */}
      <RecoveryDialog
        open={showRecoveryDialog}
        onOpenChange={setShowRecoveryDialog}
        formName="Branding Settings"
        data={recoverableData}
        onRestore={handleRestore}
        onDiscard={handleDiscard}
        fieldLabels={{
          portalTitle: "Portal Title",
          primaryColor: "Primary Color",
          secondaryColor: "Secondary Color",
          welcomeMessage: "Welcome Message",
        }}
        excludeFields={["logoLight", "logoDark", "logoFavicon"]}
      />

      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Customize Your Brand</h2>
          <p className="text-sm text-muted-foreground">
            Your logos, portal text and email sender
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={isSaving}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      <Tabs defaultValue="appearance" className="space-y-6">
        <TabsList>
          <TabsTrigger value="appearance">
            <Palette className="h-4 w-4 mr-2" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="domain">
            <Globe className="h-4 w-4 mr-2" />
            Domain
          </TabsTrigger>
          <TabsTrigger value="email">
            <Mail className="h-4 w-4 mr-2" />
            Email
          </TabsTrigger>
          <TabsTrigger value="preview">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </TabsTrigger>
        </TabsList>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Logo Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Logos</CardTitle>
                <CardDescription>
                  Upload your agency logo for light and dark modes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <LogoUpload
                  label="Light Mode Logo"
                  value={branding.logoLight}
                  onChange={(v) => updateField("logoLight", v)}
                  description="Used on light backgrounds"
                  variant="light"
                  assetType="logoLight"
                />
                <LogoUpload
                  label="Dark Mode Logo"
                  value={branding.logoDark}
                  onChange={(v) => updateField("logoDark", v)}
                  description="Used on dark backgrounds (optional)"
                  variant="dark"
                  assetType="logoDark"
                />
              </CardContent>
            </Card>

            {/* Colours are pinned: one dark theme */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Colours</CardTitle>
                <CardDescription>
                  The portal uses one dark theme for everyone, so there are no brand colours to pick.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-ink-2">
                <p>
                  Staff and creator screens share the same dark ground, with yellow kept for the one main action and for keyboard
                  focus. Emails use dark ink on white so they read well in every mail app.
                </p>
                <p>Your logos, portal title, welcome message and email sender still apply.</p>
              </CardContent>
            </Card>
          </div>

          {/* Portal Text Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Portal Text</CardTitle>
              <CardDescription>
                Customize the text displayed in your creator portal
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="portalTitle">Portal Title</Label>
                  <Input
                    id="portalTitle"
                    value={branding.portalTitle}
                    onChange={(e) => updateField("portalTitle", e.target.value)}
                    placeholder={BRAND.productName}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="welcomeMessage">Welcome Message</Label>
                  <Input
                    id="welcomeMessage"
                    value={branding.welcomeMessage}
                    onChange={(e) => updateField("welcomeMessage", e.target.value)}
                    placeholder="Welcome to your content portal"
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="supportEmail">Support Email</Label>
                  <Input
                    id="supportEmail"
                    type="email"
                    value={branding.supportEmail || ""}
                    onChange={(e) => updateField("supportEmail", e.target.value || null)}
                    placeholder="support@youragency.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supportUrl">Help/Support URL</Label>
                  <Input
                    id="supportUrl"
                    type="url"
                    value={branding.supportUrl || ""}
                    onChange={(e) => updateField("supportUrl", e.target.value || null)}
                    placeholder="https://help.youragency.com"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Domain Tab */}
        <TabsContent value="domain" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Portal Domain</CardTitle>
              <CardDescription>
                Set up a custom subdomain or your own domain for the creator portal
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="subdomain">Subdomain</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="subdomain"
                    value={branding.subdomain || ""}
                    onChange={(e) =>
                      updateField("subdomain", e.target.value.toLowerCase() || null)
                    }
                    placeholder="myagency"
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground">
                    .uploadportal.com
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your creators will access the portal at{" "}
                  <span className="font-mono">
                    {branding.subdomain || "myagency"}.uploadportal.com
                  </span>
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="customDomain">Custom Domain</Label>
                <Input
                  id="customDomain"
                  value={branding.customDomain || ""}
                  onChange={(e) =>
                    updateField("customDomain", e.target.value.toLowerCase() || null)
                  }
                  placeholder="portal.youragency.com"
                />
                <p className="text-xs text-muted-foreground">
                  Use your own domain for a fully branded experience. Requires DNS
                  configuration.
                </p>
              </div>

              {branding.customDomain && (
                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    DNS Configuration Required
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-300 mt-1">
                    Add a CNAME record pointing {branding.customDomain} to
                    portal.uploadportal.com
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Tab */}
        <TabsContent value="email" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Email Settings</CardTitle>
                <CardDescription>
                  Customize how emails appear to your creators
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="emailFromName">Sender Name</Label>
                  <Input
                    id="emailFromName"
                    value={branding.emailFromName}
                    onChange={(e) => updateField("emailFromName", e.target.value)}
                    placeholder={agencyName || "Your Agency Name"}
                  />
                  <p className="text-xs text-muted-foreground">
                    Shown as the sender on every email your creators receive.
                    Leave blank to use your agency name
                    {agencyName ? ` (${agencyName})` : ""}.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emailReplyTo">Reply-To Email</Label>
                  <Input
                    id="emailReplyTo"
                    type="email"
                    value={branding.emailReplyTo || ""}
                    onChange={(e) =>
                      updateField("emailReplyTo", e.target.value || null)
                    }
                    placeholder="reply@youragency.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emailSignature">Email Signature</Label>
                  <Input
                    id="emailSignature"
                    value={branding.emailSignature}
                    onChange={(e) => updateField("emailSignature", e.target.value)}
                    placeholder={`Sent via ${BRAND.productName}`}
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button aria-label="Show logo in email header"
                    type="button"
                    role="switch"
                    aria-checked={branding.emailLogoEnabled}
                    onClick={() =>
                      updateField("emailLogoEnabled", !branding.emailLogoEnabled)
                    }
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                      branding.emailLogoEnabled
                        ? "bg-primary"
                        : "bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform",
                        branding.emailLogoEnabled
                          ? "translate-x-5"
                          : "translate-x-0"
                      )}
                    />
                  </button>
                  <Label className="cursor-pointer" onClick={() =>
                    updateField("emailLogoEnabled", !branding.emailLogoEnabled)
                  }>
                    Show logo in email header
                  </Label>
                </div>
              </CardContent>
            </Card>

            {/* Email Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Email Preview</CardTitle>
                <CardDescription>
                  How your emails will appear to creators
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EmailPreview branding={branding} agencyName={agencyName} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Portal Preview</CardTitle>
                <CardDescription>
                  See how your branded portal will look to creators
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PortalPreview branding={branding} agencyName={agencyName} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Email preview</CardTitle>
                <CardDescription>Emails use your logo and sender name with dark ink on white.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <EmailPreview branding={branding} agencyName={agencyName} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Floating Save Status Bar */}
      <SaveStatusBar
        status={isSaving ? "saving" : autosaveStatus}
        lastSavedText={lastSavedAt ? new Date(lastSavedAt).toLocaleTimeString() : undefined}
        hasChanges={hasChanges}
      >
        {hasChanges && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} disabled={isSaving}>
              Reset
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        )}
      </SaveStatusBar>
    </div>
  );
}

export default BrandingForm;
