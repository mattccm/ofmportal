// ============================================
// HELP CONTENT DEFINITIONS
// Centralized help text for contextual help system
// ============================================

export interface HelpLink {
  label: string;
  url: string;
  isExternal?: boolean;
}

export interface HelpContent {
  /** Unique key for the help content */
  key: string;
  /** Short title for the help item */
  title: string;
  /** Brief description (shown in popover) */
  description: string;
  /** Detailed explanation (optional) */
  details?: string;
  /** Tips or best practices */
  tips?: string[];
  /** Link to full documentation */
  docsLink?: HelpLink;
  /** Optional video tutorial link */
  videoLink?: HelpLink;
  /** Related help topics */
  relatedTopics?: string[];
  /** Category for grouping */
  category: HelpCategory;
}

export type HelpCategory =
  | "dashboard"
  | "requests"
  | "uploads"
  | "creators"
  | "settings"
  | "analytics"
  | "forms"
  | "templates"
  | "notifications"
  | "security";

// ============================================
// DASHBOARD HELP CONTENT
// ============================================

export const dashboardHelp: Record<string, HelpContent> = {
  // Stats widgets
  "dashboard.total-uploads": {
    key: "dashboard.total-uploads",
    title: "Total Uploads",
    description: "The total number of files uploaded by your creators during the selected time period.",
    details: "This metric counts all files uploaded, including approved, pending, and rejected uploads. Use this to track overall creator engagement and content volume.",
    tips: [
      "Compare week-over-week to identify trends",
      "Higher upload counts may indicate need for more reviewers",
      "Monitor for sudden drops which may indicate creator issues",
    ],
    docsLink: {
      label: "Understanding Upload Metrics",
      url: "/help/metrics/uploads",
    },
    category: "dashboard",
  },

  "dashboard.approval-rate": {
    key: "dashboard.approval-rate",
    title: "Approval Rate",
    description: "The percentage of uploads that were approved on first submission.",
    details: "A higher approval rate indicates better alignment between your requirements and creator output. Industry benchmark is typically 70-85%.",
    tips: [
      "Low rates may indicate unclear briefs",
      "Use templates to standardize requirements",
      "Consider providing example content for reference",
    ],
    docsLink: {
      label: "Improving Approval Rates",
      url: "/help/best-practices/approval-rates",
    },
    videoLink: {
      label: "Video: Quality Guidelines",
      url: "https://youtube.com/watch?v=example",
      isExternal: true,
    },
    category: "dashboard",
  },

  "dashboard.avg-turnaround": {
    key: "dashboard.avg-turnaround",
    title: "Average Turnaround",
    description: "The average time from request creation to final approval.",
    details: "This measures your entire workflow efficiency. Lower turnaround times mean faster content delivery to your clients or projects.",
    tips: [
      "Set clear deadlines for each request",
      "Use priority flags for urgent content",
      "Send reminder notifications for pending items",
    ],
    docsLink: {
      label: "Optimizing Workflow",
      url: "/help/workflow/turnaround",
    },
    category: "dashboard",
  },

  "dashboard.active-creators": {
    key: "dashboard.active-creators",
    title: "Active Creators",
    description: "Creators who have uploaded at least one file during the selected time period.",
    details: "Track creator engagement and identify inactive accounts that may need follow-up or removal.",
    tips: [
      "Reach out to inactive creators periodically",
      "Reward top performers to maintain engagement",
      "Consider workload distribution among active creators",
    ],
    category: "dashboard",
  },

  "dashboard.pending-requests": {
    key: "dashboard.pending-requests",
    title: "Pending Requests Widget",
    description: "Shows requests awaiting creator uploads or your review.",
    details: "This widget displays requests that need attention, sorted by urgency. Overdue items are highlighted in red.",
    tips: [
      "Click any request to view details",
      "Use the 'View all' link to see complete list",
      "Process overdue items first",
    ],
    category: "dashboard",
  },

  "dashboard.recent-uploads": {
    key: "dashboard.recent-uploads",
    title: "Recent Uploads Widget",
    description: "Displays the most recent file uploads from your creators.",
    details: "Preview and quickly review new content as it arrives. Click thumbnails to view full-size versions.",
    tips: [
      "Enable notifications for instant upload alerts",
      "Use quick actions to approve common content types",
      "Sort by creator to batch review submissions",
    ],
    category: "dashboard",
  },

  "dashboard.upcoming-deadlines": {
    key: "dashboard.upcoming-deadlines",
    title: "Upcoming Deadlines Widget",
    description: "Lists requests with approaching due dates.",
    details: "Stay on top of time-sensitive content needs. Color coding indicates urgency level.",
    tips: [
      "Yellow indicates due within 48 hours",
      "Red indicates due within 24 hours",
      "Send reminders for approaching deadlines",
    ],
    category: "dashboard",
  },
};

// ============================================
// FORM FIELD HELP CONTENT
// ============================================

export const formFieldHelp: Record<string, HelpContent> = {
  // Request form fields
  "form.request-title": {
    key: "form.request-title",
    title: "Request Title",
    description: "A clear, descriptive title for your content request.",
    details: "The title appears in creator notifications and dashboards. Make it specific enough to identify the project at a glance.",
    tips: [
      "Include client or project name if applicable",
      "Be specific: 'Summer 2024 Product Photos' vs 'Photos'",
      "Keep it under 60 characters for best display",
    ],
    category: "forms",
  },

  "form.request-description": {
    key: "form.request-description",
    title: "Request Description",
    description: "Detailed requirements and specifications for the content.",
    details: "Provide all the context creators need to deliver exactly what you want. More detail = better results.",
    tips: [
      "Include dimensions, formats, and quality requirements",
      "Describe the intended use and audience",
      "Reference example content when possible",
      "List any brand guidelines or restrictions",
    ],
    docsLink: {
      label: "Writing Effective Briefs",
      url: "/help/requests/writing-briefs",
    },
    category: "forms",
  },

  "form.request-due-date": {
    key: "form.request-due-date",
    title: "Due Date",
    description: "The deadline for content submission.",
    details: "Creators will see this deadline and receive automated reminders. Allow adequate time for revisions if needed.",
    tips: [
      "Set realistic deadlines (at least 24-48 hours)",
      "Account for time zone differences",
      "Build in buffer time for revisions",
    ],
    category: "forms",
  },

  "form.request-priority": {
    key: "form.request-priority",
    title: "Priority Level",
    description: "Indicates the urgency of the request.",
    tips: [
      "High: Urgent, needs immediate attention",
      "Medium: Standard turnaround expected",
      "Low: Flexible deadline, no rush",
    ],
    category: "forms",
  },

  "form.file-types": {
    key: "form.file-types",
    title: "Accepted File Types",
    description: "Specify which file formats are acceptable for this request.",
    details: "Restricting file types ensures you receive content in usable formats. Creators will only be able to upload matching files.",
    tips: [
      "Images: JPG, PNG, WebP for web; TIFF for print",
      "Videos: MP4, MOV for most uses",
      "Documents: PDF for final, DOCX for editable",
    ],
    category: "forms",
  },

  "form.max-file-size": {
    key: "form.max-file-size",
    title: "Maximum File Size",
    description: "The maximum allowed size for individual file uploads.",
    details: "Larger limits allow high-quality content but use more storage. Consider your storage plan limits.",
    tips: [
      "Photos: 10-50MB usually sufficient",
      "Videos: May need 500MB+ for 4K content",
      "Check your plan's storage limits",
    ],
    category: "forms",
  },

  "form.creator-email": {
    key: "form.creator-email",
    title: "Creator Email",
    description: "The email address used for creator login and notifications.",
    details: "Creators will receive an invitation to set up their account at this email address.",
    tips: [
      "Verify the email address is correct",
      "Use professional email addresses when possible",
      "Creators can update their email later in settings",
    ],
    category: "forms",
  },

  "form.creator-name": {
    key: "form.creator-name",
    title: "Creator Name",
    description: "How the creator will be identified in the system.",
    details: "This name appears in request assignments, leaderboards, and communications.",
    tips: [
      "Use full name for easy identification",
      "Or use business/brand name if applicable",
    ],
    category: "forms",
  },
};

// ============================================
// SETTINGS HELP CONTENT
// ============================================

export const settingsHelp: Record<string, HelpContent> = {
  "settings.two-factor": {
    key: "settings.two-factor",
    title: "Two-Factor Authentication",
    description: "Add an extra layer of security to your account.",
    details: "When enabled, you'll need to enter a code from your authenticator app in addition to your password when logging in.",
    tips: [
      "Use an app like Google Authenticator or Authy",
      "Save backup codes in a secure location",
      "Required for team admin accounts",
    ],
    docsLink: {
      label: "Setting Up 2FA",
      url: "/help/security/two-factor",
    },
    videoLink: {
      label: "Video Tutorial",
      url: "https://youtube.com/watch?v=2fa-setup",
      isExternal: true,
    },
    category: "security",
  },

  "settings.email-notifications": {
    key: "settings.email-notifications",
    title: "Email Notifications",
    description: "Control which events trigger email notifications.",
    details: "Customize your notification preferences to stay informed without inbox overload.",
    tips: [
      "Enable for new uploads if you review frequently",
      "Use digest mode for less urgent updates",
      "Disable for activity you monitor in-app",
    ],
    category: "notifications",
  },

  "settings.push-notifications": {
    key: "settings.push-notifications",
    title: "Push Notifications",
    description: "Receive instant browser notifications for important events.",
    details: "Push notifications appear even when you're not actively using UploadPortal, ensuring you never miss urgent updates.",
    tips: [
      "Best for time-sensitive events like new uploads",
      "Enable quiet hours to avoid interruptions",
      "Requires browser permission",
    ],
    category: "notifications",
  },

  "settings.digest-frequency": {
    key: "settings.digest-frequency",
    title: "Digest Frequency",
    description: "How often you receive summary emails of activity.",
    details: "Instead of individual emails, get a consolidated summary of all activity at your preferred interval.",
    tips: [
      "Daily: Good for active accounts",
      "Weekly: Better for lower volume",
      "Disable if you prefer real-time notifications",
    ],
    category: "notifications",
  },

  "settings.quiet-hours": {
    key: "settings.quiet-hours",
    title: "Quiet Hours",
    description: "Pause notifications during specified hours.",
    details: "Notifications will be silenced during these hours but queued for delivery afterward.",
    tips: [
      "Set to your non-working hours",
      "Respects your timezone setting",
      "Critical alerts still come through",
    ],
    category: "notifications",
  },

  "settings.api-keys": {
    key: "settings.api-keys",
    title: "API Keys",
    description: "Manage API keys for external integrations.",
    details: "Generate and manage API keys that allow external services to interact with your UploadPortal account programmatically.",
    tips: [
      "Use descriptive names for each key",
      "Rotate keys periodically for security",
      "Revoke unused keys immediately",
    ],
    docsLink: {
      label: "API Documentation",
      url: "/api/docs",
    },
    category: "security",
  },

  "settings.webhooks": {
    key: "settings.webhooks",
    title: "Webhooks",
    description: "Configure webhooks to receive real-time event notifications.",
    details: "Webhooks send HTTP POST requests to your specified URL when events occur in your account.",
    tips: [
      "Use HTTPS endpoints only",
      "Implement signature verification",
      "Handle retries for failed deliveries",
    ],
    docsLink: {
      label: "Webhook Guide",
      url: "/help/integrations/webhooks",
    },
    category: "settings",
  },

  "settings.timezone": {
    key: "settings.timezone",
    title: "Timezone",
    description: "Your local timezone for dates and scheduling.",
    details: "All dates and times in the interface will be displayed in your selected timezone. Deadlines are also calculated based on this setting.",
    tips: [
      "Updates apply immediately",
      "Affects deadline calculations",
      "Creators see dates in their own timezone",
    ],
    category: "settings",
  },

  "settings.storage-usage": {
    key: "settings.storage-usage",
    title: "Storage Usage",
    description: "Your current storage consumption and limits.",
    details: "View how much storage you're using and what's included in your plan. High-resolution media can consume significant storage.",
    tips: [
      "Archive old completed requests",
      "Delete rejected uploads after review",
      "Upgrade plan if consistently near limit",
    ],
    docsLink: {
      label: "Storage Management",
      url: "/help/storage/managing-storage",
    },
    category: "settings",
  },
};

// ============================================
// ANALYTICS HELP CONTENT
// ============================================

export const analyticsHelp: Record<string, HelpContent> = {
  "analytics.status-breakdown": {
    key: "analytics.status-breakdown",
    title: "Request Status Breakdown",
    description: "Visual distribution of requests across different statuses.",
    details: "This chart shows the proportion of requests in each status. Use it to identify bottlenecks in your workflow.",
    tips: [
      "High 'Pending' count may indicate slow creators",
      "High 'Under Review' suggests review backlog",
      "Aim for majority in 'Approved' status",
    ],
    category: "analytics",
  },

  "analytics.weekly-activity": {
    key: "analytics.weekly-activity",
    title: "Weekly Activity Chart",
    description: "Tracks uploads, approvals, and requests over recent weeks.",
    details: "Compare activity trends across different metrics to understand your content pipeline flow.",
    tips: [
      "Look for patterns in weekly cycles",
      "Spikes may correlate with campaigns",
      "Drops may indicate seasonal trends",
    ],
    category: "analytics",
  },

  "analytics.activity-heatmap": {
    key: "analytics.activity-heatmap",
    title: "Activity Heatmap",
    description: "Visualizes upload activity patterns over the past 90 days.",
    details: "Darker colors indicate more uploads on that day. Use this to understand when your creators are most active.",
    tips: [
      "Schedule deadlines on high-activity days",
      "Identify slow periods for planning",
      "Compare to your review capacity",
    ],
    category: "analytics",
  },

  "analytics.creator-leaderboard": {
    key: "analytics.creator-leaderboard",
    title: "Creator Leaderboard",
    description: "Rankings based on upload volume and approval rates.",
    details: "See which creators are most productive and maintain the highest quality standards.",
    tips: [
      "Reward top performers",
      "Identify creators needing support",
      "Balance workload across creators",
    ],
    category: "analytics",
  },

  "analytics.donut-chart": {
    key: "analytics.donut-chart",
    title: "Overview Summary",
    description: "Quick visual summary of request statuses.",
    details: "The donut chart provides an at-a-glance view of your overall request distribution.",
    tips: [
      "Completed requests are shown in green",
      "In-review requests are shown in purple",
      "Pending requests are shown in amber",
    ],
    category: "analytics",
  },

  "analytics.date-range": {
    key: "analytics.date-range",
    title: "Date Range Selector",
    description: "Filter analytics data by time period.",
    details: "Choose from preset ranges to analyze different time periods. All metrics will update to reflect the selected range.",
    tips: [
      "7 days: Recent activity snapshot",
      "30 days: Monthly performance view",
      "90 days: Quarterly trends analysis",
    ],
    category: "analytics",
  },

  "analytics.insights": {
    key: "analytics.insights",
    title: "Performance Insights",
    description: "AI-generated recommendations based on your data.",
    details: "Our system analyzes your metrics and provides actionable suggestions to improve your workflow and content quality.",
    tips: [
      "Check insights after significant changes",
      "Compare recommendations over time",
      "Act on high-impact suggestions first",
    ],
    category: "analytics",
  },
};

// ============================================
// UPLOADS HELP CONTENT
// ============================================

export const uploadsHelp: Record<string, HelpContent> = {
  "uploads.drag-drop": {
    key: "uploads.drag-drop",
    title: "Drag and Drop Upload",
    description: "Upload files by dragging them onto the upload zone.",
    details: "You can drag multiple files at once. Files will be validated against the request's accepted types and size limits.",
    tips: [
      "Drag entire folders to upload all contents",
      "Watch for the green highlight to confirm drop zone",
      "Large files show progress indicators",
    ],
    category: "uploads",
  },

  "uploads.review-status": {
    key: "uploads.review-status",
    title: "Review Status",
    description: "Current approval status of uploaded content.",
    details: "Each upload goes through a review process before final approval. Status indicates where it is in that process.",
    tips: [
      "Pending: Awaiting initial review",
      "Under Review: Currently being evaluated",
      "Needs Revision: Changes requested",
      "Approved: Ready for use",
    ],
    category: "uploads",
  },

  "uploads.bulk-actions": {
    key: "uploads.bulk-actions",
    title: "Bulk Actions",
    description: "Perform actions on multiple uploads at once.",
    details: "Select multiple uploads using checkboxes, then choose an action from the bulk actions bar.",
    tips: [
      "Use Shift+Click to select ranges",
      "Ctrl/Cmd+A selects all visible items",
      "Actions apply to all selected items",
    ],
    category: "uploads",
  },

  "uploads.version-history": {
    key: "uploads.version-history",
    title: "Version History",
    description: "View and restore previous versions of uploaded files.",
    details: "When creators submit revisions, previous versions are preserved. You can view or restore any past version.",
    tips: [
      "Compare versions side-by-side",
      "Restore previous versions if needed",
      "Versions are kept for 90 days",
    ],
    category: "uploads",
  },
};

// ============================================
// REQUESTS HELP CONTENT
// ============================================

export const requestsHelp: Record<string, HelpContent> = {
  "requests.status-filter": {
    key: "requests.status-filter",
    title: "Status Filter",
    description: "Filter requests by their current status.",
    details: "Quickly find requests at specific stages of your workflow by filtering on status.",
    tips: [
      "Multiple statuses can be selected",
      "Use 'All' to clear filters",
      "Filters persist across sessions",
    ],
    category: "requests",
  },

  "requests.priority-filter": {
    key: "requests.priority-filter",
    title: "Priority Filter",
    description: "Filter requests by priority level.",
    details: "Focus on high-priority work or review low-priority items during slower periods.",
    tips: [
      "High priority shows red indicators",
      "Sort by priority to see urgent first",
      "Combine with status filter for precision",
    ],
    category: "requests",
  },

  "requests.clone": {
    key: "requests.clone",
    title: "Clone Request",
    description: "Create a copy of an existing request.",
    details: "Cloning copies all settings and requirements to a new request. Useful for recurring content needs.",
    tips: [
      "Update dates after cloning",
      "Modify description as needed",
      "Cloned requests start as drafts",
    ],
    category: "requests",
  },

  "requests.assign-creator": {
    key: "requests.assign-creator",
    title: "Assign Creator",
    description: "Assign one or more creators to a request.",
    details: "Assigned creators receive notifications and can upload content for this request.",
    tips: [
      "Multiple creators can be assigned",
      "Consider creator strengths and availability",
      "Reassignment notifies all parties",
    ],
    category: "requests",
  },
};

// ============================================
// TEMPLATES HELP CONTENT
// ============================================

export const templatesHelp: Record<string, HelpContent> = {
  "templates.create": {
    key: "templates.create",
    title: "Create Template",
    description: "Build a reusable template for common request types.",
    details: "Templates save time by pre-filling request details. Perfect for recurring content needs.",
    tips: [
      "Include standard requirements",
      "Set default file type restrictions",
      "Add helpful description examples",
    ],
    docsLink: {
      label: "Template Best Practices",
      url: "/help/templates/best-practices",
    },
    category: "templates",
  },

  "templates.fields": {
    key: "templates.fields",
    title: "Template Fields",
    description: "Add custom fields to collect specific information.",
    details: "Custom fields appear when creating requests from this template. Use them for project-specific details.",
    tips: [
      "Mark required fields appropriately",
      "Use dropdowns for limited options",
      "Add helper text for clarity",
    ],
    category: "templates",
  },

  "templates.defaults": {
    key: "templates.defaults",
    title: "Default Values",
    description: "Pre-fill common values to speed up request creation.",
    details: "Default values are applied automatically when using the template but can be changed for each request.",
    tips: [
      "Set typical deadline offsets",
      "Pre-select common file types",
      "Include standard description text",
    ],
    category: "templates",
  },
};

// ============================================
// CREATORS HELP CONTENT
// ============================================

export const creatorsHelp: Record<string, HelpContent> = {
  "creators.invite": {
    key: "creators.invite",
    title: "Invite Creator",
    description: "Send an invitation to a new creator.",
    details: "Creators receive an email with instructions to set up their account and access their portal.",
    tips: [
      "Invitations expire after 7 days",
      "Resend if invitation wasn't received",
      "Include a personal note for context",
    ],
    category: "creators",
  },

  "creators.score": {
    key: "creators.score",
    title: "Creator Score",
    description: "Performance score based on quality and timeliness.",
    details: "Scores range from 0-100 and factor in approval rates, deadline adherence, and revision requirements.",
    tips: [
      "90+: Excellent performer",
      "70-89: Good performer",
      "Below 70: May need support",
    ],
    category: "creators",
  },

  "creators.vault": {
    key: "creators.vault",
    title: "Creator Vault",
    description: "All content uploaded by this creator.",
    details: "Browse the complete upload history for a specific creator. Filter by date, status, or request.",
    tips: [
      "Use for portfolio reviews",
      "Track improvement over time",
      "Download for offline review",
    ],
    category: "creators",
  },
};

// ============================================
// COMBINED HELP CONTENT MAP
// ============================================

export const allHelpContent: Record<string, HelpContent> = {
  ...dashboardHelp,
  ...formFieldHelp,
  ...settingsHelp,
  ...analyticsHelp,
  ...uploadsHelp,
  ...requestsHelp,
  ...templatesHelp,
  ...creatorsHelp,
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get help content by key
 */
export function getHelpContent(key: string): HelpContent | undefined {
  return allHelpContent[key];
}

/**
 * Get help content by category
 */
export function getHelpByCategory(category: HelpCategory): HelpContent[] {
  return Object.values(allHelpContent).filter((help) => help.category === category);
}

/**
 * Search help content
 */
export function searchHelpContent(query: string): HelpContent[] {
  const lowerQuery = query.toLowerCase();
  return Object.values(allHelpContent).filter(
    (help) =>
      help.title.toLowerCase().includes(lowerQuery) ||
      help.description.toLowerCase().includes(lowerQuery) ||
      help.details?.toLowerCase().includes(lowerQuery) ||
      help.tips?.some((tip) => tip.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Get related help content
 */
export function getRelatedHelp(key: string): HelpContent[] {
  const content = allHelpContent[key];
  if (!content?.relatedTopics) return [];

  return content.relatedTopics
    .map((topicKey) => allHelpContent[topicKey])
    .filter(Boolean) as HelpContent[];
}

export default allHelpContent;
