"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ArrowLeft,
  Send,
  Save,
  Clock,
  Eye,
  Mail,
  Users,
  FileText,
  Calendar,
  AlertCircle,
  CheckCircle,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { EmailEditor, EMAIL_VARIABLES } from "@/components/email/email-editor";
import { RecipientPicker, type Creator } from "@/components/email/recipient-picker";
import { cn } from "@/lib/utils";

// Email template presets
const EMAIL_TEMPLATES = [
  {
    id: "blank",
    name: "Blank Email",
    subject: "",
    body: "",
  },
  {
    id: "content-reminder",
    name: "Content Reminder",
    subject: "Reminder: Content Due Soon",
    body: `Hi {{creator.name}},

This is a friendly reminder that you have content due soon.

Please log in to your portal to view your pending requests and upload your content:
{{portal.link}}

If you have any questions, please don't hesitate to reach out.

Best regards,
{{sender.name}}
{{agency.name}}`,
  },
  {
    id: "welcome",
    name: "Welcome Email",
    subject: "Welcome to {{agency.name}}!",
    body: `Hi {{creator.name}},

Welcome to {{agency.name}}! We're excited to have you on board.

You can access your creator portal here:
{{portal.link}}

In your portal, you'll be able to:
- View content requests
- Upload your submissions
- Track approval status
- Communicate with our team

If you have any questions, feel free to reach out.

Best regards,
{{sender.name}}
{{agency.name}}`,
  },
  {
    id: "new-request",
    name: "New Request Notification",
    subject: "New Content Request: {{request.title}}",
    body: `Hi {{creator.name}},

We have a new content request for you!

**Request:** {{request.title}}
**Due Date:** {{request.dueDate}}

Please log in to your portal to view the full details and upload your content:
{{portal.link}}

Let us know if you have any questions.

Best regards,
{{sender.name}}
{{agency.name}}`,
  },
  {
    id: "thank-you",
    name: "Thank You",
    subject: "Thank You for Your Submission!",
    body: `Hi {{creator.name}},

Thank you for submitting your content! We've received your files and our team is currently reviewing them.

We'll notify you once the review is complete.

Best regards,
{{sender.name}}
{{agency.name}}`,
  },
  {
    id: "feedback",
    name: "Request Feedback",
    subject: "We'd Love Your Feedback",
    body: `Hi {{creator.name}},

We hope you're enjoying working with {{agency.name}}!

We'd love to hear your feedback about your experience using our portal. Your input helps us improve and serve you better.

If you have a few minutes, please reply to this email with any thoughts or suggestions.

Thank you for being a valued partner!

Best regards,
{{sender.name}}
{{agency.name}}`,
  },
];

// Draft type
interface EmailDraft {
  id?: string;
  subject: string;
  body: string;
  recipientIds: string[];
  templateId?: string;
  scheduledFor?: string;
  savedAt?: Date;
}

export default function EmailComposePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Email state
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("blank");

  // Scheduling
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");

  // Preview
  const [showPreview, setShowPreview] = useState(false);
  const [previewCreator, setPreviewCreator] = useState<Creator | null>(null);

  // Confirmation dialog
  const [showSendConfirm, setShowSendConfirm] = useState(false);

  // Data
  const [creators, setCreators] = useState<Creator[]>([]);
  const [draft, setDraft] = useState<EmailDraft | null>(null);

  // Active tab
  const [activeTab, setActiveTab] = useState("compose");

  // Fetch creators
  useEffect(() => {
    async function fetchCreators() {
      try {
        const res = await fetch("/api/creators");
        if (!res.ok) throw new Error("Failed to fetch creators");
        const data = await res.json();
        setCreators(data);
      } catch (error) {
        console.error("Error fetching creators:", error);
        toast.error("Failed to load creators");
      } finally {
        setIsLoading(false);
      }
    }
    fetchCreators();
  }, []);

  // Load template
  const handleTemplateChange = useCallback((templateId: string) => {
    const template = EMAIL_TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      setSelectedTemplateId(templateId);
      setSubject(template.subject);
      setBody(template.body);
    }
  }, []);

  // Get preview data for a specific creator
  const getPreviewData = useCallback(
    (creator: Creator | null): Record<string, string> => {
      const now = new Date();
      return {
        "creator.name": creator?.name || "John Smith",
        "creator.email": creator?.email || "john@example.com",
        "creator.phone": creator?.phone || "+1 555-0123",
        "agency.name": "Your Agency", // Would come from session
        "portal.link": `${window.location.origin}/portal`,
        "request.title": "Sample Request",
        "request.dueDate": now.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        "request.status": "Pending",
        "date.today": now.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        "sender.name": "Your Name", // Would come from session
        "sender.email": "you@agency.com", // Would come from session
      };
    },
    []
  );

  // Save as draft
  const handleSaveDraft = async () => {
    if (!subject && !body && selectedRecipientIds.length === 0) {
      toast.error("Nothing to save");
      return;
    }

    setIsSaving(true);
    try {
      // In a real app, this would save to the database
      const draftData: EmailDraft = {
        subject,
        body,
        recipientIds: selectedRecipientIds,
        templateId: selectedTemplateId,
        scheduledFor: isScheduled && scheduledDate && scheduledTime
          ? `${scheduledDate}T${scheduledTime}`
          : undefined,
        savedAt: new Date(),
      };

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));
      setDraft(draftData);

      toast.success("Draft saved successfully");
    } catch (error) {
      console.error("Error saving draft:", error);
      toast.error("Failed to save draft");
    } finally {
      setIsSaving(false);
    }
  };

  // Send email
  const handleSend = async () => {
    if (selectedRecipientIds.length === 0) {
      toast.error("Please select at least one recipient");
      return;
    }
    if (!subject.trim()) {
      toast.error("Please enter a subject line");
      return;
    }
    if (!body.trim()) {
      toast.error("Please enter an email body");
      return;
    }

    setShowSendConfirm(true);
  };

  // Confirm and send
  const confirmSend = async () => {
    setShowSendConfirm(false);
    setIsSending(true);

    try {
      const payload = {
        subject,
        body,
        recipientIds: selectedRecipientIds,
        scheduledFor: isScheduled && scheduledDate && scheduledTime
          ? `${scheduledDate}T${scheduledTime}:00.000Z`
          : null,
      };

      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to send email");
      }

      const result = await res.json();

      if (isScheduled) {
        toast.success(`Email scheduled for ${selectedRecipientIds.length} recipient(s)`);
      } else {
        toast.success(`Email sent to ${result.sent} recipient(s)`);
      }

      // Reset form
      setSubject("");
      setBody("");
      setSelectedRecipientIds([]);
      setSelectedTemplateId("blank");
      setIsScheduled(false);
      setScheduledDate("");
      setScheduledTime("");
      setDraft(null);

      // Redirect to dashboard or email history
      router.push("/dashboard");
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send email");
    } finally {
      setIsSending(false);
    }
  };

  // Get selected creators
  const selectedCreators = creators.filter((c) => selectedRecipientIds.includes(c.id));

  // Validation
  const canSend = selectedRecipientIds.length > 0 && subject.trim() && body.trim();
  const canSchedule = canSend && scheduledDate && scheduledTime;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Compose Email</h1>
            <p className="text-muted-foreground">
              Send emails to multiple creators at once
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="gap-2"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Draft
          </Button>
          <Button
            onClick={handleSend}
            disabled={!canSend || isSending}
            className="gap-2"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isScheduled ? (
              <Clock className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {isScheduled ? "Schedule" : "Send"}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column - Editor */}
        <div className="lg:col-span-2 space-y-6">
          {/* Template selector */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Email Template
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_TEMPLATES.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Email editor */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Content
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EmailEditor
                subject={subject}
                onSubjectChange={setSubject}
                body={body}
                onBodyChange={setBody}
                previewData={getPreviewData(selectedCreators[0] || null)}
              />
            </CardContent>
          </Card>

          {/* Schedule options */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Schedule Send
                </CardTitle>
                <Switch
                  checked={isScheduled}
                  onCheckedChange={setIsScheduled}
                />
              </div>
            </CardHeader>
            {isScheduled && (
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="schedule-date">Date</Label>
                    <Input
                      id="schedule-date"
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schedule-time">Time</Label>
                    <Input
                      id="schedule-time"
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                    />
                  </div>
                </div>
                {scheduledDate && scheduledTime && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Email will be sent on{" "}
                    <span className="font-medium text-foreground">
                      {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString()}
                    </span>
                  </p>
                )}
              </CardContent>
            )}
          </Card>
        </div>

        {/* Right column - Recipients */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Recipients
              </CardTitle>
              <CardDescription>
                {selectedRecipientIds.length === 0
                  ? "Select creators to send to"
                  : `${selectedRecipientIds.length} creator${selectedRecipientIds.length !== 1 ? "s" : ""} selected`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RecipientPicker
                creators={creators}
                selectedIds={selectedRecipientIds}
                onSelectionChange={setSelectedRecipientIds}
              />
            </CardContent>
          </Card>

          {/* Preview with actual recipient */}
          {selectedCreators.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Preview Email
                </CardTitle>
                <CardDescription>
                  See how the email will look for a recipient
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select
                  value={previewCreator?.id || selectedCreators[0]?.id}
                  onValueChange={(id) =>
                    setPreviewCreator(selectedCreators.find((c) => c.id === id) || null)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select recipient to preview" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedCreators.map((creator) => (
                      <SelectItem key={creator.id} value={creator.id}>
                        {creator.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => setShowPreview(true)}
                >
                  <Eye className="h-4 w-4" />
                  Preview Full Email
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Send confirmation dialog */}
      <Dialog open={showSendConfirm} onOpenChange={setShowSendConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isScheduled ? "Schedule Email?" : "Send Email?"}
            </DialogTitle>
            <DialogDescription>
              {isScheduled
                ? `This email will be sent to ${selectedRecipientIds.length} recipient(s) on ${new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString()}.`
                : `This email will be sent to ${selectedRecipientIds.length} recipient(s) immediately.`}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <p className="text-sm">
              <strong>Subject:</strong> {subject}
            </p>
            <p className="text-sm">
              <strong>Recipients:</strong> {selectedRecipientIds.length} creator(s)
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={confirmSend} className="gap-2">
              {isScheduled ? (
                <>
                  <Clock className="h-4 w-4" />
                  Schedule
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Now
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full preview dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              Previewing email for{" "}
              {previewCreator?.name || selectedCreators[0]?.name || "recipient"}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-white p-6 dark:bg-gray-950">
            <div className="border-b pb-4 mb-4">
              <p className="text-sm text-muted-foreground">
                <strong>To:</strong>{" "}
                {previewCreator?.email || selectedCreators[0]?.email || "recipient@example.com"}
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Subject:</strong>{" "}
                {processVariables(
                  subject,
                  getPreviewData(previewCreator || selectedCreators[0] || null)
                )}
              </p>
            </div>
            <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
              {processVariables(
                body,
                getPreviewData(previewCreator || selectedCreators[0] || null)
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper to process variables for display
function processVariables(text: string, data: Record<string, string>): string {
  let processed = text;
  EMAIL_VARIABLES.forEach((variable) => {
    const regex = new RegExp(`\\{\\{${variable.key}\\}\\}`, "g");
    const value = data[variable.key] || variable.example;
    processed = processed.replace(regex, value);
  });
  return processed;
}
