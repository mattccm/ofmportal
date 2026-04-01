// Email Template Types and Defaults

export type EmailTemplateType =
  | "WELCOME"
  | "REQUEST_SENT"
  | "UPLOAD_RECEIVED"
  | "REQUEST_APPROVED"
  | "REQUEST_REJECTED"
  | "REMINDER_UPCOMING"
  | "REMINDER_DUE_TODAY"
  | "REMINDER_OVERDUE"
  | "PASSWORD_RESET"
  | "REVISION_REQUESTED";

export interface EmailTemplateVariable {
  key: string;
  label: string;
  description: string;
  example: string;
}

export interface EmailTemplateConfig {
  type: EmailTemplateType;
  name: string;
  description: string;
  variables: EmailTemplateVariable[];
  defaultSubject: string;
  defaultHtml: string;
  defaultText: string;
}

// Available variables for each template type
export const TEMPLATE_VARIABLES: Record<EmailTemplateType, EmailTemplateVariable[]> = {
  WELCOME: [
    { key: "creator.name", label: "Creator Name", description: "The creator's full name", example: "John Doe" },
    { key: "agency.name", label: "Agency Name", description: "Your agency name", example: "Creative Agency" },
    { key: "invite.link", label: "Invite Link", description: "The setup link for the creator", example: "https://portal.example.com/setup/abc123" },
    { key: "app.name", label: "App Name", description: "The application name", example: "Content Portal" },
  ],
  REQUEST_SENT: [
    { key: "creator.name", label: "Creator Name", description: "The creator's full name", example: "John Doe" },
    { key: "agency.name", label: "Agency Name", description: "Your agency name", example: "Creative Agency" },
    { key: "request.title", label: "Request Title", description: "The title of the content request", example: "Summer Campaign Photos" },
    { key: "request.dueDate", label: "Due Date", description: "The request due date", example: "March 30, 2026" },
    { key: "request.description", label: "Description", description: "The request description", example: "Please provide summer-themed photos..." },
    { key: "portal.link", label: "Portal Link", description: "Link to view the request", example: "https://portal.example.com/request/xyz" },
  ],
  UPLOAD_RECEIVED: [
    { key: "agency.name", label: "Agency Name", description: "Your agency name", example: "Creative Agency" },
    { key: "creator.name", label: "Creator Name", description: "The creator's full name", example: "John Doe" },
    { key: "request.title", label: "Request Title", description: "The title of the content request", example: "Summer Campaign Photos" },
    { key: "upload.fileName", label: "File Name", description: "The uploaded file name", example: "photo_001.jpg" },
    { key: "upload.count", label: "Upload Count", description: "Number of files uploaded", example: "5" },
    { key: "dashboard.link", label: "Dashboard Link", description: "Link to view the uploads", example: "https://portal.example.com/dashboard/requests/xyz" },
  ],
  REQUEST_APPROVED: [
    { key: "creator.name", label: "Creator Name", description: "The creator's full name", example: "John Doe" },
    { key: "request.title", label: "Request Title", description: "The title of the content request", example: "Summer Campaign Photos" },
    { key: "agency.name", label: "Agency Name", description: "Your agency name", example: "Creative Agency" },
  ],
  REQUEST_REJECTED: [
    { key: "creator.name", label: "Creator Name", description: "The creator's full name", example: "John Doe" },
    { key: "request.title", label: "Request Title", description: "The title of the content request", example: "Summer Campaign Photos" },
    { key: "agency.name", label: "Agency Name", description: "Your agency name", example: "Creative Agency" },
    { key: "rejection.reason", label: "Rejection Reason", description: "Why the content was rejected", example: "The images do not meet the quality requirements." },
    { key: "portal.link", label: "Portal Link", description: "Link to view the request", example: "https://portal.example.com/request/xyz" },
  ],
  REMINDER_UPCOMING: [
    { key: "creator.name", label: "Creator Name", description: "The creator's full name", example: "John Doe" },
    { key: "request.title", label: "Request Title", description: "The title of the content request", example: "Summer Campaign Photos" },
    { key: "request.dueDate", label: "Due Date", description: "The request due date", example: "March 30, 2026" },
    { key: "days.remaining", label: "Days Remaining", description: "Days until the due date", example: "3" },
    { key: "portal.link", label: "Portal Link", description: "Link to view the request", example: "https://portal.example.com/request/xyz" },
  ],
  REMINDER_DUE_TODAY: [
    { key: "creator.name", label: "Creator Name", description: "The creator's full name", example: "John Doe" },
    { key: "request.title", label: "Request Title", description: "The title of the content request", example: "Summer Campaign Photos" },
    { key: "request.dueDate", label: "Due Date", description: "The request due date", example: "March 30, 2026" },
    { key: "portal.link", label: "Portal Link", description: "Link to view the request", example: "https://portal.example.com/request/xyz" },
  ],
  REMINDER_OVERDUE: [
    { key: "creator.name", label: "Creator Name", description: "The creator's full name", example: "John Doe" },
    { key: "request.title", label: "Request Title", description: "The title of the content request", example: "Summer Campaign Photos" },
    { key: "request.dueDate", label: "Due Date", description: "The request due date", example: "March 30, 2026" },
    { key: "days.overdue", label: "Days Overdue", description: "Days past the due date", example: "2" },
    { key: "portal.link", label: "Portal Link", description: "Link to view the request", example: "https://portal.example.com/request/xyz" },
  ],
  PASSWORD_RESET: [
    { key: "user.name", label: "User Name", description: "The user's full name", example: "John Doe" },
    { key: "reset.link", label: "Reset Link", description: "The password reset link", example: "https://portal.example.com/reset/abc123" },
    { key: "app.name", label: "App Name", description: "The application name", example: "Content Portal" },
  ],
  REVISION_REQUESTED: [
    { key: "creator.name", label: "Creator Name", description: "The creator's full name", example: "John Doe" },
    { key: "request.title", label: "Request Title", description: "The title of the content request", example: "Summer Campaign Photos" },
    { key: "feedback", label: "Feedback", description: "The revision feedback", example: "Please adjust the lighting in the photos." },
    { key: "portal.link", label: "Portal Link", description: "Link to view the request", example: "https://portal.example.com/request/xyz" },
  ],
};

// Base email styles
const EMAIL_STYLES = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: #333;
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
`;

const HEADER_GRADIENT = `
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 30px;
  border-radius: 10px 10px 0 0;
`;

const CONTENT_BOX = `
  background: #ffffff;
  padding: 30px;
  border: 1px solid #e5e5e5;
  border-top: none;
  border-radius: 0 0 10px 10px;
`;

const BUTTON_STYLE = `
  background: #667eea;
  color: white;
  padding: 14px 28px;
  text-decoration: none;
  border-radius: 6px;
  font-weight: 600;
  display: inline-block;
`;

// Default templates
export const DEFAULT_TEMPLATES: Record<EmailTemplateType, Omit<EmailTemplateConfig, "type">> = {
  WELCOME: {
    name: "Welcome Email",
    description: "Sent when a new creator is invited to the portal",
    variables: TEMPLATE_VARIABLES.WELCOME,
    defaultSubject: "{{agency.name}} has invited you to {{app.name}}",
    defaultHtml: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to {{app.name}}</title>
  </head>
  <body style="${EMAIL_STYLES}">
    <div style="${HEADER_GRADIENT}">
      <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to {{app.name}}!</h1>
    </div>
    <div style="${CONTENT_BOX}">
      <p>Hi {{creator.name}},</p>
      <p><strong>{{agency.name}}</strong> has invited you to join their content portal. This is where you'll upload your content for review and approval.</p>
      <p>Click the button below to set up your account:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{invite.link}}" style="${BUTTON_STYLE}">Set Up Your Account</a>
      </div>
      <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
      <p style="background: #f5f5f5; padding: 12px; border-radius: 4px; word-break: break-all; font-size: 14px; color: #666;">{{invite.link}}</p>
      <p style="color: #666; font-size: 14px;">This link will expire in 7 days.</p>
      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">
      <p style="color: #999; font-size: 12px; margin: 0;">
        If you didn't expect this invitation, you can safely ignore this email.
      </p>
    </div>
  </body>
</html>`,
    defaultText: `
Hi {{creator.name}},

{{agency.name}} has invited you to join their content portal on {{app.name}}.

Set up your account here: {{invite.link}}

This link will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.`.trim(),
  },

  REQUEST_SENT: {
    name: "Request Sent",
    description: "Sent when a new content request is created for a creator",
    variables: TEMPLATE_VARIABLES.REQUEST_SENT,
    defaultSubject: "New content request: {{request.title}}",
    defaultHtml: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="${EMAIL_STYLES}">
    <div style="background: #f8f9fa; padding: 20px; border-radius: 10px;">
      <h2 style="margin: 0 0 20px 0; color: #333;">New Content Request</h2>
      <p>Hi {{creator.name}},</p>
      <p><strong>{{agency.name}}</strong> has a new content request for you:</p>
      <div style="background: white; border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: #333;">{{request.title}}</h3>
        <p style="margin: 0; color: #666;">Due: <strong>{{request.dueDate}}</strong></p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{portal.link}}" style="${BUTTON_STYLE}">View Request & Upload</a>
      </div>
    </div>
  </body>
</html>`,
    defaultText: `
Hi {{creator.name}},

{{agency.name}} has a new content request for you:

{{request.title}}
Due: {{request.dueDate}}

View and upload here: {{portal.link}}`.trim(),
  },

  UPLOAD_RECEIVED: {
    name: "Upload Received",
    description: "Sent to agency when a creator uploads content",
    variables: TEMPLATE_VARIABLES.UPLOAD_RECEIVED,
    defaultSubject: "New upload from {{creator.name}} for \"{{request.title}}\"",
    defaultHtml: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="${EMAIL_STYLES}">
    <div style="background: #f0fdf4; padding: 20px; border-radius: 10px; border-left: 4px solid #22c55e;">
      <h2 style="margin: 0 0 20px 0; color: #16a34a;">New Content Uploaded</h2>
      <p><strong>{{creator.name}}</strong> has uploaded {{upload.count}} file(s) for:</p>
      <div style="background: white; border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: #333;">{{request.title}}</h3>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{dashboard.link}}" style="${BUTTON_STYLE}">Review Uploads</a>
      </div>
    </div>
  </body>
</html>`,
    defaultText: `
New Content Uploaded

{{creator.name}} has uploaded {{upload.count}} file(s) for "{{request.title}}".

Review the uploads here: {{dashboard.link}}`.trim(),
  },

  REQUEST_APPROVED: {
    name: "Request Approved",
    description: "Sent when all content for a request is approved",
    variables: TEMPLATE_VARIABLES.REQUEST_APPROVED,
    defaultSubject: "Your content for \"{{request.title}}\" has been approved!",
    defaultHtml: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="${EMAIL_STYLES}">
    <div style="background: #f0fdf4; padding: 20px; border-radius: 10px; border-left: 4px solid #22c55e;">
      <h2 style="margin: 0 0 20px 0; color: #16a34a;">Content Approved!</h2>
      <p>Hi {{creator.name}},</p>
      <p>Great news! Your content for <strong>"{{request.title}}"</strong> has been approved.</p>
      <p>Thank you for your submission!</p>
      <p style="color: #666; font-size: 14px; margin-top: 20px;">- {{agency.name}}</p>
    </div>
  </body>
</html>`,
    defaultText: `
Content Approved!

Hi {{creator.name}},

Great news! Your content for "{{request.title}}" has been approved.

Thank you for your submission!

- {{agency.name}}`.trim(),
  },

  REQUEST_REJECTED: {
    name: "Request Rejected",
    description: "Sent when content is rejected and needs to be replaced",
    variables: TEMPLATE_VARIABLES.REQUEST_REJECTED,
    defaultSubject: "Action needed: Content for \"{{request.title}}\" was not approved",
    defaultHtml: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="${EMAIL_STYLES}">
    <div style="background: #fef2f2; padding: 20px; border-radius: 10px; border-left: 4px solid #ef4444;">
      <h2 style="margin: 0 0 20px 0; color: #dc2626;">Content Not Approved</h2>
      <p>Hi {{creator.name}},</p>
      <p>We've reviewed your content for <strong>"{{request.title}}"</strong> and unfortunately it doesn't meet our requirements.</p>
      <div style="background: white; border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <p style="margin: 0; font-weight: 600; color: #333;">Reason:</p>
        <p style="margin: 10px 0 0 0; color: #666;">{{rejection.reason}}</p>
      </div>
      <p>Please upload new content as soon as possible.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{portal.link}}" style="background: #dc2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Upload New Content</a>
      </div>
    </div>
  </body>
</html>`,
    defaultText: `
Content Not Approved

Hi {{creator.name}},

We've reviewed your content for "{{request.title}}" and unfortunately it doesn't meet our requirements.

Reason: {{rejection.reason}}

Please upload new content here: {{portal.link}}`.trim(),
  },

  REMINDER_UPCOMING: {
    name: "Upcoming Deadline Reminder",
    description: "Sent before a request's due date",
    variables: TEMPLATE_VARIABLES.REMINDER_UPCOMING,
    defaultSubject: "Reminder: \"{{request.title}}\" is due in {{days.remaining}} days",
    defaultHtml: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="${EMAIL_STYLES}">
    <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; border-left: 4px solid #667eea;">
      <h2 style="margin: 0 0 20px 0; color: #333;">Content Reminder</h2>
      <p>Hi {{creator.name}},</p>
      <p>This is a friendly reminder that your content for <strong>"{{request.title}}"</strong> is due in <strong>{{days.remaining}} days</strong>.</p>
      <div style="background: white; border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <p style="margin: 0; color: #666;">Due date: <strong>{{request.dueDate}}</strong></p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{portal.link}}" style="${BUTTON_STYLE}">Upload Content Now</a>
      </div>
    </div>
  </body>
</html>`,
    defaultText: `
Content Reminder

Hi {{creator.name}},

This is a friendly reminder that your content for "{{request.title}}" is due in {{days.remaining}} days.

Due date: {{request.dueDate}}

Upload your content here: {{portal.link}}`.trim(),
  },

  REMINDER_DUE_TODAY: {
    name: "Due Today Reminder",
    description: "Sent on the day a request is due",
    variables: TEMPLATE_VARIABLES.REMINDER_DUE_TODAY,
    defaultSubject: "Due Today: \"{{request.title}}\"",
    defaultHtml: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="${EMAIL_STYLES}">
    <div style="background: #fef3c7; padding: 20px; border-radius: 10px; border-left: 4px solid #f59e0b;">
      <h2 style="margin: 0 0 20px 0; color: #b45309;">Content Due Today!</h2>
      <p>Hi {{creator.name}},</p>
      <p>Your content for <strong>"{{request.title}}"</strong> is due <strong>today</strong>.</p>
      <p>Please upload your content as soon as possible to avoid missing the deadline.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{portal.link}}" style="background: #f59e0b; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Upload Content Now</a>
      </div>
    </div>
  </body>
</html>`,
    defaultText: `
Content Due Today!

Hi {{creator.name}},

Your content for "{{request.title}}" is due today.

Please upload your content as soon as possible: {{portal.link}}`.trim(),
  },

  REMINDER_OVERDUE: {
    name: "Overdue Reminder",
    description: "Sent when a request is past its due date",
    variables: TEMPLATE_VARIABLES.REMINDER_OVERDUE,
    defaultSubject: "OVERDUE: \"{{request.title}}\" is {{days.overdue}} days late",
    defaultHtml: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="${EMAIL_STYLES}">
    <div style="background: #fef2f2; padding: 20px; border-radius: 10px; border-left: 4px solid #ef4444;">
      <h2 style="margin: 0 0 20px 0; color: #dc2626;">Content Overdue</h2>
      <p>Hi {{creator.name}},</p>
      <p>Your content for <strong>"{{request.title}}"</strong> is <strong>{{days.overdue}} days overdue</strong>.</p>
      <p>The original due date was {{request.dueDate}}. Please upload your content immediately.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{portal.link}}" style="background: #dc2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Upload Content Now</a>
      </div>
    </div>
  </body>
</html>`,
    defaultText: `
Content Overdue

Hi {{creator.name}},

Your content for "{{request.title}}" is {{days.overdue}} days overdue.

The original due date was {{request.dueDate}}. Please upload your content immediately.

Upload here: {{portal.link}}`.trim(),
  },

  PASSWORD_RESET: {
    name: "Password Reset",
    description: "Sent when a user requests a password reset",
    variables: TEMPLATE_VARIABLES.PASSWORD_RESET,
    defaultSubject: "Reset your {{app.name}} password",
    defaultHtml: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="${EMAIL_STYLES}">
    <div style="${HEADER_GRADIENT}">
      <h1 style="color: white; margin: 0; font-size: 24px;">Password Reset</h1>
    </div>
    <div style="${CONTENT_BOX}">
      <p>Hi {{user.name}},</p>
      <p>We received a request to reset your password for {{app.name}}.</p>
      <p>Click the button below to set a new password:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{reset.link}}" style="${BUTTON_STYLE}">Reset Password</a>
      </div>
      <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
      <p style="background: #f5f5f5; padding: 12px; border-radius: 4px; word-break: break-all; font-size: 14px; color: #666;">{{reset.link}}</p>
      <p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">
      <p style="color: #999; font-size: 12px; margin: 0;">
        If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
      </p>
    </div>
  </body>
</html>`,
    defaultText: `
Password Reset

Hi {{user.name}},

We received a request to reset your password for {{app.name}}.

Reset your password here: {{reset.link}}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.`.trim(),
  },

  REVISION_REQUESTED: {
    name: "Revision Requested",
    description: "Sent when changes are requested for submitted content",
    variables: TEMPLATE_VARIABLES.REVISION_REQUESTED,
    defaultSubject: "Revision needed for \"{{request.title}}\"",
    defaultHtml: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="${EMAIL_STYLES}">
    <div style="background: #fef3c7; padding: 20px; border-radius: 10px; border-left: 4px solid #f59e0b;">
      <h2 style="margin: 0 0 20px 0; color: #b45309;">Revision Requested</h2>
      <p>Hi {{creator.name}},</p>
      <p>We've reviewed your content for <strong>"{{request.title}}"</strong> and have some feedback:</p>
      <div style="background: white; border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <p style="margin: 0; white-space: pre-wrap;">{{feedback}}</p>
      </div>
      <p>Please make the necessary changes and resubmit.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{portal.link}}" style="background: #f59e0b; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">View Feedback & Resubmit</a>
      </div>
    </div>
  </body>
</html>`,
    defaultText: `
Revision Requested

Hi {{creator.name}},

We've reviewed your content for "{{request.title}}" and have some feedback:

{{feedback}}

Please make the necessary changes and resubmit: {{portal.link}}`.trim(),
  },
};

// Get all template types with their configurations
export function getAllTemplateConfigs(): EmailTemplateConfig[] {
  return Object.entries(DEFAULT_TEMPLATES).map(([type, config]) => ({
    type: type as EmailTemplateType,
    ...config,
  }));
}

// Get a specific template configuration
export function getTemplateConfig(type: EmailTemplateType): EmailTemplateConfig {
  const config = DEFAULT_TEMPLATES[type];
  return {
    type,
    ...config,
  };
}

// Render template with variables
export function renderTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let rendered = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{\\s*${key.replace(/\./g, "\\.")}\\s*\\}\\}`, "g");
    rendered = rendered.replace(regex, value);
  }
  return rendered;
}

// Generate sample data for preview
export function getSampleData(type: EmailTemplateType): Record<string, string> {
  const variables = TEMPLATE_VARIABLES[type];
  const sampleData: Record<string, string> = {};

  for (const variable of variables) {
    sampleData[variable.key] = variable.example;
  }

  return sampleData;
}
