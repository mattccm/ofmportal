import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

// Schema for validating a single creator row
const creatorRowSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional().nullable(),
  preferredContact: z.enum(["EMAIL", "SMS", "BOTH"]).optional().default("EMAIL"),
  notes: z.string().optional().nullable(),
});

// Schema for the import request
const importRequestSchema = z.object({
  creators: z.array(creatorRowSchema),
  duplicateHandling: z.enum(["skip", "update"]).default("skip"),
  sendInvites: z.boolean().default(true),
});

// CSV template columns
const CSV_TEMPLATE_COLUMNS = [
  "name",
  "email",
  "phone",
  "preferredContact",
  "notes",
];

// GET - Download CSV template
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Generate CSV template content
    const headerRow = CSV_TEMPLATE_COLUMNS.join(",");
    const exampleRow = [
      "John Doe",
      "john@example.com",
      "+1 555-123-4567",
      "EMAIL",
      "Example creator notes",
    ].join(",");
    const csvContent = `${headerRow}\n${exampleRow}`;

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=creator_import_template.csv",
      },
    });
  } catch (error) {
    console.error("Error generating CSV template:", error);
    return NextResponse.json(
      { error: "Failed to generate template" },
      { status: 500 }
    );
  }
}

// POST - Parse and validate CSV data
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.agencyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";

    // Handle CSV file upload for parsing
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File;

      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }

      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: "File size exceeds 5MB limit" },
          { status: 400 }
        );
      }

      // Check file type
      if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
        return NextResponse.json(
          { error: "Please upload a CSV file" },
          { status: 400 }
        );
      }

      const text = await file.text();
      const parseResult = parseCSV(text);

      if (!parseResult.success) {
        return NextResponse.json(
          { error: parseResult.error, details: parseResult.details },
          { status: 400 }
        );
      }

      return NextResponse.json({
        headers: parseResult.headers,
        rows: parseResult.rows,
        rowCount: parseResult.rows!.length,
      });
    }

    // Handle JSON import request
    const body = await req.json();
    const validatedData = importRequestSchema.parse(body);

    // Get existing creators in agency for duplicate checking
    const existingCreators = await db.creator.findMany({
      where: { agencyId: session.user.agencyId },
      select: { id: true, email: true },
    });

    const existingEmailMap = new Map(
      existingCreators.map((c) => [c.email.toLowerCase(), c.id])
    );

    // Process each creator
    const results = {
      created: [] as Array<{ name: string; email: string }>,
      updated: [] as Array<{ name: string; email: string }>,
      skipped: [] as Array<{ name: string; email: string; reason: string }>,
      errors: [] as Array<{ row: number; name: string; email: string; error: string }>,
    };

    for (let i = 0; i < validatedData.creators.length; i++) {
      const creatorData = validatedData.creators[i];
      const email = creatorData.email.toLowerCase();

      try {
        const existingId = existingEmailMap.get(email);

        if (existingId) {
          if (validatedData.duplicateHandling === "skip") {
            results.skipped.push({
              name: creatorData.name,
              email: creatorData.email,
              reason: "Email already exists",
            });
            continue;
          }

          // Update existing creator
          await db.creator.update({
            where: { id: existingId },
            data: {
              name: creatorData.name,
              phone: creatorData.phone || null,
              preferredContact: creatorData.preferredContact || "EMAIL",
              notes: creatorData.notes || null,
            },
          });

          results.updated.push({
            name: creatorData.name,
            email: creatorData.email,
          });
        } else {
          // Create new creator
          const inviteToken = uuidv4();

          await db.creator.create({
            data: {
              agencyId: session.user.agencyId,
              name: creatorData.name,
              email: email,
              phone: creatorData.phone || null,
              preferredContact: creatorData.preferredContact || "EMAIL",
              notes: creatorData.notes || null,
              inviteToken,
              inviteStatus: validatedData.sendInvites ? "PENDING" : "PENDING",
              inviteSentAt: validatedData.sendInvites ? new Date() : null,
            },
          });

          results.created.push({
            name: creatorData.name,
            email: creatorData.email,
          });

          // Add to existing map to prevent duplicates within batch
          existingEmailMap.set(email, "new");
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        results.errors.push({
          row: i + 1,
          name: creatorData.name,
          email: creatorData.email,
          error: errorMessage,
        });
      }
    }

    // Log activity
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        action: "creators.bulk_import",
        entityType: "Creator",
        entityId: session.user.agencyId,
        metadata: {
          totalProcessed: validatedData.creators.length,
          created: results.created.length,
          updated: results.updated.length,
          skipped: results.skipped.length,
          errors: results.errors.length,
        },
      },
    });

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: validatedData.creators.length,
        created: results.created.length,
        updated: results.updated.length,
        skipped: results.skipped.length,
        errors: results.errors.length,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error importing creators:", error);
    return NextResponse.json(
      { error: "Failed to import creators" },
      { status: 500 }
    );
  }
}

// Helper function to parse CSV
function parseCSV(text: string): {
  success: boolean;
  headers?: string[];
  rows?: Record<string, string>[];
  error?: string;
  details?: string;
} {
  try {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      return { success: false, error: "CSV file is empty" };
    }

    // Parse header row
    const headers = parseCSVLine(lines[0]);

    if (headers.length === 0) {
      return { success: false, error: "No headers found in CSV" };
    }

    // Parse data rows
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);

      // Skip empty rows
      if (values.every((v) => v === "")) {
        continue;
      }

      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });
      rows.push(row);
    }

    if (rows.length === 0) {
      return { success: false, error: "No data rows found in CSV" };
    }

    return { success: true, headers, rows };
  } catch (error) {
    return {
      success: false,
      error: "Failed to parse CSV",
      details: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Helper function to parse a single CSV line (handles quoted values)
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          // End of quoted value
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }

  values.push(current.trim());
  return values;
}
