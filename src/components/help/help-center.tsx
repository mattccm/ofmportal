"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
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
import { Badge } from "@/components/ui/badge";
import {
  Search,
  BookOpen,
  Users,
  FileText,
  Upload,
  Settings,
  Bell,
  BarChart3,
  Layout,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Play,
  Mail,
  MessageCircle,
  Send,
  Keyboard,
  Clock,
  HelpCircle,
  Zap,
  Shield,
  Download,
  CalendarClock,
  UserPlus,
  CheckCircle,
  RefreshCw,
  ExternalLink,
  Rocket,
  Video,
  ArrowRight,
  Command,
  Plus,
  Eye,
  Save,
  Undo,
  Copy,
  Trash2,
  X,
} from "lucide-react";

// ============================================
// TYPES
// ============================================

interface QuickStartGuide {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  steps: string[];
  link?: string;
  estimatedTime: string;
}

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

interface FeatureGuide {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  link: string;
  badge?: string;
}

interface VideoTutorial {
  id: string;
  title: string;
  description: string;
  duration: string;
  thumbnail?: string;
  comingSoon?: boolean;
}

interface KeyboardShortcut {
  keys: string[];
  description: string;
  category: string;
}

interface ChangelogEntry {
  id: string;
  version: string;
  date: string;
  title: string;
  description: string;
  type: "feature" | "improvement" | "fix";
}

// ============================================
// DATA
// ============================================

const QUICK_START_GUIDES: QuickStartGuide[] = [
  {
    id: "first-creator",
    title: "Setting Up Your First Creator",
    description: "Add and invite creators to start collecting content",
    icon: <UserPlus className="w-5 h-5" />,
    estimatedTime: "3 min",
    steps: [
      "Navigate to Creators > Add New Creator",
      "Enter the creator's name and email address",
      "Customize the welcome email message (optional)",
      "Send the invitation - they'll receive portal access instantly",
    ],
    link: "/dashboard/creators/invite",
  },
  {
    id: "content-requests",
    title: "Creating Content Requests",
    description: "Set up requests with requirements and deadlines",
    icon: <FileText className="w-5 h-5" />,
    estimatedTime: "4 min",
    steps: [
      "Go to Requests > New Request",
      "Select the creator and set a deadline",
      "Add detailed requirements and upload any reference files",
      "Configure notification settings and send the request",
    ],
    link: "/dashboard/requests/new",
  },
  {
    id: "managing-uploads",
    title: "Managing Uploads and Approvals",
    description: "Review, approve, and organize submitted content",
    icon: <CheckCircle className="w-5 h-5" />,
    estimatedTime: "3 min",
    steps: [
      "View pending uploads in the Uploads section",
      "Preview content directly in the browser",
      "Approve, request revisions, or reject with feedback",
      "Download approved content or use bulk download",
    ],
    link: "/dashboard/uploads",
  },
  {
    id: "team-collaboration",
    title: "Team Collaboration Guide",
    description: "Invite team members and set up permissions",
    icon: <Users className="w-5 h-5" />,
    estimatedTime: "4 min",
    steps: [
      "Navigate to Settings > Team",
      "Invite team members by email",
      "Assign roles: Admin, Manager, or Viewer",
      "Configure team notifications and access levels",
    ],
    link: "/dashboard/team",
  },
];

const FAQ_ITEMS: FAQItem[] = [
  {
    id: "invite-creator",
    question: "How do I invite a creator?",
    answer:
      "Go to the Creators section and click 'Invite Creator'. Enter their email address and name, then customize the welcome message if desired. They'll receive an email with a unique link to access their personalized portal where they can view requests and upload content.",
    category: "Creators",
  },
  {
    id: "reminders",
    question: "How do reminders work?",
    answer:
      "Reminders are automated notifications sent to creators before content deadlines. You can configure reminders in the Reminders section to be sent at specific intervals (e.g., 3 days before, 1 day before). Reminders can be sent via email, SMS, or both. You can also set up recurring reminders for ongoing requests.",
    category: "Notifications",
  },
  {
    id: "bulk-download",
    question: "Can I bulk download approved content?",
    answer:
      "Yes! Navigate to the Uploads section and filter by 'Approved' status. Select multiple files using the checkboxes, then click the 'Download Selected' button. You can also download all approved content from a specific request by going to the request details page and clicking 'Download All'.",
    category: "Content",
  },
  {
    id: "2fa-setup",
    question: "How do I set up 2FA (two-factor authentication)?",
    answer:
      "Go to Settings > Security and click 'Enable Two-Factor Authentication'. You can choose between authenticator app (recommended) or SMS-based verification. Scan the QR code with your authenticator app, enter the verification code, and save your backup codes in a secure location.",
    category: "Security",
  },
  {
    id: "file-types",
    question: "What file types are supported?",
    answer:
      "We support all common media formats including JPG, PNG, GIF, WEBP, HEIC for images and MP4, MOV, AVI, MKV for videos. Documents like PDF, DOCX, and XLSX are also supported. Maximum file size is 10GB per upload, with larger files automatically chunked for reliable uploads.",
    category: "Content",
  },
  {
    id: "request-revision",
    question: "How do I request revisions from a creator?",
    answer:
      "When reviewing uploaded content, click on the file to preview it, then select 'Request Revision'. Add specific feedback about what needs to be changed. The creator will be notified immediately and can see your feedback in their portal. You can track revision status in the upload details.",
    category: "Content",
  },
  {
    id: "templates",
    question: "What are templates and how do I use them?",
    answer:
      "Templates are pre-configured content request formats that save time when creating similar requests. Create a template with your standard requirements, deadlines, and settings. When creating new requests, select your template to auto-fill all the details. Templates can be edited and shared with your team.",
    category: "Requests",
  },
  {
    id: "analytics",
    question: "What analytics are available?",
    answer:
      "The Analytics dashboard shows key metrics including total requests, completion rates, average turnaround time, and creator performance. You can filter by date range and export reports as CSV. Pro plans include advanced analytics with trend analysis and predictive insights.",
    category: "Analytics",
  },
  {
    id: "creator-portal",
    question: "What does the creator portal look like?",
    answer:
      "Creators have their own simplified portal where they can view all their content requests, see deadlines, upload files, and communicate with your team. The portal is branded with your agency's logo and colors. Creators don't need to create an account - they access via a unique secure link.",
    category: "Creators",
  },
  {
    id: "data-security",
    question: "How is my data secured?",
    answer:
      "All data is encrypted at rest and in transit using AES-256 encryption. Files are stored in secure cloud storage with redundancy across multiple regions. We comply with GDPR, SOC 2, and offer BAA for HIPAA compliance. You can enable additional security features like IP whitelisting and session controls.",
    category: "Security",
  },
];

const FEATURE_GUIDES: FeatureGuide[] = [
  {
    id: "dashboard",
    title: "Dashboard Overview",
    description: "Navigate and customize your main dashboard view",
    icon: <Layout className="w-5 h-5" />,
    link: "/dashboard",
  },
  {
    id: "creators",
    title: "Creator Management",
    description: "Add, organize, and manage your creator roster",
    icon: <Users className="w-5 h-5" />,
    link: "/dashboard/creators",
  },
  {
    id: "requests",
    title: "Content Requests",
    description: "Create and track content requests efficiently",
    icon: <FileText className="w-5 h-5" />,
    link: "/dashboard/requests",
  },
  {
    id: "templates",
    title: "Template Builder",
    description: "Create reusable request templates",
    icon: <Sparkles className="w-5 h-5" />,
    link: "/dashboard/templates",
    badge: "Popular",
  },
  {
    id: "uploads",
    title: "Upload Review",
    description: "Review, approve, and manage uploaded content",
    icon: <Upload className="w-5 h-5" />,
    link: "/dashboard/uploads",
  },
  {
    id: "analytics",
    title: "Analytics",
    description: "Track performance metrics and insights",
    icon: <BarChart3 className="w-5 h-5" />,
    link: "/dashboard/analytics",
  },
  {
    id: "team",
    title: "Team Settings",
    description: "Manage team members and permissions",
    icon: <Settings className="w-5 h-5" />,
    link: "/dashboard/team",
  },
  {
    id: "reminders",
    title: "Reminders & Notifications",
    description: "Configure automated reminders and alerts",
    icon: <Bell className="w-5 h-5" />,
    link: "/dashboard/reminders",
    badge: "New",
  },
];

const VIDEO_TUTORIALS: VideoTutorial[] = [
  {
    id: "advanced-features",
    title: "Advanced Features Deep Dive",
    description: "Templates, analytics, and team collaboration",
    duration: "15:30",
    comingSoon: true,
  },
  {
    id: "creator-portal-tour",
    title: "Creator Portal Tour",
    description: "What your creators see and how they use it",
    duration: "5:45",
    comingSoon: true,
  },
  {
    id: "automation-tips",
    title: "Automation & Productivity Tips",
    description: "Save time with templates and reminders",
    duration: "8:12",
    comingSoon: true,
  },
];

const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  { keys: ["Ctrl/Cmd", "K"], description: "Quick search", category: "Navigation" },
  { keys: ["Ctrl/Cmd", "N"], description: "New request", category: "Actions" },
  { keys: ["Ctrl/Cmd", "Shift", "C"], description: "New creator", category: "Actions" },
  { keys: ["Ctrl/Cmd", "S"], description: "Save changes", category: "Actions" },
  { keys: ["Ctrl/Cmd", "Z"], description: "Undo last action", category: "Actions" },
  { keys: ["Ctrl/Cmd", "D"], description: "Duplicate item", category: "Actions" },
  { keys: ["G", "D"], description: "Go to Dashboard", category: "Navigation" },
  { keys: ["G", "C"], description: "Go to Creators", category: "Navigation" },
  { keys: ["G", "R"], description: "Go to Requests", category: "Navigation" },
  { keys: ["G", "U"], description: "Go to Uploads", category: "Navigation" },
  { keys: ["G", "T"], description: "Go to Templates", category: "Navigation" },
  { keys: ["G", "A"], description: "Go to Analytics", category: "Navigation" },
  { keys: ["Esc"], description: "Close modal/dialog", category: "General" },
  { keys: ["?"], description: "Show keyboard shortcuts", category: "General" },
  { keys: ["Space"], description: "Preview selected file", category: "Content" },
  { keys: ["A"], description: "Approve selected upload", category: "Content" },
  { keys: ["R"], description: "Request revision", category: "Content" },
  { keys: ["Delete"], description: "Delete selected item", category: "Actions" },
];

const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    id: "v2.5.0",
    version: "2.5.0",
    date: "March 25, 2026",
    title: "Bulk Actions & Enhanced Analytics",
    description:
      "Added bulk approve/reject for uploads, new analytics dashboard with trend insights, and improved mobile experience.",
    type: "feature",
  },
  {
    id: "v2.4.2",
    version: "2.4.2",
    date: "March 18, 2026",
    title: "Performance Improvements",
    description:
      "50% faster page loads, optimized image previews, and reduced memory usage for large file handling.",
    type: "improvement",
  },
  {
    id: "v2.4.1",
    version: "2.4.1",
    date: "March 10, 2026",
    title: "Bug Fixes",
    description:
      "Fixed reminder scheduling timezone issues, resolved file upload progress display, and corrected team permission checks.",
    type: "fix",
  },
  {
    id: "v2.4.0",
    version: "2.4.0",
    date: "March 1, 2026",
    title: "Smart Templates & Reminders",
    description:
      "Introducing smart templates with AI-powered suggestions, enhanced reminder system with SMS support, and in-app messaging.",
    type: "feature",
  },
  {
    id: "v2.3.0",
    version: "2.3.0",
    date: "February 15, 2026",
    title: "Team Collaboration Features",
    description:
      "New team management dashboard, role-based permissions, activity feed, and shared templates across team.",
    type: "feature",
  },
];

// ============================================
// COMPONENTS
// ============================================

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative max-w-2xl mx-auto">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-muted-foreground" />
      </div>
      <Input
        type="search"
        placeholder="Search help articles, guides, and FAQs..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-12 pr-4 h-14 text-base rounded-2xl border-2 border-border/50 bg-card shadow-sm focus-visible:border-primary"
      />
      <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
        <kbd className="hidden md:inline-flex items-center gap-1 px-2 py-1 rounded bg-muted text-xs text-muted-foreground">
          <Command className="h-3 w-3" />K
        </kbd>
      </div>
    </div>
  );
}

function QuickStartCard({ guide }: { guide: QuickStartGuide }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className="card-elevated overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left"
      >
        <CardHeader className="pb-3">
          <div className="flex items-start gap-4">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/10 to-violet-500/10 flex items-center justify-center text-primary flex-shrink-0">
              {guide.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <CardTitle className="text-base">{guide.title}</CardTitle>
                <Badge variant="secondary" className="text-[10px]">
                  <Clock className="w-3 h-3 mr-1" />
                  {guide.estimatedTime}
                </Badge>
              </div>
              <CardDescription className="text-sm">
                {guide.description}
              </CardDescription>
            </div>
            <ChevronDown
              className={cn(
                "h-5 w-5 text-muted-foreground transition-transform flex-shrink-0",
                isExpanded && "rotate-180"
              )}
            />
          </div>
        </CardHeader>
      </button>

      {isExpanded && (
        <CardContent className="pt-0 animate-slide-down">
          <div className="pl-[60px]">
            <ol className="space-y-2 mb-4">
              {guide.steps.map((step, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center">
                    {index + 1}
                  </span>
                  <span className="text-sm text-muted-foreground pt-0.5">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
            {guide.link && (
              <Link href={guide.link}>
                <Button size="sm" className="btn-gradient">
                  Start Guide
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function FAQAccordion({
  items,
  searchQuery,
}: {
  items: FAQItem[];
  searchQuery: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.question.toLowerCase().includes(query) ||
        item.answer.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
    );
  }, [items, searchQuery]);

  if (filteredItems.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <HelpCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No FAQ items match your search.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filteredItems.map((item) => (
        <div
          key={item.id}
          className="rounded-xl border bg-card overflow-hidden transition-all hover:shadow-sm"
        >
          <button
            onClick={() => setOpenId(openId === item.id ? null : item.id)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-accent/30 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Badge variant="outline" className="text-[10px] flex-shrink-0">
                {item.category}
              </Badge>
              <span className="font-medium text-sm truncate">
                {item.question}
              </span>
            </div>
            <ChevronRight
              className={cn(
                "w-5 h-5 flex-shrink-0 text-muted-foreground transition-transform ml-2",
                openId === item.id && "rotate-90"
              )}
            />
          </button>
          {openId === item.id && (
            <div className="px-4 pb-4 pt-0 animate-slide-down">
              <div className="pl-[calc(theme(spacing.3)+4rem)] md:pl-[calc(theme(spacing.3)+5rem)]">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.answer}
                </p>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function FeatureGuideCard({ guide }: { guide: FeatureGuide }) {
  return (
    <Link href={guide.link}>
      <Card className="card-elevated h-full hover:border-primary/30 transition-all group cursor-pointer">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/10 to-violet-500/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              {guide.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium text-sm group-hover:text-primary transition-colors">
                  {guide.title}
                </h3>
                {guide.badge && (
                  <Badge
                    variant="default"
                    className="text-[10px] bg-primary/10 text-primary border-0"
                  >
                    {guide.badge}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {guide.description}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function VideoTutorialCard({ tutorial }: { tutorial: VideoTutorial }) {
  return (
    <Card
      className={cn(
        "card-elevated overflow-hidden group cursor-pointer",
        tutorial.comingSoon && "opacity-75"
      )}
    >
      <div className="aspect-video bg-gradient-to-br from-primary/20 via-violet-500/15 to-purple-500/20 flex items-center justify-center relative">
        {tutorial.comingSoon ? (
          <div className="text-center">
            <Clock className="w-8 h-8 text-primary/50 mx-auto mb-2" />
            <span className="text-xs text-muted-foreground">Coming Soon</span>
          </div>
        ) : (
          <div className="w-14 h-14 rounded-full bg-white/90 dark:bg-black/50 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
            <Play className="w-6 h-6 text-primary ml-1" />
          </div>
        )}
        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-white text-xs">
          {tutorial.duration}
        </div>
      </div>
      <CardContent className="pt-4">
        <h4 className="font-medium text-sm mb-1 group-hover:text-primary transition-colors">
          {tutorial.title}
        </h4>
        <p className="text-xs text-muted-foreground">{tutorial.description}</p>
      </CardContent>
    </Card>
  );
}

function KeyboardShortcutsCard() {
  const shortcutsByCategory = useMemo(() => {
    return KEYBOARD_SHORTCUTS.reduce(
      (acc, shortcut) => {
        if (!acc[shortcut.category]) {
          acc[shortcut.category] = [];
        }
        acc[shortcut.category].push(shortcut);
        return acc;
      },
      {} as Record<string, KeyboardShortcut[]>
    );
  }, []);

  const categoryIcons: Record<string, React.ReactNode> = {
    Navigation: <ArrowRight className="w-4 h-4" />,
    Actions: <Zap className="w-4 h-4" />,
    Content: <Eye className="w-4 h-4" />,
    General: <Keyboard className="w-4 h-4" />,
  };

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Keyboard className="w-5 h-5 text-primary" />
          Keyboard Shortcuts
        </CardTitle>
        <CardDescription>
          Power user shortcuts for faster navigation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {Object.entries(shortcutsByCategory).map(([category, shortcuts]) => (
            <div key={category}>
              <h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
                {categoryIcons[category]}
                {category}
              </h4>
              <div className="space-y-2">
                {shortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <React.Fragment key={keyIndex}>
                          <kbd className="px-2 py-1 rounded bg-muted text-xs font-mono">
                            {key}
                          </kbd>
                          {keyIndex < shortcut.keys.length - 1 && (
                            <span className="text-muted-foreground text-xs">
                              +
                            </span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ChangelogSection() {
  const typeConfig = {
    feature: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-600 dark:text-emerald-400",
      label: "New Feature",
    },
    improvement: {
      bg: "bg-blue-500/10",
      text: "text-blue-600 dark:text-blue-400",
      label: "Improvement",
    },
    fix: {
      bg: "bg-amber-500/10",
      text: "text-amber-600 dark:text-amber-400",
      label: "Bug Fix",
    },
  };

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <RefreshCw className="w-5 h-5 text-primary" />
          What&apos;s New
        </CardTitle>
        <CardDescription>Recent updates and improvements</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {CHANGELOG_ENTRIES.map((entry) => {
            const config = typeConfig[entry.type];
            return (
              <div
                key={entry.id}
                className="flex gap-4 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex-shrink-0 w-12 text-center">
                  <div className="text-xs font-semibold text-primary">
                    {entry.version}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="font-medium text-sm">{entry.title}</h4>
                    <Badge
                      variant="secondary"
                      className={cn("text-[10px]", config.bg, config.text)}
                    >
                      {config.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {entry.description}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {entry.date}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <Button variant="outline" className="w-full mt-4">
          View Full Changelog
          <ExternalLink className="w-4 h-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}

function ContactSupportSection() {
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate submission
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSubmitting(false);
    setIsSubmitted(true);
    setTicketSubject("");
    setTicketMessage("");
    setTimeout(() => setIsSubmitted(false), 3000);
  };

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageCircle className="w-5 h-5 text-primary" />
          Contact Support
        </CardTitle>
        <CardDescription>Get help from our support team</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quick Contact Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href="mailto:support@uploadportal.com"
            className="flex items-center gap-3 p-4 rounded-xl border hover:border-primary/30 hover:bg-accent/30 transition-all group"
          >
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-sm group-hover:text-primary transition-colors">
                Email Support
              </p>
              <p className="text-xs text-muted-foreground">
                support@uploadportal.com
              </p>
            </div>
          </a>
          <button
            className="flex items-center gap-3 p-4 rounded-xl border hover:border-primary/30 hover:bg-accent/30 transition-all group cursor-not-allowed opacity-60"
            disabled
          >
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">Live Chat</p>
                <Badge variant="secondary" className="text-[10px]">
                  Coming Soon
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Chat with our team in real-time
              </p>
            </div>
          </button>
        </div>

        {/* Submit Ticket Form */}
        <div className="border-t pt-6">
          <h4 className="font-medium text-sm mb-4 flex items-center gap-2">
            <Send className="w-4 h-4 text-primary" />
            Submit a Support Ticket
          </h4>
          {isSubmitted ? (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm">
                Ticket submitted successfully! We&apos;ll get back to you soon.
              </span>
            </div>
          ) : (
            <form onSubmit={handleSubmitTicket} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ticket-subject" className="text-sm">
                  Subject
                </Label>
                <Input
                  id="ticket-subject"
                  placeholder="Brief description of your issue"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ticket-message" className="text-sm">
                  Message
                </Label>
                <Textarea
                  id="ticket-message"
                  placeholder="Please describe your issue in detail..."
                  value={ticketMessage}
                  onChange={(e) => setTicketMessage(e.target.value)}
                  rows={4}
                  required
                />
              </div>
              <Button
                type="submit"
                className="btn-gradient w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Submit Ticket
                  </>
                )}
              </Button>
            </form>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

interface HelpCenterProps {
  isAuthenticated?: boolean;
}

export function HelpCenter({ isAuthenticated = true }: HelpCenterProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter all content based on search
  const hasSearchResults = useMemo(() => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();

    const matchesGuides = QUICK_START_GUIDES.some(
      (g) =>
        g.title.toLowerCase().includes(query) ||
        g.description.toLowerCase().includes(query)
    );
    const matchesFAQ = FAQ_ITEMS.some(
      (f) =>
        f.question.toLowerCase().includes(query) ||
        f.answer.toLowerCase().includes(query)
    );
    const matchesFeatures = FEATURE_GUIDES.some(
      (f) =>
        f.title.toLowerCase().includes(query) ||
        f.description.toLowerCase().includes(query)
    );

    return matchesGuides || matchesFAQ || matchesFeatures;
  }, [searchQuery]);

  return (
    <div className="space-y-8 md:space-y-12 animate-fade-in">
      {/* Hero Section */}
      <div className="text-center space-y-4 py-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
          <HelpCircle className="w-4 h-4" />
          Help Center
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          How can we help you?
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Find answers, guides, and resources to help you get the most out of
          UploadPortal.
        </p>
        <div className="pt-4">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>
      </div>

      {!hasSearchResults && (
        <div className="text-center py-12">
          <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-medium mb-2">No results found</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            We couldn&apos;t find anything matching &quot;{searchQuery}&quot;.
            Try a different search term or browse the sections below.
          </p>
          <Button
            variant="outline"
            onClick={() => setSearchQuery("")}
            className="mt-4"
          >
            <X className="w-4 h-4 mr-2" />
            Clear Search
          </Button>
        </div>
      )}

      {hasSearchResults && (
        <>
          {/* Quick Start Guides */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Rocket className="w-5 h-5 text-primary" />
                  Quick Start Guides
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Step-by-step guides to get you started
                </p>
              </div>
            </div>
            <div className="grid gap-4">
              {QUICK_START_GUIDES.filter((guide) => {
                if (!searchQuery) return true;
                const query = searchQuery.toLowerCase();
                return (
                  guide.title.toLowerCase().includes(query) ||
                  guide.description.toLowerCase().includes(query)
                );
              }).map((guide) => (
                <QuickStartCard key={guide.id} guide={guide} />
              ))}
            </div>
          </section>

          {/* FAQ Section */}
          <section>
            <div className="mb-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-primary" />
                Frequently Asked Questions
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Quick answers to common questions
              </p>
            </div>
            <FAQAccordion items={FAQ_ITEMS} searchQuery={searchQuery} />
          </section>

          {/* Feature Guides */}
          <section>
            <div className="mb-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                Feature Guides
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Detailed guides for each feature
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {FEATURE_GUIDES.filter((guide) => {
                if (!searchQuery) return true;
                const query = searchQuery.toLowerCase();
                return (
                  guide.title.toLowerCase().includes(query) ||
                  guide.description.toLowerCase().includes(query)
                );
              }).map((guide) => (
                <FeatureGuideCard key={guide.id} guide={guide} />
              ))}
            </div>
          </section>

          {/* Video Tutorials */}
          <section>
            <div className="mb-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Video className="w-5 h-5 text-primary" />
                Video Tutorials
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Watch and learn at your own pace
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {VIDEO_TUTORIALS.map((tutorial) => (
                <VideoTutorialCard key={tutorial.id} tutorial={tutorial} />
              ))}
            </div>
          </section>

          {/* Two Column Layout for Shortcuts, Changelog, and Support */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <KeyboardShortcutsCard />
            <div className="space-y-6">
              <ChangelogSection />
              <ContactSupportSection />
            </div>
          </div>
        </>
      )}

      {/* Footer CTA */}
      <div className="text-center py-8 border-t">
        <p className="text-muted-foreground mb-4">
          Still need help? Our support team is here for you.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a href="mailto:support@uploadportal.com">
            <Button variant="outline">
              <Mail className="w-4 h-4 mr-2" />
              Email Support
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
