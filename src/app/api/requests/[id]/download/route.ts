import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDownloadPresignedUrl } from "@/lib/storage";
import archiver from "archiver";
import { Readable } from "stream";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get request with uploads
    const request = await db.contentRequest.findFirst({
      where: {
        id,
        agencyId: session.user.agencyId,
      },
      include: {
        uploads: {
          where: {
            uploadStatus: "COMPLETED",
          },
        },
        creator: {
          select: { name: true },
        },
      },
    });

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (request.uploads.length === 0) {
      return NextResponse.json(
        { error: "No uploads to download" },
        { status: 400 }
      );
    }

    // Create a ZIP archive
    const archive = archiver("zip", {
      zlib: { level: 5 }, // Compression level
    });

    // Convert archive to a readable stream
    const chunks: Buffer[] = [];

    archive.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    const archivePromise = new Promise<Buffer>((resolve, reject) => {
      archive.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
      archive.on("error", reject);
    });

    // Add each file to the archive
    for (const upload of request.uploads) {
      try {
        const url = await getDownloadPresignedUrl(upload.storageKey);
        const response = await fetch(url);

        if (response.ok && response.body) {
          // Convert web ReadableStream to Node.js Readable
          const reader = response.body.getReader();
          const nodeStream = new Readable({
            async read() {
              const { done, value } = await reader.read();
              if (done) {
                this.push(null);
              } else {
                this.push(Buffer.from(value));
              }
            },
          });

          archive.append(nodeStream, { name: upload.originalName });
        }
      } catch (error) {
        console.error(`Failed to add file ${upload.originalName}:`, error);
      }
    }

    // Finalize the archive
    archive.finalize();

    // Wait for archive to complete
    const zipBuffer = await archivePromise;

    // Return the ZIP file
    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${request.creator.name}_${request.title.replace(/[^a-z0-9]/gi, "_")}.zip"`,
      },
    });
  } catch (error) {
    console.error("Error creating download:", error);
    return NextResponse.json(
      { error: "Failed to create download" },
      { status: 500 }
    );
  }
}
