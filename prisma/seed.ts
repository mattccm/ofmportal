import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

// Avatar URLs from Unsplash
const AVATARS = {
  admin: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop",
  manager: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop",
  sarah: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&h=150&fit=crop",
  mike: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop",
  emma: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop",
};

async function main() {
  console.log("🌱 Seeding database...");

  // Create test agency
  const agency = await prisma.agency.upsert({
    where: { email: "demo@agency.com" },
    update: {},
    create: {
      name: "Demo Agency",
      email: "demo@agency.com",
      plan: "professional",
    },
  });

  console.log(`✓ Created agency: ${agency.name}`);

  // Create admin user
  const hashedPassword = await bcrypt.hash("Password123", 12);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@agency.com" },
    update: {},
    create: {
      email: "admin@agency.com",
      password: hashedPassword,
      name: "Admin User",
      role: "OWNER",
      agencyId: agency.id,
      avatar: AVATARS.admin,
      onboardingCompleted: true,
    },
  });

  console.log(`✓ Created admin user: ${adminUser.email}`);

  // Create team member
  const teamMember = await prisma.user.upsert({
    where: { email: "manager@agency.com" },
    update: {},
    create: {
      email: "manager@agency.com",
      password: hashedPassword,
      name: "Team Manager",
      role: "MANAGER",
      agencyId: agency.id,
      avatar: AVATARS.manager,
      onboardingCompleted: true,
    },
  });

  console.log(`✓ Created team member: ${teamMember.email}`);

  // Create reminder config
  await prisma.reminderConfig.upsert({
    where: { id: "default-reminder" },
    update: {},
    create: {
      id: "default-reminder",
      agencyId: agency.id,
      name: "Default Reminders",
      daysBefore: [7, 3, 1, 0],
      escalateDaysOverdue: 3,
      sendEmail: true,
      sendSms: false,
      emailSubject: "Reminder: Content due for {{requestTitle}}",
      emailBody:
        "Hi {{creatorName}},\n\nThis is a reminder that your content for \"{{requestTitle}}\" is due on {{dueDate}}.\n\nPlease upload your content at: {{portalLink}}\n\nThank you!",
    },
  });

  console.log("✓ Created reminder config");

  // Create test creators
  const creatorHashedPassword = await bcrypt.hash("Creator123", 12);

  const creator1 = await prisma.creator.upsert({
    where: { id: "creator-1" },
    update: {
      // Ensure password is always set correctly
      portalPassword: creatorHashedPassword,
      inviteStatus: "ACCEPTED",
    },
    create: {
      id: "creator-1",
      agencyId: agency.id,
      name: "Sarah Johnson",
      email: "sarah@example.com",
      phone: "+1555123456",
      inviteStatus: "ACCEPTED",
      portalPassword: creatorHashedPassword,
      preferredContact: "EMAIL",
      lastLoginAt: new Date(),
      avatar: AVATARS.sarah,
    },
  });

  const creator2 = await prisma.creator.upsert({
    where: { id: "creator-2" },
    update: {
      // Ensure password is always set correctly
      portalPassword: creatorHashedPassword,
      inviteStatus: "ACCEPTED",
    },
    create: {
      id: "creator-2",
      agencyId: agency.id,
      name: "Mike Wilson",
      email: "mike@example.com",
      phone: "+1555654321",
      inviteStatus: "ACCEPTED",
      portalPassword: creatorHashedPassword,
      preferredContact: "BOTH",
      lastLoginAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      avatar: AVATARS.mike,
    },
  });

  const creator3 = await prisma.creator.upsert({
    where: { id: "creator-3" },
    update: {},
    create: {
      id: "creator-3",
      agencyId: agency.id,
      name: "Emma Davis",
      email: "emma@example.com",
      inviteStatus: "PENDING",
      inviteToken: "test-invite-token-123",
      inviteSentAt: new Date(),
      preferredContact: "EMAIL",
      avatar: AVATARS.emma,
    },
  });

  console.log(`✓ Created creators: ${creator1.name}, ${creator2.name}, ${creator3.name}`);

  // Create request templates
  const weeklyTemplate = await prisma.requestTemplate.upsert({
    where: { id: "template-weekly" },
    update: {},
    create: {
      id: "template-weekly",
      agencyId: agency.id,
      name: "Weekly Feed Content",
      description: "Standard weekly content for main feed",
      defaultDueDays: 7,
      defaultUrgency: "NORMAL",
      fields: [
        { id: "caption", label: "Caption", type: "textarea", required: true },
        { id: "hashtags", label: "Hashtags", type: "text", required: false },
      ],
    },
  });

  const ppvTemplate = await prisma.requestTemplate.upsert({
    where: { id: "template-ppv" },
    update: {},
    create: {
      id: "template-ppv",
      agencyId: agency.id,
      name: "PPV Bundle",
      description: "Premium pay-per-view content bundle",
      defaultDueDays: 14,
      defaultUrgency: "HIGH",
      fields: [
        { id: "price", label: "Suggested Price", type: "text", required: true },
        { id: "teaser", label: "Teaser Text", type: "textarea", required: true },
        { id: "exclusive", label: "Exclusive Content?", type: "checkbox", required: false },
      ],
    },
  });

  console.log(`✓ Created templates: ${weeklyTemplate.name}, ${ppvTemplate.name}`);

  // Create sample content requests
  const now = new Date();

  const request1 = await prisma.contentRequest.upsert({
    where: { id: "request-1" },
    update: {},
    create: {
      id: "request-1",
      agencyId: agency.id,
      creatorId: creator1.id,
      templateId: weeklyTemplate.id,
      title: "Week 12 Feed Content",
      description: "Need 10 photos and 2 short videos for this week's feed posts.",
      dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      urgency: "NORMAL",
      status: "PENDING",
      requirements: {
        quantity: "10 photos, 2 videos",
        format: "JPG, MP4",
        resolution: "1080p minimum",
      },
      fields: [
        { label: "Caption", value: "" },
        { label: "Hashtags", value: "" },
      ],
    },
  });

  const request2 = await prisma.contentRequest.upsert({
    where: { id: "request-2" },
    update: {},
    create: {
      id: "request-2",
      agencyId: agency.id,
      creatorId: creator1.id,
      templateId: ppvTemplate.id,
      title: "Premium Photo Set - Beach Theme",
      description: "Exclusive beach photoshoot for PPV release.",
      dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      urgency: "HIGH",
      status: "IN_PROGRESS",
      requirements: {
        quantity: "15-20 photos",
        format: "JPG, PNG",
        resolution: "4K preferred",
        notes: "Natural lighting preferred. Include variety of poses.",
      },
      fields: [
        { label: "Suggested Price", value: "$15" },
        { label: "Teaser Text", value: "" },
      ],
    },
  });

  const request3 = await prisma.contentRequest.upsert({
    where: { id: "request-3" },
    update: {},
    create: {
      id: "request-3",
      agencyId: agency.id,
      creatorId: creator2.id,
      title: "Custom Fan Request",
      description: "Custom video message for a top fan.",
      dueDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      urgency: "URGENT",
      status: "SUBMITTED",
      submittedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // Submitted yesterday
      requirements: {
        quantity: "1 video (2-3 minutes)",
        format: "MP4",
        notes: "Personalized greeting for 'Alex'. Casual and friendly tone.",
      },
      fields: [],
    },
  });

  const request4 = await prisma.contentRequest.upsert({
    where: { id: "request-4" },
    update: {},
    create: {
      id: "request-4",
      agencyId: agency.id,
      creatorId: creator2.id,
      templateId: weeklyTemplate.id,
      title: "Week 11 Content - Completed",
      description: "Last week's content - all approved.",
      dueDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      urgency: "NORMAL",
      status: "APPROVED",
      submittedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
      reviewedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      reviewedBy: adminUser.id,
      requirements: {
        quantity: "8 photos, 1 video",
        format: "JPG, MP4",
      },
      fields: [],
    },
  });

  console.log(`✓ Created requests: ${request1.title}, ${request2.title}, ${request3.title}, ${request4.title}`);

  // Create sample uploads
  const upload1 = await prisma.upload.upsert({
    where: { id: "upload-1" },
    update: {},
    create: {
      id: "upload-1",
      requestId: request3.id,
      creatorId: creator2.id,
      fileName: "custom_video_alex.mp4",
      originalName: "custom_video_alex.mp4",
      storageKey: "uploads/request-3/custom_video_alex.mp4",
      fileType: "video/mp4",
      fileSize: BigInt(52428800), // 50MB
      status: "PENDING",
      uploadStatus: "COMPLETED",
      uploadProgress: 100,
      uploadedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
    },
  });

  const upload2 = await prisma.upload.upsert({
    where: { id: "upload-2" },
    update: {},
    create: {
      id: "upload-2",
      requestId: request4.id,
      creatorId: creator2.id,
      fileName: "week11_photos.zip",
      originalName: "week11_photos.zip",
      storageKey: "uploads/request-4/week11_photos.zip",
      fileType: "application/zip",
      fileSize: BigInt(157286400), // 150MB
      status: "APPROVED",
      uploadStatus: "COMPLETED",
      uploadProgress: 100,
      uploadedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
      reviewedById: adminUser.id,
      reviewNote: "Excellent quality! All content approved.",
    },
  });

  const upload3 = await prisma.upload.upsert({
    where: { id: "upload-3" },
    update: {},
    create: {
      id: "upload-3",
      requestId: request4.id,
      creatorId: creator2.id,
      fileName: "week11_video.mp4",
      originalName: "week11_video.mp4",
      storageKey: "uploads/request-4/week11_video.mp4",
      fileType: "video/mp4",
      fileSize: BigInt(104857600), // 100MB
      status: "APPROVED",
      uploadStatus: "COMPLETED",
      uploadProgress: 100,
      uploadedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
      reviewedById: adminUser.id,
    },
  });

  console.log(`✓ Created uploads: ${upload1.originalName}, ${upload2.originalName}, ${upload3.originalName}`);

  // Create activity logs
  await prisma.activityLog.upsert({
    where: { id: "activity-1" },
    update: {},
    create: {
      id: "activity-1",
      user: { connect: { id: adminUser.id } },
      action: "request_created",
      entityType: "ContentRequest",
      entityId: request1.id,
      metadata: { description: `Created content request "${request1.title}"` },
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0",
    },
  });

  await prisma.activityLog.upsert({
    where: { id: "activity-2" },
    update: {},
    create: {
      id: "activity-2",
      user: { connect: { id: adminUser.id } },
      action: "upload_approved",
      entityType: "Upload",
      entityId: upload2.id,
      metadata: { requestTitle: request4.title, description: `Approved upload "${upload2.originalName}"` },
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0",
    },
  });

  console.log("✓ Created activity logs");

  // Create notifications
  await prisma.notification.upsert({
    where: { id: "notification-1" },
    update: {},
    create: {
      id: "notification-1",
      user: { connect: { id: adminUser.id } },
      type: "UPLOAD",
      title: "New Upload Received",
      message: `${creator2.name} uploaded content for "${request3.title}"`,
      link: `/dashboard/requests/${request3.id}`,
    },
  });

  await prisma.notification.upsert({
    where: { id: "notification-2" },
    update: {},
    create: {
      id: "notification-2",
      user: { connect: { id: adminUser.id } },
      type: "DEADLINE",
      title: "Deadline Approaching",
      message: `"${request1.title}" is due in 3 days`,
      link: `/dashboard/requests/${request1.id}`,
    },
  });

  console.log("✓ Created notifications");

  // Create sample comment
  await prisma.comment.upsert({
    where: { id: "comment-1" },
    update: {},
    create: {
      id: "comment-1",
      requestId: request3.id,
      userId: adminUser.id,
      message: "Great job on this! The quality is excellent. Just one small thing - can you make sure the lighting is a bit brighter for the next batch?",
      isInternal: false,
    },
  });

  console.log("✓ Created sample comments");

  console.log("\n✅ Database seeded successfully!\n");
  console.log("📋 Test Accounts:");
  console.log("─────────────────────────────────────────");
  console.log("Agency Admin:");
  console.log("  Email: admin@agency.com");
  console.log("  Password: Password123");
  console.log("");
  console.log("Team Manager:");
  console.log("  Email: manager@agency.com");
  console.log("  Password: Password123");
  console.log("");
  console.log("Creator Portal (Sarah):");
  console.log("  Email: sarah@example.com");
  console.log("  Password: Creator123");
  console.log("");
  console.log("Creator Portal (Mike):");
  console.log("  Email: mike@example.com");
  console.log("  Password: Creator123");
  console.log("");
  console.log("Pending Creator Invite:");
  console.log("  URL: http://localhost:3000/portal/setup/test-invite-token-123");
  console.log("─────────────────────────────────────────\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
