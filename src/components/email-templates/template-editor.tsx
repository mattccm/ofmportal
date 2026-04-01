"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Save,
  RotateCcw,
  Send,
  Eye,
  Code,
  Variable,
  Copy,
  Check,
  Loader2,
  Mail,
  FileText,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  renderTemplate,
  getSampleData,
  EmailTemplateType,
  EmailTemplateVariable,
} from "@/lib/email-templates";

interface EmailTemplate {
  id: string | null;
  type: EmailTemplateType;
  name: string;
  description: string;
  variables: EmailTemplateVariable[];
  subject: string;
  htmlContent: string;
  textContent: string | null;
  isCustom: boolean;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

interface TemplateEditorProps {
  template: EmailTemplate;
  onSave: (template: EmailTemplate) => Promise<void>;
  onReset: () => Promise<void>;
  isSaving?: boolean;
}

export function TemplateEditor({
  template,
  onSave,
  onReset,
  isSaving = false,
}: TemplateEditorProps) {
  const [subject, setSubject] = React.useState(template.subject);
  const [htmlContent, setHtmlContent] = React.useState(template.htmlContent);
  const [textContent, setTextContent] = React.useState(
    template.textContent || ""
  );
  const [hasChanges, setHasChanges] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("edit");
  const [copiedVariable, setCopiedVariable] = React.useState<string | null>(
    null
  );
  const [testEmail, setTestEmail] = React.useState("");
  const [isSendingTest, setIsSendingTest] = React.useState(false);
  const [showResetDialog, setShowResetDialog] = React.useState(false);
  const [isResetting, setIsResetting] = React.useState(false);

  // Track changes
  React.useEffect(() => {
    const changed =
      subject !== template.subject ||
      htmlContent !== template.htmlContent ||
      textContent !== (template.textContent || "");
    setHasChanges(changed);
  }, [subject, htmlContent, textContent, template]);

  // Reset local state when template changes
  React.useEffect(() => {
    setSubject(template.subject);
    setHtmlContent(template.htmlContent);
    setTextContent(template.textContent || "");
    setHasChanges(false);
  }, [template]);

  // Handle save
  const handleSave = async () => {
    try {
      await onSave({
        ...template,
        subject,
        htmlContent,
        textContent: textContent || null,
      });
      setHasChanges(false);
      toast.success("Template saved successfully");
    } catch {
      toast.error("Failed to save template");
    }
  };

  // Handle reset
  const handleReset = async () => {
    setIsResetting(true);
    try {
      await onReset();
      setShowResetDialog(false);
      toast.success("Template reset to default");
    } catch {
      toast.error("Failed to reset template");
    } finally {
      setIsResetting(false);
    }
  };

  // Handle test send
  const handleTestSend = async () => {
    if (!testEmail) {
      toast.error("Please enter an email address");
      return;
    }

    setIsSendingTest(true);
    try {
      const response = await fetch("/api/email-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: template.type,
          email: testEmail,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send test email");
      }

      const result = await response.json();
      if (result.mock) {
        toast.success("Test email logged (no email service configured)");
      } else {
        toast.success(`Test email sent to ${testEmail}`);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send test email"
      );
    } finally {
      setIsSendingTest(false);
    }
  };

  // Copy variable to clipboard
  const copyVariable = (variable: string) => {
    navigator.clipboard.writeText(`{{${variable}}}`);
    setCopiedVariable(variable);
    setTimeout(() => setCopiedVariable(null), 2000);
    toast.success("Variable copied to clipboard");
  };

  // Insert variable at cursor position
  const insertVariable = (
    variable: string,
    target: "subject" | "html" | "text"
  ) => {
    const variableText = `{{${variable}}}`;

    if (target === "subject") {
      setSubject((prev) => prev + variableText);
    } else if (target === "html") {
      setHtmlContent((prev) => prev + variableText);
    } else {
      setTextContent((prev) => prev + variableText);
    }

    toast.success("Variable inserted");
  };

  // Get rendered preview
  const sampleData = getSampleData(template.type);
  const previewSubject = renderTemplate(subject, sampleData);
  const previewHtml = renderTemplate(htmlContent, sampleData);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">{template.name}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {template.description}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {template.isCustom && (
            <Badge variant="secondary" className="mr-2">
              Customized
            </Badge>
          )}
          <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={!template.isCustom}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Default
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reset Template to Default</DialogTitle>
                <DialogDescription>
                  This will discard all your customizations and restore the
                  original template. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowResetDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReset}
                  disabled={isResetting}
                >
                  {isResetting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    "Reset Template"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Editor */}
        <div className="lg:col-span-2 space-y-6">
          {/* Subject Line */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Subject Line</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter email subject..."
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Preview: <span className="font-medium">{previewSubject}</span>
              </p>
            </CardContent>
          </Card>

          {/* Content Editor */}
          <Card>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <CardHeader className="pb-3">
                <TabsList>
                  <TabsTrigger value="edit">
                    <Code className="h-4 w-4 mr-2" />
                    Edit HTML
                  </TabsTrigger>
                  <TabsTrigger value="preview">
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </TabsTrigger>
                  <TabsTrigger value="text">
                    <FileText className="h-4 w-4 mr-2" />
                    Plain Text
                  </TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent>
                <TabsContent value="edit" className="mt-0">
                  <Textarea
                    value={htmlContent}
                    onChange={(e) => setHtmlContent(e.target.value)}
                    placeholder="Enter HTML content..."
                    className="font-mono text-sm min-h-[400px] resize-y"
                  />
                </TabsContent>
                <TabsContent value="preview" className="mt-0">
                  <div className="border rounded-lg overflow-hidden bg-white">
                    <div className="bg-muted/50 px-4 py-2 border-b">
                      <p className="text-sm font-medium">{previewSubject}</p>
                    </div>
                    <div
                      className="p-4 min-h-[400px] overflow-auto"
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                  </div>
                </TabsContent>
                <TabsContent value="text" className="mt-0">
                  <Textarea
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="Enter plain text version (optional, used as fallback)..."
                    className="font-mono text-sm min-h-[400px] resize-y"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    The plain text version is used by email clients that don't
                    support HTML.
                  </p>
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Variables */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Variable className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Available Variables</CardTitle>
              </div>
              <CardDescription>
                Click to copy or insert into your template
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {template.variables.map((variable) => (
                <div
                  key={variable.key}
                  className="group p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <code className="text-sm font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">
                      {`{{${variable.key}}}`}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => copyVariable(variable.key)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      {copiedVariable === variable.key ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {variable.description}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">
                    Example: <span className="font-medium">{variable.example}</span>
                  </p>
                  <div className="flex gap-1 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => insertVariable(variable.key, "subject")}
                    >
                      + Subject
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => insertVariable(variable.key, "html")}
                    >
                      + HTML
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => insertVariable(variable.key, "text")}
                    >
                      + Text
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Test Send */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Send Test Email</CardTitle>
              </div>
              <CardDescription>
                Preview how this email looks in your inbox
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="testEmail">Email Address</Label>
                <Input
                  id="testEmail"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="your@email.com"
                />
              </div>
              <Button
                onClick={handleTestSend}
                disabled={!testEmail || isSendingTest}
                className="w-full"
                variant="outline"
              >
                {isSendingTest ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Test Email
                  </>
                )}
              </Button>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <p className="text-xs">
                  Test emails use sample data and are prefixed with [TEST] in
                  the subject line.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Save Indicator */}
          {hasChanges && (
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800/50">
              <CardContent className="p-4">
                <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                  You have unsaved changes
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                  Remember to save your changes before leaving this page.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
