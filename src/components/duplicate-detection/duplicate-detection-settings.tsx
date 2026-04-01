"use client";

import * as React from "react";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Settings,
  Save,
  Loader2,
  AlertTriangle,
  Image,
  Video,
  FileText,
  Hash,
  Eye,
  Fingerprint,
  Sliders,
  Info,
  CheckCircle2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { DuplicateDetectionSettings } from "@/types/content-fingerprint";

interface DuplicateDetectionSettingsFormProps {
  initialSettings?: DuplicateDetectionSettings;
  onSave?: (settings: DuplicateDetectionSettings) => void;
}

export function DuplicateDetectionSettingsForm({
  initialSettings,
  onSave,
}: DuplicateDetectionSettingsFormProps) {
  const [settings, setSettings] = React.useState<DuplicateDetectionSettings | null>(
    initialSettings || null
  );
  const [isLoading, setIsLoading] = React.useState(!initialSettings);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  // Fetch settings if not provided
  React.useEffect(() => {
    if (!initialSettings) {
      fetchSettings();
    }
  }, [initialSettings]);

  const fetchSettings = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/duplicate-attempts/settings");

      if (!response.ok) {
        throw new Error("Failed to fetch settings");
      }

      const data = await response.json();
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch("/api/duplicate-attempts/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      const data = await response.json();
      setSettings(data);
      setSuccess(true);
      onSave?.(data);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = <K extends keyof DuplicateDetectionSettings>(
    key: K,
    value: DuplicateDetectionSettings[K]
  ) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading settings...
        </div>
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
        <AlertTriangle className="h-12 w-12 text-red-500" />
        <h2 className="text-xl font-semibold">Error</h2>
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={fetchSettings}>Retry</Button>
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="space-y-6">
      {/* Enable/Disable Toggle */}
      <Card className={cn(
        "transition-all duration-300",
        settings.enabled
          ? "border-green-200/50 bg-gradient-to-r from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20 dark:border-green-800/30"
          : "border-red-200/50 bg-gradient-to-r from-red-50/50 to-orange-50/50 dark:from-red-950/20 dark:to-orange-950/20 dark:border-red-800/30"
      )}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                "h-12 w-12 rounded-xl flex items-center justify-center transition-colors",
                settings.enabled
                  ? "bg-green-500/10"
                  : "bg-red-500/10"
              )}>
                {settings.enabled ? (
                  <ShieldCheck className="h-6 w-6 text-green-600 dark:text-green-400" />
                ) : (
                  <ShieldAlert className="h-6 w-6 text-red-600 dark:text-red-400" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  Duplicate Detection {settings.enabled ? "Enabled" : "Disabled"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {settings.enabled
                    ? "Duplicates are being blocked. Creators cannot resubmit old content."
                    : "Duplicate detection is off. Creators can submit any content."}
                </p>
              </div>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) => updateSetting("enabled", checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Detection Methods */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-indigo-500" />
            Detection Methods
          </CardTitle>
          <CardDescription>
            Choose which methods to use for detecting duplicate content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Hash Check */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Hash className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <p className="font-medium">Content Hash Check</p>
                <p className="text-sm text-muted-foreground">
                  Detects exact duplicate files using SHA-256 hashing
                </p>
              </div>
            </div>
            <Switch
              checked={settings.enableHashCheck}
              onCheckedChange={(checked) => updateSetting("enableHashCheck", checked)}
            />
          </div>

          {/* Perceptual Hash */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                <Image className="h-5 w-5 text-indigo-500" />
              </div>
              <div>
                <p className="font-medium">Perceptual Hash (Images)</p>
                <p className="text-sm text-muted-foreground">
                  Detects visually similar images even with minor edits
                </p>
              </div>
            </div>
            <Switch
              checked={settings.enablePerceptualHash}
              onCheckedChange={(checked) => updateSetting("enablePerceptualHash", checked)}
            />
          </div>

          {/* Video Frame Hash */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <Video className="h-5 w-5 text-cyan-500" />
              </div>
              <div>
                <p className="font-medium">Video Frame Analysis</p>
                <p className="text-sm text-muted-foreground">
                  Samples video frames to detect similar video content
                </p>
              </div>
            </div>
            <Switch
              checked={settings.enableVideoFrameHash}
              onCheckedChange={(checked) => updateSetting("enableVideoFrameHash", checked)}
            />
          </div>

          {/* Metadata Check */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="font-medium">Metadata Analysis</p>
                <p className="text-sm text-muted-foreground">
                  Compares file names and sizes to catch renamed duplicates
                </p>
              </div>
            </div>
            <Switch
              checked={settings.enableMetadataCheck}
              onCheckedChange={(checked) => updateSetting("enableMetadataCheck", checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Blocking Behavior */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-500" />
            Blocking Behavior
          </CardTitle>
          <CardDescription>
            Configure which types of duplicates should be blocked
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Block Exact Duplicates */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-red-50/50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <ShieldAlert className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="font-medium text-red-700 dark:text-red-400">Block Exact Duplicates</p>
                <p className="text-sm text-red-600/70 dark:text-red-400/70">
                  100% identical files are blocked immediately
                </p>
              </div>
            </div>
            <Switch
              checked={settings.blockExactDuplicates}
              onCheckedChange={(checked) => updateSetting("blockExactDuplicates", checked)}
            />
          </div>

          {/* Block Near Duplicates */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200/50 dark:border-orange-800/30">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="font-medium text-orange-700 dark:text-orange-400">Block Near Duplicates</p>
                <p className="text-sm text-orange-600/70 dark:text-orange-400/70">
                  Files with 95%+ similarity are blocked
                </p>
              </div>
            </div>
            <Switch
              checked={settings.blockNearDuplicates}
              onCheckedChange={(checked) => updateSetting("blockNearDuplicates", checked)}
            />
          </div>

          {/* Warn Similar Content */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Eye className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="font-medium text-amber-700 dark:text-amber-400">Warn on Similar Content</p>
                <p className="text-sm text-amber-600/70 dark:text-amber-400/70">
                  Show warning for similar but not identical content
                </p>
              </div>
            </div>
            <Switch
              checked={settings.warnSimilarContent}
              onCheckedChange={(checked) => updateSetting("warnSimilarContent", checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Thresholds */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-violet-500" />
            Sensitivity Thresholds
          </CardTitle>
          <CardDescription>
            Adjust the similarity thresholds for detection
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Similarity Threshold */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base">Overall Similarity Threshold</Label>
              <span className="text-lg font-mono font-bold text-indigo-600 dark:text-indigo-400">
                {settings.similarityThreshold}%
              </span>
            </div>
            <Slider
              value={[settings.similarityThreshold]}
              onValueChange={(value) => updateSetting("similarityThreshold", value[0])}
              min={50}
              max={100}
              step={5}
              className="w-full"
            />
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Info className="h-4 w-4" />
              Content above this threshold will trigger duplicate warnings
            </p>
          </div>

          {/* Perceptual Threshold */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base">Perceptual Hash Threshold</Label>
              <span className="text-lg font-mono font-bold text-violet-600 dark:text-violet-400">
                {settings.perceptualThreshold}%
              </span>
            </div>
            <Slider
              value={[settings.perceptualThreshold]}
              onValueChange={(value) => updateSetting("perceptualThreshold", value[0])}
              min={50}
              max={100}
              step={5}
              className="w-full"
            />
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Info className="h-4 w-4" />
              Visual similarity threshold for images and video frames
            </p>
          </div>

          {/* Video Sample Frames */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base">Video Sample Frames</Label>
              <span className="text-lg font-mono font-bold text-cyan-600 dark:text-cyan-400">
                {settings.videoSampleFrames}
              </span>
            </div>
            <Slider
              value={[settings.videoSampleFrames]}
              onValueChange={(value) => updateSetting("videoSampleFrames", value[0])}
              min={1}
              max={20}
              step={1}
              className="w-full"
            />
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Info className="h-4 w-4" />
              Number of frames to sample from videos for comparison
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Check Scope */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-emerald-500" />
            Check Scope
          </CardTitle>
          <CardDescription>
            Define where to look for duplicates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Select
              value={settings.checkScope}
              onValueChange={(value) =>
                updateSetting("checkScope", value as DuplicateDetectionSettings["checkScope"])
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CREATOR">
                  <div className="flex flex-col">
                    <span className="font-medium">Creator Only</span>
                    <span className="text-xs text-muted-foreground">
                      Check against creator&apos;s own uploads only
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="AGENCY">
                  <div className="flex flex-col">
                    <span className="font-medium">Entire Agency</span>
                    <span className="text-xs text-muted-foreground">
                      Check against all uploads in the agency
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="REQUEST">
                  <div className="flex flex-col">
                    <span className="font-medium">Current Request</span>
                    <span className="text-xs text-muted-foreground">
                      Check only within the current request
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <div className="p-3 bg-muted/30 rounded-lg text-sm">
              {settings.checkScope === "CREATOR" && (
                <p>Duplicates are checked against all previous uploads from the same creator.</p>
              )}
              {settings.checkScope === "AGENCY" && (
                <p>Duplicates are checked against all uploads in your agency, across all creators.</p>
              )}
              {settings.checkScope === "REQUEST" && (
                <p>Duplicates are only checked within the same content request.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center justify-between pt-4 border-t">
        {error && (
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm">Settings saved successfully</span>
          </div>
        )}
        <div className={cn(!error && !success && "ml-auto")}>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default DuplicateDetectionSettingsForm;
