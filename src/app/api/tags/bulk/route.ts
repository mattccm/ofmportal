import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { BulkTagAction } from "@/lib/tag-types";

// Type for tag stored in JSON fields
interface StoredTagRef {
  id: string;
  name: string;
  color: string;
}

// Helper to get agency tags for validation
async function getAgencyTagsMap(
  agencyId: string
): Promise<Map<string, StoredTagRef>> {
  const agency = await db.agency.findUnique({
    where: { id: agencyId },
    select: { settings: true },
  });

  const settings = agency?.settings as Record<string, unknown> | null;
  const tags = (settings?.tags as StoredTagRef[]) || [];

  return new Map(tags.map((t) => [t.id, t]));
}

// POST - Bulk tag operations
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      action,
      tagIds,
      targetIds,
      targetType,
    }: {
      action: BulkTagAction;
      tagIds: string[];
      targetIds: string[];
      targetType: "upload" | "request";
    } = body;

    // Validate inputs
    if (!action || !["add", "remove", "replace"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'add', 'remove', or 'replace'" },
        { status: 400 }
      );
    }

    if (!tagIds?.length && action !== "replace") {
      return NextResponse.json(
        { error: "At least one tag ID is required" },
        { status: 400 }
      );
    }

    if (!targetIds?.length) {
      return NextResponse.json(
        { error: "At least one target ID is required" },
        { status: 400 }
      );
    }

    if (!targetType || !["upload", "request"].includes(targetType)) {
      return NextResponse.json(
        { error: "Invalid target type. Must be 'upload' or 'request'" },
        { status: 400 }
      );
    }

    // Get valid tags from agency
    const agencyTags = await getAgencyTagsMap(session.user.agencyId);

    // Filter to valid tag references
    const validTagRefs: StoredTagRef[] = tagIds
      .filter((id) => agencyTags.has(id))
      .map((id) => agencyTags.get(id)!);

    if (validTagRefs.length === 0 && action !== "replace") {
      return NextResponse.json(
        { error: "No valid tags found" },
        { status: 400 }
      );
    }

    let affected = 0;
    const errors: string[] = [];

    if (targetType === "upload") {
      // Process uploads
      for (const uploadId of targetIds) {
        try {
          // Verify upload belongs to agency
          const upload = await db.upload.findFirst({
            where: {
              id: uploadId,
              request: { agencyId: session.user.agencyId },
            },
            select: { id: true, tags: true },
          });

          if (!upload) {
            errors.push(`Upload ${uploadId} not found`);
            continue;
          }

          const currentTags = (upload.tags as unknown as StoredTagRef[]) || [];
          let newTags: StoredTagRef[];

          switch (action) {
            case "add":
              // Add tags that don't already exist
              const existingIds = new Set(currentTags.map((t) => t.id));
              const toAdd = validTagRefs.filter((t) => !existingIds.has(t.id));
              newTags = [...currentTags, ...toAdd];
              break;

            case "remove":
              // Remove specified tags
              const removeIds = new Set(tagIds);
              newTags = currentTags.filter((t) => !removeIds.has(t.id));
              break;

            case "replace":
              // Replace all tags with specified ones
              newTags = validTagRefs;
              break;

            default:
              newTags = currentTags;
          }

          await db.upload.update({
            where: { id: uploadId },
            data: { tags: JSON.parse(JSON.stringify(newTags)) },
          });

          affected++;
        } catch (error) {
          console.error(`Failed to process upload ${uploadId}:`, error);
          errors.push(`Failed to process upload ${uploadId}`);
        }
      }
    } else {
      // Process requests (tags stored in requirements.tags)
      for (const requestId of targetIds) {
        try {
          // Verify request belongs to agency
          const contentRequest = await db.contentRequest.findFirst({
            where: {
              id: requestId,
              agencyId: session.user.agencyId,
            },
            select: { id: true, requirements: true },
          });

          if (!contentRequest) {
            errors.push(`Request ${requestId} not found`);
            continue;
          }

          const requirements = (contentRequest.requirements as Record<
            string,
            unknown
          >) || {};
          const currentTags = (requirements.tags as StoredTagRef[]) || [];
          let newTags: StoredTagRef[];

          switch (action) {
            case "add":
              const existingIds = new Set(currentTags.map((t) => t.id));
              const toAdd = validTagRefs.filter((t) => !existingIds.has(t.id));
              newTags = [...currentTags, ...toAdd];
              break;

            case "remove":
              const removeIds = new Set(tagIds);
              newTags = currentTags.filter((t) => !removeIds.has(t.id));
              break;

            case "replace":
              newTags = validTagRefs;
              break;

            default:
              newTags = currentTags;
          }

          await db.contentRequest.update({
            where: { id: requestId },
            data: {
              requirements: JSON.parse(JSON.stringify({
                ...requirements,
                tags: newTags,
              })),
            },
          });

          affected++;
        } catch (error) {
          console.error(`Failed to process request ${requestId}:`, error);
          errors.push(`Failed to process request ${requestId}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      affected,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Bulk tag operation failed:", error);
    return NextResponse.json(
      { error: "Bulk tag operation failed" },
      { status: 500 }
    );
  }
}
