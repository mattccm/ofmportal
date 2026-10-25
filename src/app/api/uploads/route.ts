import { NextRequest, NextResponse } from "next/server";
import { requireAccess, requestWhere, redactCreatorsIn } from "@/lib/access/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAccess("review.view");
    if (gate.error) return gate.error;
    const { access } = gate;

    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status");
    const creatorId = searchParams.get("creatorId");
    const requestId = searchParams.get("requestId");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause
    const where: Record<string, unknown> = {
      request: requestWhere(access),
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
      fileSize: Number(upload.fileSize), // BigInt is not JSON-serialisable
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
      uploads: redactCreatorsIn(access, transformedUploads),
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
