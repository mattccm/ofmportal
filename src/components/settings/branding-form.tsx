"use client";

import * as React from "react";
import { useState, useCallback, useEffect } from "react";
import { Camera, Upload, X, RotateCcw, Save, Loader2, Eye, Palette, Mail, Globe, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DEFAULT_BRANDING,
  isValidHexColor,
  hexToHsl,
  getContrastColor,
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

// Color Picker Component
function ColorPicker({
  label,
  value,
  onChange,
  description,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
  description?: string;
}) {
  const [inputValue, setInputValue] = useState(value);
  const [isValid, setIsValid] = useState(true);

  useEffect(() => {
    setInputValue(value);
    setIsValid(true);
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;

    // Add # if missing
    if (newValue && !newValue.startsWith("#")) {
      newValue = "#" + newValue;
    }

    setInputValue(newValue);

    if (isValidHexColor(newValue)) {
      setIsValid(true);
      onChange(newValue);
    } else {
      setIsValid(newValue.length <= 1);
    }
  };

  const handleColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setIsValid(true);
    onChange(newValue);
  };

  const contrastColor = getContrastColor(value);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex items-center gap-3">
        {/* Color preview & picker */}
        <div className="relative">
          <div
            className="w-12 h-12 rounded-xl border-2 border-border shadow-sm cursor-pointer overflow-hidden transition-transform hover:scale-105"
            style={{ backgroundColor: value }}
          >
            <input
              type="color"
              value={value}
              onChange={handleColorPickerChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20">
              <Palette className="h-4 w-4" style={{ color: contrastColor }} />
            </div>
          </div>
        </div>

        {/* Hex input */}
        <div className="flex-1">
          <Input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="#7c3aed"
            className={cn(
              "font-mono uppercase",
              !isValid && "border-destructive focus-visible:ring-destructive/20"
            )}
            maxLength={7}
          />
        </div>
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

// Logo Upload Component
function LogoUpload({
  label,
  value,
  onChange,
  description,
  variant = "light",
}: {
  label: string;
  value: string | null;
  onChange: (base64: string | null) => void;
  description?: string;
  variant?: "light" | "dark";
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
      // Convert to base64
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        onChange(base64);
        setIsUploading(false);
      };
      reader.onerror = () => {
        toast.error("Failed to read file");
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("Failed to process file");
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
              <Button
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
  const primaryHsl = hexToHsl(branding.primaryColor);
  const secondaryHsl = hexToHsl(branding.secondaryColor);

  return (
    <div className="relative rounded-xl border overflow-hidden bg-gradient-to-br from-slate-50 via-white to-violet-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-violet-950/30">
      {/* Preview Header */}
      <div className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm px-4 py-3">
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
                  background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.secondaryColor})`,
                }}
              >
                {agencyName?.charAt(0) || "A"}
              </div>
            )}
            <div>
              <p
                className="font-semibold text-sm"
                style={{ color: branding.primaryColor }}
              >
                {branding.portalTitle || "Creator Portal"}
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
          className="rounded-xl p-4 text-white"
          style={{
            background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.secondaryColor}, ${branding.accentColor})`,
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
              className="rounded-lg border bg-white dark:bg-slate-800 p-3"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg opacity-20"
                  style={{ backgroundColor: branding.primaryColor }}
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
            className="flex-1 px-3 py-2 rounded-lg text-white text-sm font-medium"
            style={{ backgroundColor: branding.primaryColor }}
          >
            Primary Button
          </button>
          <button
            className="flex-1 px-3 py-2 rounded-lg text-sm font-medium border"
            style={{
              borderColor: branding.primaryColor,
              color: branding.primaryColor,
            }}
          >
            Secondary
          </button>
        </div>
      </div>

      {/* Preview Label */}
      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/50 text-white text-[10px] font-medium">
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
    <div className="rounded-xl border overflow-hidden bg-white dark:bg-slate-900">
      {/* Email Header */}
      <div
        className="px-6 py-4"
        style={{ backgroundColor: branding.primaryColor }}
      >
        {branding.logoLight && branding.emailLogoEnabled ? (
          <img
            src={branding.logoLight}
            alt="Logo"
            className="h-8 w-auto object-contain"
          />
        ) : (
          <p className="text-white font-semibold">
            {branding.emailFromName || agencyName || "Upload Portal"}
          </p>
        )}
      </div>

      {/* Email Body */}
      <div className="px-6 py-4 space-y-3">
        <p className="font-semibold text-foreground">
          New Content Request
        </p>
        <p className="text-sm text-muted-foreground">
          Hi Creator,
        </p>
        <p className="text-sm text-muted-foreground">
          You have a new content request waiting for you. Please log in to your
          portal to view the details and upload your content.
        </p>
        <button
          className="px-4 py-2 rounded-lg text-white text-sm font-medium"
          style={{ backgroundColor: branding.primaryColor }}
        >
          View Request
        </button>
      </div>

      {/* Email Footer */}
      <div className="px-6 py-3 border-t bg-muted/30">
        <p className="text-xs text-muted-foreground">
          {branding.emailSignature || "Sent via Upload Portal"}
        </p>
      </div>

      {/* Preview Label */}
      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/50 text-white text-[10px] font-medium">
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
    clearSaved,
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
      toast.success("Branding saved successfully");
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
            Make the portal your own with custom colors and logos
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
            className="btn-gradient"
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
                />
                <LogoUpload
                  label="Dark Mode Logo"
                  value={branding.logoDark}
                  onChange={(v) => updateField("logoDark", v)}
                  description="Used on dark backgrounds (optional)"
                  variant="dark"
                />
              </CardContent>
            </Card>

            {/* Colors Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Brand Colors</CardTitle>
                <CardDescription>
                  Choose colors that match your brand identity
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ColorPicker
                  label="Primary Color"
                  value={branding.primaryColor}
                  onChange={(v) => updateField("primaryColor", v)}
                  description="Main brand color for buttons and highlights"
                />
                <ColorPicker
                  label="Secondary Color"
                  value={branding.secondaryColor}
                  onChange={(v) => updateField("secondaryColor", v)}
                  description="Used for gradients and secondary elements"
                />
                <ColorPicker
                  label="Accent Color"
                  value={branding.accentColor}
                  onChange={(v) => updateField("accentColor", v)}
                  description="Used for special highlights and accents"
                />

                {/* Color Preview Swatches */}
                <div className="pt-2">
                  <Label className="text-sm font-medium mb-2 block">
                    Color Preview
                  </Label>
                  <div className="flex gap-2">
                    <div
                      className="flex-1 h-12 rounded-lg"
                      style={{
                        background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.secondaryColor})`,
                      }}
                    />
                    <div
                      className="w-12 h-12 rounded-lg"
                      style={{ backgroundColor: branding.accentColor }}
                    />
                  </div>
                </div>
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
                    placeholder="Creator Portal"
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
                    placeholder="Your Agency Name"
                  />
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
                    placeholder="Sent via Upload Portal"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
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
                <CardTitle className="text-base">Color System</CardTitle>
                <CardDescription>
                  Your brand colors applied across UI elements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Buttons */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Buttons</Label>
                  <div className="flex gap-2">
                    <button
                      className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                      style={{ backgroundColor: branding.primaryColor }}
                    >
                      Primary
                    </button>
                    <button
                      className="px-4 py-2 rounded-lg text-sm font-medium border"
                      style={{
                        borderColor: branding.primaryColor,
                        color: branding.primaryColor,
                      }}
                    >
                      Outline
                    </button>
                    <button
                      className="px-4 py-2 rounded-lg text-sm font-medium"
                      style={{
                        backgroundColor: `${branding.primaryColor}15`,
                        color: branding.primaryColor,
                      }}
                    >
                      Ghost
                    </button>
                  </div>
                </div>

                {/* Badges */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Badges</Label>
                  <div className="flex gap-2">
                    <span
                      className="px-2 py-1 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: branding.primaryColor }}
                    >
                      Active
                    </span>
                    <span
                      className="px-2 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: `${branding.secondaryColor}20`,
                        color: branding.secondaryColor,
                      }}
                    >
                      Pending
                    </span>
                    <span
                      className="px-2 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: `${branding.accentColor}20`,
                        color: branding.accentColor,
                      }}
                    >
                      New
                    </span>
                  </div>
                </div>

                {/* Links */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Links</Label>
                  <div className="flex gap-4">
                    <span
                      className="text-sm font-medium underline cursor-pointer"
                      style={{ color: branding.primaryColor }}
                    >
                      Primary link
                    </span>
                    <span
                      className="text-sm font-medium underline cursor-pointer"
                      style={{ color: branding.accentColor }}
                    >
                      Accent link
                    </span>
                  </div>
                </div>

                {/* Progress */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Progress</Label>
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ backgroundColor: `${branding.primaryColor}20` }}
                  >
                    <div
                      className="h-full w-2/3 rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${branding.primaryColor}, ${branding.secondaryColor})`,
                      }}
                    />
                  </div>
                </div>

                {/* Cards */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Highlight Card
                  </Label>
                  <div
                    className="p-4 rounded-lg border-l-4"
                    style={{
                      borderLeftColor: branding.primaryColor,
                      backgroundColor: `${branding.primaryColor}08`,
                    }}
                  >
                    <p className="text-sm font-medium">Important Notice</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      This is how accent cards will appear with your brand colors.
                    </p>
                  </div>
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
