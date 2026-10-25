import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deleteFile } from "@/lib/storage";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { creatorWhere, forbidden, redactCreator, requireAccess } from "@/lib/access/server";
import type { PermissionKey } from "@/lib/access/catalogue";
import { scrubPreferences } from "../creator-access";

// Cascade the effects of archiving a creator within a transaction:
// archive their active requests and stop recurring generation for them.
// Recurring schedules that target only this creator are deactivated; schedules
// targeting multiple creators or groups keep running, and the recurring
// generator skips archived creators on its own.
async function cascadeCreatorArchive(
  tx: Prisma.TransactionClient,
  creatorId: string,
  agencyId: string
) {
  await tx.contentRequest.updateMany({
    where: {
      creatorId,
      agencyId,
      status: { notIn: ["CANCELLED", "ARCHIVED"] },
    },
    data: { status: "ARCHIVED" },
  });

  const schedules = await tx.recurringRequest.findMany({
    where: { agencyId, isActive: true },
    select: { id: true, creatorIds: true, creatorGroupIds: true },
  });

  const soleTargetIds = schedules
    .filter((s) => {
      const creatorIds = (s.creatorIds as string[]) ?? [];
      const groupIds = (s.creatorGroupIds as string[]) ?? [];
      return (
        groupIds.length === 0 &&
        creatorIds.length === 1 &&
        creatorIds[0] === creatorId
      );
    })
    .map((s) => s.id);

  if (soleTargetIds.length > 0) {
    await tx.recurringRequest.updateMany({
      where: { id: { in: soleTargetIds } },
      data: { isActive: false, nextRunAt: null },
    });
  }
}

// GET - Fetch full creator profile
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAccess("creators.view");
    if (gate.error) return gate.error;
    const { session, access } = gate;
    const { id } = await params;

    const creator = await db.creator.findFirst({
      where: { AND: [creatorWhere(access), { id }] },
      include: {
        _count: {
          select: {
            requests: true,
            uploads: true,
          },
        },
        uploads: {
          where: {
            uploadStatus: "COMPLETED",
          },
          select: {
            id: true,
            status: true,
            createdAt: true,
            uploadedAt: true,
          },
        },
        requests: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            title: true,
            status: true,
            dueDate: true,
            createdAt: true,
            submittedAt: true,
          },
        },
      },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    // Calculate stats
    const totalUploads = creator._count.uploads;
    const approvedUploads = creator.uploads.filter((u) => u.status === "APPROVED").length;
    const approvalRate = totalUploads > 0 ? Math.round((approvedUploads / totalUploads) * 100) : 0;

    // Calculate average response time (from request creation to first upload)
    const requestsWithUploads = await db.contentRequest.findMany({
      where: {
        creatorId: id,
        agencyId: session.user.agencyId,
        uploads: { some: {} },
      },
      include: {
        uploads: {
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    });

    let avgResponseTime = 0;
    if (requestsWithUploads.length > 0) {
      const totalResponseTime = requestsWithUploads.reduce((acc, req) => {
        if (req.uploads[0]) {
          const diff = req.uploads[0].createdAt.getTime() - req.createdAt.getTime();
          return acc + diff;
        }
        return acc;
      }, 0);
      avgResponseTime = totalResponseTime / requestsWithUploads.length / (1000 * 60 * 60); // Convert to hours
    }

    const stats = {
      totalUploads,
      approvalRate,
      avgResponseTimeHours: Math.round(avgResponseTime * 10) / 10,
      totalRequests: creator._count.requests,
      memberSince: creator.createdAt,
    };

    return NextResponse.json(redactCreator(access, {
      ...creator,
      contentPreferences: scrubPreferences(access, creator.contentPreferences),
      stats,
    }));
  } catch (error) {
    console.error("Error fetching creator:", error);
    return NextResponse.json(
      { error: "Failed to fetch creator" },
      { status: 500 }
    );
  }
}

// PATCH - Update creator profile
const updateCreatorSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  avatar: z.string().optional().nullable(),
  preferredContact: z.enum(["EMAIL", "SMS", "BOTH"]).optional(),
  timezone: z.string().optional(),
  notes: z.string().optional().nullable(),
  contentPreferences: z.record(z.string(), z.unknown()).optional(),
  // Archive lifecycle toggle: true archives, false unarchives (restores) the creator.
  archived: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAccess(["creators.edit", "creators.delete"]);
    if (gate.error) return gate.error;
    const { session, access } = gate;
    const { id } = await params;

    // Check creator exists, belongs to agency and is within their scope
    const existingCreator = await db.creator.findFirst({
      where: { AND: [creatorWhere(access), { id }] },
    });

    if (!existingCreator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    const body = await req.json();
    const validatedData = updateCreatorSchema.parse(body);

    // Archiving is its own permission; every other field needs creators.edit,
    // and a field they can't see can't be changed either.
    if (validatedData.archived !== undefined && !access.has("creators.delete")) {
      return forbidden("creators.delete");
    }
    const editedFields = Object.keys(validatedData).filter((k) => k !== "archived");
    if (editedFields.length > 0 && !access.has("creators.edit")) {
      return forbidden("creators.edit");
    }
    const FIELD_KEYS: Record<string, PermissionKey> = {
      email: "creatorInfo.email",
      phone: "creatorInfo.phone",
      notes: "creatorInfo.notes",
      timezone: "creatorInfo.location",
      contentPreferences: "creatorInfo.preferences",
      preferredContact: "creatorInfo.preferences",
    };
    const norm = (v: unknown) => (v === "" || v === undefined ? null : JSON.stringify(v));
    for (const field of editedFields) {
      const key = FIELD_KEYS[field];
      if (!key || access.has(key)) continue;
      const current = (existingCreator as Record<string, unknown>)[field];
      const next = (validatedData as Record<string, unknown>)[field];
      const same =
        field === "email"
          ? String(next ?? "").toLowerCase() === String(current ?? "").toLowerCase()
          : norm(next) === norm(current);
      if (!same) return forbidden(key, "You can't change a detail your role can't see.");
      // Unchanged (a form sending everything back): leave it alone
      delete (validatedData as Record<string, unknown>)[field];
    }

    // If email is changing, check for duplicates
    if (validatedData.email && validatedData.email !== existingCreator.email) {
      const duplicateEmail = await db.creator.findFirst({
        where: {
          agencyId: session.user.agencyId,
          email: validatedData.email.toLowerCase(),
          id: { not: id },
        },
      });

      if (duplicateEmail) {
        return NextResponse.json(
          { error: "A creator with this email already exists" },
          { status: 400 }
        );
      }
    }

    // Build update data with proper typing for JSON fields
    const { contentPreferences, archived, ...otherData } = validatedData;
    const updateData: Prisma.CreatorUpdateInput = {
      ...otherData,
      email: validatedData.email?.toLowerCase(),
    };

    if (contentPreferences !== undefined) {
      updateData.contentPreferences = contentPreferences as unknown as Prisma.InputJsonValue;
    }

    // Archive / unarchive toggle (reversible). Leaves inviteStatus untouched.
    if (archived !== undefined) {
      updateData.archivedAt = archived ? new Date() : null;
      if (archived) {
        // Sign the creator out of the portal; they log in again after unarchiving
        updateData.sessionToken = null;
        updateData.sessionExpiry = null;
      }
    }

    // Archiving cascades to requests + recurring schedules; run in one
    // transaction so a secondary-write failure rolls the whole thing back.
    const isArchiving = archived === true && existingCreator.archivedAt === null;

    const updatedCreator = isArchiving
      ? await db.$transaction(async (tx) => {
          const creator = await tx.creator.update({
            where: { id },
            data: updateData,
          });
          await cascadeCreatorArchive(tx, id, session.user.agencyId);
          return creator;
        })
      : await db.creator.update({
          where: { id },
          data: updateData,
        });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "creator.updated",
        entityType: "Creator",
        entityId: id,
        metadata: {
          updatedFields: Object.keys(validatedData),
        },
      },
    });

    return NextResponse.json({ creator: redactCreator(access, updatedCreator) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error updating creator:", error);
    return NextResponse.json(
      { error: "Failed to update creator" },
      { status: 500 }
    );
  }
}

// DELETE - Archive/soft-delete creator (or full delete)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAccess("creators.delete");
    if (gate.error) return gate.error;
    const { session, access } = gate;
    const { id } = await params;

    const creator = await db.creator.findFirst({
      where: { AND: [creatorWhere(access), { id }] },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    // Archive (default, reversible) vs. hard delete (permanent) via ?hard=true
    const url = new URL(req.url);
    const hardDelete = url.searchParams.get("hard") === "true";

    if (hardDelete) {
      // Permanent removal. Models with a real FK to Creator either cascade
      // (ContentRequest, Upload, CreatorGroupMember, ContentFingerprint,
      // DuplicateAttempt) or set-null (Conversation, Message), so none block
      // the delete. Several models store `creatorId` as a plain string WITHOUT
      // a foreign key (MediaItem, MediaFolder, CreatorReminderOverride,
      // Favorite, EmailQueueItem) — the DB won't cascade those, so we clean
      // them up explicitly to avoid orphaned rows. Everything runs in one
      // transaction so a failure leaves the creator intact.
      // Collect storage keys first so the R2 objects can be removed after commit.
      const uploads = await db.upload.findMany({
        where: { creatorId: id },
        select: { id: true, storageKey: true, thumbnailKey: true },
      });
      const media = await db.mediaItem.findMany({
        where: { creatorId: id, agencyId: session.user.agencyId },
        select: { storageKey: true, thumbnailKey: true },
      });
      const keys = new Set(
        [...uploads, ...media]
          .flatMap((u) => [u.storageKey, u.thumbnailKey])
          .filter((k): k is string => Boolean(k))
      );

      await db.$transaction(async (tx) => {
        // VideoTimestamp has no FK to Upload, so it won't cascade
        await tx.videoTimestamp.deleteMany({
          where: { uploadId: { in: uploads.map((u) => u.id) } },
        });
        await tx.mediaItem.deleteMany({
          where: { creatorId: id, agencyId: session.user.agencyId },
        });
        await tx.mediaFolder.deleteMany({
          where: { creatorId: id, agencyId: session.user.agencyId },
        });
        await tx.creatorReminderOverride.deleteMany({
          where: { creatorId: id, agencyId: session.user.agencyId },
        });
        await tx.favorite.deleteMany({
          where: { creatorId: id, agencyId: session.user.agencyId },
        });
        await tx.emailQueueItem.deleteMany({
          where: { creatorId: id },
        });
        // Deleting the creator cascades/nulls all FK-backed relations.
        await tx.creator.delete({
          where: { id },
        });
        // Remove the hidden pseudo-user that backs this creator's comments
        await tx.user.deleteMany({
          where: { email: `creator-${id}@${session.user.agencyId}.internal` },
        });
      });

      // Best-effort storage cleanup; failures must not fail the response
      const results = await Promise.allSettled([...keys].map((k) => deleteFile(k)));
      results.forEach((r) => {
        if (r.status === "rejected") {
          console.error("Failed to delete creator file from storage:", r.reason);
        }
      });
    } else {
      // Archive: mark as archived (reversible). Leave inviteStatus alone so the
      // real invite state is preserved for when the creator is unarchived.
      // Cascade in one transaction so a secondary-write failure rolls back.
      await db.$transaction(async (tx) => {
        await tx.creator.update({
          where: { id },
          data: {
            archivedAt: new Date(),
            // Sign the creator out of the portal
            sessionToken: null,
            sessionExpiry: null,
          },
        });
        await cascadeCreatorArchive(tx, id, session.user.agencyId);
      });
    }

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: hardDelete ? "creator.deleted" : "creator.archived",
        entityType: "Creator",
        entityId: id,
        metadata: {
          creatorName: creator.name,
          creatorEmail: creator.email,
        },
      },
    });

    return NextResponse.json({
      message: hardDelete ? "Creator deleted successfully" : "Creator archived successfully",
    });
  } catch (error) {
    console.error("Error archiving/deleting creator:", error);
    return NextResponse.json(
      { error: "Failed to archive/delete creator" },
      { status: 500 }
    );
  }
}
