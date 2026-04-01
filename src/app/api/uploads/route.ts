import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status");
    const creatorId = searchParams.get("creatorId");
    const requestId = searchParams.get("requestId");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause
    const where: Record<string, unknown> = {
      request: {
        agencyId: session.user.agencyId,
      },
    };

    if (status) {
      where.status = status;
    }

    if (creatorId) {
      where.creatorId = creatorId;
    }

    if (requestId) {
      where.requestId = requestId;
    }

    // Fetch uploads with related data
    const [uploads, total] = await Promise.all([
      db.upload.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          request: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.upload.count({ where }),
    ]);

    // Transform uploads to include preview URLs
    const transformedUploads = uploads.map((upload) => ({
      id: upload.id,
      originalName: upload.originalName,
      fileType: upload.fileType,
      fileSize: upload.fileSize,
      status: upload.status,
      rating: upload.rating,
      reviewNote: upload.reviewNote,
      thumbnailUrl: upload.thumbnailUrl || null,
      previewUrl: upload.storageUrl || null,
      uploadedAt: upload.createdAt.toISOString(),
      reviewedAt: upload.updatedAt?.toISOString() || null,
      creator: upload.creator,
      request: upload.request,
    }));

    return NextResponse.json({
      uploads: transformedUploads,
      total,
      limit,
      offset,
      hasMore: offset + uploads.length < total,
    });
  } catch (error) {
    console.error("Error fetching uploads:", error);
    return NextResponse.json(
      { error: "Failed to fetch uploads" },
      { status: 500 }
    );
  }
}
