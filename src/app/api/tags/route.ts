import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { isValidHexColor, getRandomPresetColor } from "@/lib/tag-types";

// Type for tag stored in agency settings
interface StoredTag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

// Extended type with usage count
interface TagWithUsage extends StoredTag {
  usageCount: number;
  agencyId: string;
}

// Helper to get tags from agency settings
async function getAgencyTags(agencyId: string): Promise<StoredTag[]> {
  const agency = await db.agency.findUnique({
    where: { id: agencyId },
    select: { settings: true },
  });

  if (!agency) return [];

  const settings = agency.settings as Record<string, unknown> | null;
  return (settings?.tags as StoredTag[]) || [];
}

// Helper to update agency tags
async function updateAgencyTags(agencyId: string, tags: StoredTag[]) {
  const agency = await db.agency.findUnique({
    where: { id: agencyId },
    select: { settings: true },
  });

  const currentSettings = (agency?.settings as Record<string, unknown>) || {};

  const settingsUpdate = {
    ...currentSettings,
    tags,
  };

  await db.agency.update({
    where: { id: agencyId },
    data: {
      settings: JSON.parse(JSON.stringify(settingsUpdate)),
    },
  });
}

// Helper to count tag usage across uploads and requests
async function getTagUsageCounts(
  agencyId: string,
  tagIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  tagIds.forEach((id) => counts.set(id, 0));

  // Count in uploads (tags stored as array in JSON field)
  const uploads = await db.upload.findMany({
    where: {
      request: { agencyId },
    },
    select: { tags: true },
  });

  uploads.forEach((upload) => {
    const uploadTags = upload.tags as Array<{ id: string }> | null;
    if (uploadTags && Array.isArray(uploadTags)) {
      uploadTags.forEach((tag) => {
        if (tag.id && counts.has(tag.id)) {
          counts.set(tag.id, (counts.get(tag.id) || 0) + 1);
        }
      });
    }
  });

  // Count in requests (requirements JSON field may contain tags)
  const requests = await db.contentRequest.findMany({
    where: { agencyId },
    select: { requirements: true },
  });

  requests.forEach((request) => {
    const requirements = request.requirements as { tags?: Array<{ id: string }> } | null;
    if (requirements?.tags && Array.isArray(requirements.tags)) {
      requirements.tags.forEach((tag) => {
        if (tag.id && counts.has(tag.id)) {
          counts.set(tag.id, (counts.get(tag.id) || 0) + 1);
        }
      });
    }
  });

  return counts;
}

// GET - List all tags for agency with usage counts
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.toLowerCase();
    const includeUsage = searchParams.get("includeUsage") !== "false";

    let tags = await getAgencyTags(session.user.agencyId);

    // Filter by search if provided
    if (search) {
      tags = tags.filter((tag) => tag.name.toLowerCase().includes(search));
    }

    // Get usage counts
    let tagsWithUsage: TagWithUsage[] = tags.map((tag) => ({
      ...tag,
      usageCount: 0,
      agencyId: session.user.agencyId,
    }));
    if (includeUsage) {
      const usageCounts = await getTagUsageCounts(
        session.user.agencyId,
        tags.map((t) => t.id)
      );

      tagsWithUsage = tags.map((tag) => ({
        ...tag,
        usageCount: usageCounts.get(tag.id) || 0,
        agencyId: session.user.agencyId,
      }));
    }

    // Sort by usage count (most used first)
    tagsWithUsage.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));

    return NextResponse.json({
      tags: tagsWithUsage,
      total: tagsWithUsage.length,
    });
  } catch (error) {
    console.error("Failed to fetch tags:", error);
    return NextResponse.json(
      { error: "Failed to fetch tags" },
      { status: 500 }
    );
  }
}

// POST - Create a new tag
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, color = getRandomPresetColor() } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Tag name is required" },
        { status: 400 }
      );
    }

    if (!isValidHexColor(color)) {
      return NextResponse.json(
        { error: "Invalid color format. Use hex format like #6366f1" },
        { status: 400 }
      );
    }

    const tags = await getAgencyTags(session.user.agencyId);

    // Check for duplicate name
    const normalizedName = name.trim().toLowerCase();
    if (tags.some((t) => t.name.toLowerCase() === normalizedName)) {
      return NextResponse.json(
        { error: "A tag with this name already exists" },
        { status: 400 }
      );
    }

    // Create new tag
    const now = new Date().toISOString();
    const newTag: StoredTag = {
      id: `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      color,
      createdAt: now,
      updatedAt: now,
    };

    tags.push(newTag);
    await updateAgencyTags(session.user.agencyId, tags);

    return NextResponse.json({
      tag: {
        ...newTag,
        agencyId: session.user.agencyId,
        usageCount: 0,
      },
    });
  } catch (error) {
    console.error("Failed to create tag:", error);
    return NextResponse.json(
      { error: "Failed to create tag" },
      { status: 500 }
    );
  }
}

// PATCH - Update an existing tag
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, color } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Tag ID is required" },
        { status: 400 }
      );
    }

    const tags = await getAgencyTags(session.user.agencyId);
    const tagIndex = tags.findIndex((t) => t.id === id);

    if (tagIndex === -1) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // Validate name uniqueness if changing
    if (name?.trim()) {
      const normalizedName = name.trim().toLowerCase();
      const duplicateIndex = tags.findIndex(
        (t) => t.name.toLowerCase() === normalizedName && t.id !== id
      );
      if (duplicateIndex !== -1) {
        return NextResponse.json(
          { error: "A tag with this name already exists" },
          { status: 400 }
        );
      }
    }

    // Validate color if provided
    if (color && !isValidHexColor(color)) {
      return NextResponse.json(
        { error: "Invalid color format. Use hex format like #6366f1" },
        { status: 400 }
      );
    }

    // Update tag
    const updatedTag: StoredTag = {
      ...tags[tagIndex],
      name: name?.trim() || tags[tagIndex].name,
      color: color || tags[tagIndex].color,
      updatedAt: new Date().toISOString(),
    };

    tags[tagIndex] = updatedTag;
    await updateAgencyTags(session.user.agencyId, tags);

    return NextResponse.json({
      tag: {
        ...updatedTag,
        agencyId: session.user.agencyId,
      },
    });
  } catch (error) {
    console.error("Failed to update tag:", error);
    return NextResponse.json(
      { error: "Failed to update tag" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a tag
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Tag ID is required" },
        { status: 400 }
      );
    }

    const tags = await getAgencyTags(session.user.agencyId);
    const tagIndex = tags.findIndex((t) => t.id === id);

    if (tagIndex === -1) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // Remove tag from agency settings
    tags.splice(tagIndex, 1);
    await updateAgencyTags(session.user.agencyId, tags);

    // Also remove tag from all uploads
    await db.$executeRaw`
      UPDATE "Upload" u
      SET tags = (
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements(u.tags) elem
        WHERE elem->>'id' != ${id}
      )
      FROM "ContentRequest" cr
      WHERE u."requestId" = cr.id
      AND cr."agencyId" = ${session.user.agencyId}
      AND u.tags @> ${`[{"id": "${id}"}]`}::jsonb
    `;

    // Remove tag from all requests (in requirements.tags)
    await db.$executeRaw`
      UPDATE "ContentRequest"
      SET requirements = jsonb_set(
        requirements,
        '{tags}',
        COALESCE(
          (
            SELECT jsonb_agg(elem)
            FROM jsonb_array_elements(requirements->'tags') elem
            WHERE elem->>'id' != ${id}
          ),
          '[]'::jsonb
        )
      )
      WHERE "agencyId" = ${session.user.agencyId}
      AND requirements->'tags' @> ${`[{"id": "${id}"}]`}::jsonb
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete tag:", error);
    return NextResponse.json(
      { error: "Failed to delete tag" },
      { status: 500 }
    );
  }
}
