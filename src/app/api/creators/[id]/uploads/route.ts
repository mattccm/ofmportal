import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET - Fetch all uploads by a creator with filters
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify creator belongs to agency
    const creator = await db.creator.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
      select: { id: true },
    });

    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");
    const contentType = url.searchParams.get("contentType");
    const requestId = url.searchParams.get("requestId");
    const sort = url.searchParams.get("sort") || "uploadedAt";
    const order = url.searchParams.get("order") || "desc";
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = parseInt(url.searchParams.get("pageSize") || "24", 10);

    // Build where clause
    const where: Record<string, unknown> = {
      creatorId: id,
      uploadStatus: "COMPLETED",
    };

    if (status && status !== "all") {
      where.status = status.toUpperCase();
    }

    if (requestId) {
      where.requestId = requestId;
    }

    if (contentType) {
      // Filter by MIME type category
      if (contentType === "image") {
        where.fileType = { startsWith: "image/" };
      } else if (contentType === "video") {
        where.fileType = { startsWith: "video/" };
      } else if (contentType === "audio") {
        where.fileType = { startsWith: "audio/" };
      } else if (contentType === "document") {
        where.fileType = {
          in: [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ],
        };
      }
    }

    if (dateFrom || dateTo) {
      where.uploadedAt = {};
      if (dateFrom) {
        (where.uploadedAt as Record<string, Date>).gte = new Date(dateFrom);
      }
      if (dateTo) {
        (where.uploadedAt as Record<string, Date>).lte = new Date(dateTo);
      }
    }

    const skip = (page - 1) * pageSize;

    // Get uploads with pagination
    const [uploads, total] = await Promise.all([
      db.upload.findMany({
        where,
        include: {
          request: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
          reviewedBy: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          comments: {
            take: 3,
            orderBy: { createdAt: "desc" },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          _count: {
            select: {
              comments: true,
              annotations: true,
            },
          },
        },
        orderBy: {
          [sort]: order,
        },
        skip,
        take: pageSize,
      }),
      db.upload.count({ where }),
    ]);

    // Get approval history for uploads (from activity logs)
    const uploadIds = uploads.map((u) => u.id);
    const approvalHistory = await db.activityLog.findMany({
      where: {
        entityType: "Upload",
        entityId: { in: uploadIds },
        action: { in: ["upload.approved", "upload.rejected", "upload.reviewed"] },
      },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    // Group approval history by upload ID
    const historyByUpload = approvalHistory.reduce((acc, log) => {
      if (!acc[log.entityId]) {
        acc[log.entityId] = [];
      }
      acc[log.entityId].push(log);
      return acc;
    }, {} as Record<string, typeof approvalHistory>);

    // Add history to uploads
    const uploadsWithHistory = uploads.map((upload) => ({
      ...upload,
      fileSize: Number(upload.fileSize),
      approvalHistory: historyByUpload[upload.id] || [],
    }));

    return NextResponse.json({
      uploads: uploadsWithHistory,
      pagination: {
        total,
        pageSize,
        currentPage: page,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching creator uploads:", error);
    return NextResponse.json(
      { error: "Failed to fetch uploads" },
      { status: 500 }
    );
  }
}
