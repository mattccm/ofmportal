"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Mail,
  MessageSquare,
  MessageCircle,
  Send,
  Hash,
  Bell,
  Phone,
  Clock,
  AlertTriangle,
  Globe,
  Languages,
  Loader2,
  Copy,
  ExternalLink,
  Calendar,
  CheckCircle,
  XCircle,
  Moon,
  Info,
} from "lucide-react";
import {
  type CommunicationPreferences,
  type ContactMethod,
  CONTACT_METHODS,
  getContactMethodInfo,
  isCreatorAvailable,
  formatTimezoneDifference,
  getTimezoneDifference,
} from "@/types/communication-preferences";
import {
  getCurrentTimeInTimezone,
  getTimezoneAbbreviation,
  detectLocalTimezone,
} from "@/lib/timezone-utils";

// ============================================
// ICON MAP
// ============================================

const ICON_MAP: Record<string, React.ReactNode> = {
  Mail: <Mail className="h-4 w-4" />,
  MessageSquare: <MessageSquare className="h-4 w-4" />,
  MessageCircle: <MessageCircle className="h-4 w-4" />,
  Send: <Send className="h-4 w-4" />,
  Hash: <Hash className="h-4 w-4" />,
  Bell: <Bell className="h-4 w-4" />,
  Phone: <Phone className="h-4 w-4" />,
};

// ============================================
// MESSAGE TEMPLATES
// ============================================

interface MessageTemplate {
  id: string;
  name: string;
  subject?: string;
  body: string;
  methods: ContactMethod[];
}

const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    id: "new-request",
    name: "New Content Request",
    subject: "New Content Request: {{requestTitle}}",
    body: `Hi {{creatorName}},

I hope this message finds you well! We have a new content request for you.

Request: {{requestTitle}}
Due Date: {{dueDate}}

Please log in to your portal to view the full details and get started.

Best regards,
{{senderName}}`,
    methods: ["email", "in_app"],
  },
  {
    id: "deadline-reminder",
    name: "Deadline Reminder",
    subject: "Reminder: {{requestTitle}} due {{dueDate}}",
    body: `Hi {{creatorName}},

Just a friendly reminder that your content for "{{requestTitle}}" is due on {{dueDate}}.

If you have any questions or need an extension, please let us know.

Thanks!
{{senderName}}`,
    methods: ["email", "sms", "whatsapp", "in_app"],
  },
  {
    id: "feedback",
    name: "Feedback on Upload",
    subject: "Feedback on your recent upload",
    body: `Hi {{creatorName}},

Thanks for your recent upload! We have some feedback for you:

{{feedbackMessage}}

Please review and let us know if you have any questions.

Best,
{{senderName}}`,
    methods: ["email", "in_app"],
  },
  {
    id: "approval",
    name: "Content Approved",
    subject: "Your content has been approved!",
    body: `Hi {{creatorName}},

Great news! Your upload for "{{requestTitle}}" has been approved.

Thank you for your excellent work!

Best regards,
{{senderName}}`,
    methods: ["email", "sms", "whatsapp", "in_app"],
  },
  {
    id: "quick-message",
    name: "Quick Message",
    body: `Hi {{creatorName}},

{{customMessage}}

{{senderName}}`,
    methods: ["email", "sms", "whatsapp", "telegram", "discord", "in_app"],
  },
];

// ============================================
// TYPES
// ============================================

interface ContactCreatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creator: {
    id: string;
    name: string;
    email: string;
  };
  preferences: CommunicationPreferences;
  senderName?: string;
  requestContext?: {
    id: string;
    title: string;
    dueDate?: Date;
  };
  onSend?: (data: {
    method: ContactMethod;
    subject?: string;
    message: string;
    templateId?: string;
  }) => Promise<void>;
}

// ============================================
// COMPONENT
// ============================================

export function ContactCreatorModal({
  open,
  onOpenChange,
  creator,
  preferences,
  senderName = "Your Team",
  requestContext,
  onSend,
}: ContactCreatorModalProps) {
  // State
  const [selectedMethod, setSelectedMethod] = useState<ContactMethod>(preferences.primaryMethod);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState<"compose" | "templates">("compose");

  const userTimezone = detectLocalTimezone();

  // Calculate availability
  const availability = useMemo(() => {
    return isCreatorAvailable(preferences);
  }, [preferences]);

  // Get active quiet period
  const activeQuietPeriod = useMemo(() => {
    const now = new Date();
    return preferences.quietPeriods.find((period) => {
      const start = new Date(period.startDate);
      const end = new Date(period.endDate);
      return now >= start && now <= end;
    });
  }, [preferences.quietPeriods]);

  // Get timezone difference
  const timezoneDiff = useMemo(() => {
    return getTimezoneDifference(userTimezone, preferences.timezone);
  }, [userTimezone, preferences.timezone]);

  // Get current time in creator's timezone
  const creatorTime = useMemo(() => {
    try {
      return getCurrentTimeInTimezone(preferences.timezone);
    } catch {
      return new Date();
    }
  }, [preferences.timezone]);

  // Get method info
  const methodInfo = getContactMethodInfo(selectedMethod);

  // Filter templates by selected method
  const availableTemplates = useMemo(() => {
    return DEFAULT_TEMPLATES.filter((t) => t.methods.includes(selectedMethod));
  }, [selectedMethod]);

  // Replace template variables
  const replaceVariables = (text: string): string => {
    return text
      .replace(/\{\{creatorName\}\}/g, creator.name)
      .replace(/\{\{senderName\}\}/g, senderName)
      .replace(/\{\{requestTitle\}\}/g, requestContext?.title || "[Request Title]")
      .replace(
        /\{\{dueDate\}\}/g,
        requestContext?.dueDate ? format(requestContext.dueDate, "MMM d, yyyy") : "[Due Date]"
      )
      .replace(/\{\{customMessage\}\}/g, customMessage)
      .replace(/\{\{feedbackMessage\}\}/g, customMessage || "[Your feedback here]");
  };

  // Apply template
  const applyTemplate = (template: MessageTemplate) => {
    setSelectedTemplateId(template.id);
    if (template.subject) {
      setSubject(replaceVariables(template.subject));
    }
    setMessage(replaceVariables(template.body));
    setActiveTab("compose");
  };

  // Get contact value for the selected method
  const getContactValue = (): string => {
    switch (selectedMethod) {
      case "email":
        return preferences.contactDetails.email || creator.email;
      case "phone":
      case "sms":
        return preferences.contactDetails.phone || "";
      case "whatsapp":
        return preferences.contactDetails.whatsapp || "";
      case "telegram":
        return preferences.contactDetails.telegram || "";
      case "discord":
        return preferences.contactDetails.discord || "";
      default:
        return "";
    }
  };

  // Copy contact info
  const copyContactInfo = () => {
    const value = getContactValue();
    if (value) {
      navigator.clipboard.writeText(value);
      toast.success("Contact info copied to clipboard");
    }
  };

  // Open external app
  const openExternalApp = () => {
    const value = getContactValue();
    if (!value) return;

    switch (selectedMethod) {
      case "email":
        window.open(`mailto:${value}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`);
        break;
      case "phone":
        window.open(`tel:${value}`);
        break;
      case "sms":
        window.open(`sms:${value}?body=${encodeURIComponent(message)}`);
        break;
      case "whatsapp":
        window.open(`https://wa.me/${value.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(message)}`);
        break;
      case "telegram":
        window.open(`https://t.me/${value.replace("@", "")}`);
        break;
    }
  };

  // Handle send
  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    setIsSending(true);
    try {
      if (onSend) {
        await onSend({
          method: selectedMethod,
          subject: selectedMethod === "email" ? subject : undefined,
          message,
          templateId: selectedTemplateId || undefined,
        });
      }

      toast.success("Message sent successfully");
      onOpenChange(false);

      // Reset form
      setMessage("");
      setSubject("");
      setCustomMessage("");
      setSelectedTemplateId(null);
    } catch (error) {
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  // Reset form when modal opens
  React.useEffect(() => {
    if (open) {
      setSelectedMethod(preferences.primaryMethod);
      setMessage("");
      setSubject("");
      setCustomMessage("");
      setSelectedTemplateId(null);
      setActiveTab("compose");
    }
  }, [open, preferences.primaryMethod]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Contact {creator.name}
          </DialogTitle>
          <DialogDescription>
            Send a message using their preferred communication method
          </DialogDescription>
        </DialogHeader>

        <TooltipProvider>
          {/* Availability Warning */}
          {!availability.available && (
            <div
              className={cn(
                "p-3 rounded-lg border",
                activeQuietPeriod
                  ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                  : "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800"
              )}
            >
              <div className="flex items-start gap-2">
                {activeQuietPeriod ? (
                  <Moon className="h-4 w-4 text-amber-600 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5" />
                )}
                <div>
                  <p
                    className={cn(
                      "text-sm font-medium",
                      activeQuietPeriod
                        ? "text-amber-800 dark:text-amber-400"
                        : "text-orange-800 dark:text-orange-400"
                    )}
                  >
                    {activeQuietPeriod ? "Creator is on a scheduled break" : "Creator is currently unavailable"}
                  </p>
                  <p
                    className={cn(
                      "text-xs",
                      activeQuietPeriod
                        ? "text-amber-700 dark:text-amber-500"
                        : "text-orange-700 dark:text-orange-500"
                    )}
                  >
                    {activeQuietPeriod
                      ? `Until ${format(new Date(activeQuietPeriod.endDate), "MMM d, yyyy")}${
                          activeQuietPeriod.reason ? ` - ${activeQuietPeriod.reason}` : ""
                        }`
                      : availability.reason || "Outside working hours"}
                  </p>
                  {activeQuietPeriod?.autoReply && (
                    <p className="text-xs text-amber-700 dark:text-amber-500 mt-1 italic">
                      Auto-reply: "{activeQuietPeriod.autoReply}"
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Creator Info Row */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-3">
              {/* Availability indicator */}
              <div
                className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center",
                  availability.available
                    ? "bg-emerald-100 dark:bg-emerald-900/30"
                    : activeQuietPeriod
                    ? "bg-amber-100 dark:bg-amber-900/30"
                    : "bg-gray-100 dark:bg-gray-800"
                )}
              >
                {availability.available ? (
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                ) : activeQuietPeriod ? (
                  <Moon className="h-5 w-5 text-amber-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-gray-500" />
                )}
              </div>
              <div>
                <p className="font-medium">{creator.name}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    {format(creatorTime, "h:mm a")} ({getTimezoneAbbreviation(preferences.timezone)})
                  </span>
                  {timezoneDiff !== 0 && (
                    <span className="text-xs">({formatTimezoneDifference(timezoneDiff)})</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Languages className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{preferences.primaryLanguage}</span>
            </div>
          </div>

          {/* Contact Method Selector */}
          <div className="space-y-2">
            <Label>Contact Method</Label>
            <div className="grid grid-cols-4 gap-2">
              {CONTACT_METHODS.filter((m) => {
                // Only show methods with contact details
                if (m.key === "in_app") return true;
                if (m.key === "email") return preferences.contactDetails.email || creator.email;
                if (m.key === "phone" || m.key === "sms") return preferences.contactDetails.phone;
                if (m.key === "whatsapp") return preferences.contactDetails.whatsapp;
                if (m.key === "telegram") return preferences.contactDetails.telegram;
                if (m.key === "discord") return preferences.contactDetails.discord;
                return false;
              }).map((method) => {
                const isPreferred = method.key === preferences.primaryMethod;
                const isSecondary = method.key === preferences.secondaryMethod;

                return (
                  <Tooltip key={method.key}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setSelectedMethod(method.key)}
                        className={cn(
                          "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all",
                          selectedMethod === method.key
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <div className={cn("p-1.5 rounded-md", method.bgColor)}>
                          <span className={method.color}>{ICON_MAP[method.icon]}</span>
                        </div>
                        <span className="text-xs font-medium">{method.label}</span>
                        {isPreferred && (
                          <Badge className="text-[10px] px-1 py-0">Primary</Badge>
                        )}
                        {isSecondary && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0">
                            Secondary
                          </Badge>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{method.helpText}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>

          {/* Contact Value */}
          {selectedMethod !== "in_app" && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <span className="text-sm text-muted-foreground flex-1 truncate">
                {getContactValue() || "No contact info available"}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyContactInfo}>
                <Copy className="h-4 w-4" />
              </Button>
              {["email", "phone", "sms", "whatsapp", "telegram"].includes(selectedMethod) && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={openExternalApp}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          {/* Tabs for Compose/Templates */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "compose" | "templates")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="compose">Compose Message</TabsTrigger>
              <TabsTrigger value="templates">
                Templates ({availableTemplates.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="templates" className="space-y-2 mt-4">
              {availableTemplates.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No templates available for {methodInfo?.label || "this method"}
                </p>
              ) : (
                availableTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyTemplate(template)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border hover:border-primary/50 transition-all",
                      selectedTemplateId === template.id && "border-primary bg-primary/5"
                    )}
                  >
                    <p className="font-medium text-sm">{template.name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {template.body.substring(0, 100)}...
                    </p>
                  </button>
                ))
              )}
            </TabsContent>

            <TabsContent value="compose" className="space-y-4 mt-4">
              {/* Subject (for email) */}
              {selectedMethod === "email" && (
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Enter subject line..."
                  />
                </div>
              )}

              {/* Custom message input for templates that need it */}
              {selectedTemplateId === "quick-message" ||
                (selectedTemplateId === "feedback" && (
                  <div className="space-y-2">
                    <Label>
                      {selectedTemplateId === "feedback" ? "Your Feedback" : "Custom Message"}
                    </Label>
                    <Textarea
                      value={customMessage}
                      onChange={(e) => {
                        setCustomMessage(e.target.value);
                        // Update the main message with the new custom text
                        const template = DEFAULT_TEMPLATES.find((t) => t.id === selectedTemplateId);
                        if (template) {
                          setMessage(
                            replaceVariables(template.body).replace(
                              selectedTemplateId === "feedback"
                                ? "[Your feedback here]"
                                : customMessage || "",
                              e.target.value
                            )
                          );
                        }
                      }}
                      placeholder="Enter your message..."
                      rows={3}
                    />
                  </div>
                ))}

              {/* Message */}
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter your message..."
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  {message.length} characters
                  {selectedMethod === "sms" && message.length > 160 && (
                    <span className="text-amber-600 ml-2">
                      (May be split into {Math.ceil(message.length / 160)} SMS messages)
                    </span>
                  )}
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Response Time Info */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 rounded-lg bg-muted/30">
            <Clock className="h-4 w-4" />
            <span>
              Expected response:{" "}
              {preferences.expectedResponseTime === "immediate"
                ? "Within a few hours"
                : preferences.expectedResponseTime === "same_day"
                ? "Same business day"
                : preferences.expectedResponseTime === "next_day"
                ? "Within 24 hours"
                : preferences.expectedResponseTime === "within_week"
                ? "Within a week"
                : "Flexible timing"}
            </span>
          </div>

          {/* Communication Notes */}
          {preferences.communicationNotes && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground p-2 rounded-lg bg-muted/30">
              <Info className="h-4 w-4 mt-0.5" />
              <span className="italic">"{preferences.communicationNotes}"</span>
            </div>
          )}
        </TooltipProvider>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {selectedMethod !== "in_app" && ["email", "phone", "sms", "whatsapp", "telegram"].includes(selectedMethod) && (
            <Button variant="outline" onClick={openExternalApp}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in App
            </Button>
          )}
          <Button onClick={handleSend} disabled={isSending || !message.trim()}>
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Message
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ContactCreatorModal;
