"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Mail,
  ArrowLeft,
  Loader2,
  CheckCircle,
  Circle,
  Search,
  Sparkles,
  Send,
  Bell,
  UserPlus,
  Upload,
  ThumbsUp,
  ThumbsDown,
  Clock,
  AlertTriangle,
  KeyRound,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TemplateEditor } from "@/components/email-templates/template-editor";
import { EmailTemplateType, EmailTemplateVariable } from "@/lib/email-templates";

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

// Template category groupings
const TEMPLATE_CATEGORIES = [
  {
    name: "Onboarding",
    icon: UserPlus,
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-500",
    types: ["WELCOME", "PASSWORD_RESET"] as EmailTemplateType[],
  },
  {
    name: "Content Requests",
    icon: Send,
    iconBg: "bg-violet-500/10",
    iconColor: "text-violet-500",
    types: ["REQUEST_SENT", "UPLOAD_RECEIVED"] as EmailTemplateType[],
  },
  {
    name: "Review Status",
    icon: ThumbsUp,
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
    types: ["REQUEST_APPROVED", "REQUEST_REJECTED", "REVISION_REQUESTED"] as EmailTemplateType[],
  },
  {
    name: "Reminders",
    icon: Bell,
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-500",
    types: ["REMINDER_UPCOMING", "REMINDER_DUE_TODAY", "REMINDER_OVERDUE"] as EmailTemplateType[],
  },
];

// Icon mapping for template types
const TEMPLATE_ICONS: Record<EmailTemplateType, React.ElementType> = {
  WELCOME: UserPlus,
  REQUEST_SENT: Send,
  UPLOAD_RECEIVED: Upload,
  REQUEST_APPROVED: ThumbsUp,
  REQUEST_REJECTED: ThumbsDown,
  REMINDER_UPCOMING: Clock,
  REMINDER_DUE_TODAY: Bell,
  REMINDER_OVERDUE: AlertTriangle,
  PASSWORD_RESET: KeyRound,
  REVISION_REQUESTED: MessageSquare,
};

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = React.useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] =
    React.useState<EmailTemplate | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Fetch templates
  React.useEffect(() => {
    async function fetchTemplates() {
      try {
        const response = await fetch("/api/email-templates");
        if (!response.ok) {
          throw new Error("Failed to fetch templates");
        }
        const data = await response.json();
        setTemplates(data);
        // Select first template by default
        if (data.length > 0 && !selectedTemplate) {
          setSelectedTemplate(data[0]);
        }
      } catch (error) {
        console.error("Error fetching templates:", error);
        toast.error("Failed to load email templates");
      } finally {
        setIsLoading(false);
      }
    }

    fetchTemplates();
  }, []);

  // Filter templates by search
  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group templates by category
  const templatesByCategory = TEMPLATE_CATEGORIES.map((category) => ({
    ...category,
    templates: filteredTemplates.filter((t) =>
      category.types.includes(t.type)
    ),
  }));

  // Handle save template
  const handleSaveTemplate = async (template: EmailTemplate) => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: template.type,
          subject: template.subject,
          htmlContent: template.htmlContent,
          textContent: template.textContent,
          isActive: template.isActive,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save template");
      }

      const updatedTemplate = await response.json();

      // Update templates list
      setTemplates((prev) =>
        prev.map((t) =>
          t.type === updatedTemplate.type ? updatedTemplate : t
        )
      );

      // Update selected template
      setSelectedTemplate(updatedTemplate);
    } catch (error) {
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  // Handle reset template
  const handleResetTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      const response = await fetch("/api/email-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedTemplate.type,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reset template");
      }

      const resetTemplate = await response.json();

      // Update templates list
      setTemplates((prev) =>
        prev.map((t) => (t.type === resetTemplate.type ? resetTemplate : t))
      );

      // Update selected template
      setSelectedTemplate(resetTemplate);
    } catch (error) {
      throw error;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Loading email templates...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/dashboard/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Email Templates
              </h1>
              <p className="text-muted-foreground">
                Customize the emails sent to your creators
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pro Tip */}
      <Card className="card-elevated border-violet-200/50 bg-gradient-to-r from-violet-50/50 to-purple-50/50 dark:from-violet-950/20 dark:to-purple-950/20 dark:border-violet-800/30">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <h3 className="font-semibold text-violet-700 dark:text-violet-400">
                Personalize Your Communications
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Use variables like{" "}
                <code className="px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-400 font-mono text-xs">
                  {"{{creator.name}}"}
                </code>{" "}
                to personalize your emails. All changes are saved per-template
                and you can always reset to the default.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Template List Sidebar */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="pl-10"
            />
          </div>

          {/* Template Categories */}
          <div className="space-y-4">
            {templatesByCategory.map((category) => (
              <Card key={category.name} className="card-elevated">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-8 w-8 rounded-lg ${category.iconBg} ${category.iconColor} flex items-center justify-center`}
                    >
                      <category.icon className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-sm font-medium">
                      {category.name}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1">
                  {category.templates.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                      No templates match your search
                    </p>
                  ) : (
                    category.templates.map((template) => {
                      const Icon = TEMPLATE_ICONS[template.type];
                      const isSelected =
                        selectedTemplate?.type === template.type;

                      return (
                        <button
                          key={template.type}
                          onClick={() => setSelectedTemplate(template)}
                          className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors ${
                            isSelected
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-muted"
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-medium truncate ${
                                isSelected ? "text-primary" : ""
                              }`}
                            >
                              {template.name}
                            </p>
                          </div>
                          {template.isCustom ? (
                            <Badge
                              variant="secondary"
                              className="shrink-0 text-[10px] px-1.5"
                            >
                              Custom
                            </Badge>
                          ) : (
                            <Circle className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                          )}
                        </button>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Summary Stats */}
          <Card className="card-elevated">
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Templates</span>
                <span className="font-medium">{templates.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-muted-foreground">Customized</span>
                <span className="font-medium text-primary">
                  {templates.filter((t) => t.isCustom).length}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-muted-foreground">Using Default</span>
                <span className="font-medium text-muted-foreground">
                  {templates.filter((t) => !t.isCustom).length}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Template Editor */}
        <div className="lg:col-span-8 xl:col-span-9">
          {selectedTemplate ? (
            <TemplateEditor
              template={selectedTemplate}
              onSave={handleSaveTemplate}
              onReset={handleResetTemplate}
              isSaving={isSaving}
            />
          ) : (
            <Card className="card-elevated">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <Mail className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">No Template Selected</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Select a template from the list to start editing
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
