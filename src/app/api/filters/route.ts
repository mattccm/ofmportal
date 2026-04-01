import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  type SavedFilter,
  type FilterGroup,
  validateFilterGroup,
  getFilterFields,
} from "@/lib/filter-utils";

// Schema for filter condition
const filterConditionSchema = z.object({
  id: z.string(),
  field: z.string(),
  operator: z.enum([
    "equals",
    "notEquals",
    "contains",
    "notContains",
    "startsWith",
    "endsWith",
    "greaterThan",
    "lessThan",
    "greaterThanOrEqual",
    "lessThanOrEqual",
    "between",
    "in",
    "notIn",
    "isNull",
    "isNotNull",
  ]),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]),
  secondValue: z.union([z.string(), z.number(), z.null()]).optional(),
});

// Schema for filter group
const filterGroupSchema: z.ZodType<FilterGroup> = z.lazy(() =>
  z.object({
    id: z.string(),
    logic: z.enum(["AND", "OR"]),
    conditions: z.array(filterConditionSchema),
    groups: z.array(filterGroupSchema).optional(),
  })
);

// Schema for saved filter
const savedFilterSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Filter name is required").max(100),
  description: z.string().max(500).optional(),
  entityType: z.enum(["requests", "uploads", "creators"]),
  filter: filterGroupSchema,
  isPinned: z.boolean().default(false),
  isDefault: z.boolean().default(false),
});

// Helper to get saved filters from user preferences
function getSavedFiltersFromPreferences(
  preferences: Record<string, unknown>,
  entityType?: string
): SavedFilter[] {
  const savedFilters = (preferences.savedFilters || []) as SavedFilter[];
  if (entityType) {
    return savedFilters.filter((f) => f.entityType === entityType);
  }
  return savedFilters;
}

// Helper to update saved filters in user preferences
function updateSavedFiltersInPreferences(
  preferences: Record<string, unknown>,
  savedFilters: SavedFilter[]
): Record<string, unknown> {
  return {
    ...preferences,
    savedFilters,
  };
}

// GET - List saved filters
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get("entityType") as "requests" | "uploads" | "creators" | null;

    // Get user preferences
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const preferences = (user.preferences || {}) as Record<string, unknown>;
    const savedFilters = getSavedFiltersFromPreferences(preferences, entityType || undefined);

    return NextResponse.json({ filters: savedFilters });
  } catch (error) {
    console.error("Error fetching filters:", error);
    return NextResponse.json(
      { error: "Failed to fetch filters" },
      { status: 500 }
    );
  }
}

// POST - Create a new saved filter
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = savedFilterSchema.parse(body);

    // Validate the filter conditions
    const fieldDefinitions = getFilterFields(validatedData.entityType);
    const errors = validateFilterGroup(validatedData.filter, fieldDefinitions);
    if (errors.length > 0) {
      return NextResponse.json(
        { error: `Invalid filter: ${errors[0]}` },
        { status: 400 }
      );
    }

    // Get current user preferences
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const preferences = (user.preferences || {}) as Record<string, unknown>;
    const savedFilters = getSavedFiltersFromPreferences(preferences);

    // Create new filter
    const now = new Date().toISOString();
    const newFilter: SavedFilter = {
      id: `filter_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name: validatedData.name,
      description: validatedData.description,
      entityType: validatedData.entityType,
      filter: validatedData.filter,
      isPinned: validatedData.isPinned,
      isDefault: validatedData.isDefault,
      createdAt: now,
      updatedAt: now,
    };

    // If this is set as default, unset any existing default for this entity type
    if (newFilter.isDefault) {
      savedFilters.forEach((f) => {
        if (f.entityType === validatedData.entityType) {
          f.isDefault = false;
        }
      });
    }

    // Add the new filter
    savedFilters.push(newFilter);

    // Update user preferences
    const updatedPrefs = updateSavedFiltersInPreferences(preferences, savedFilters);
    await db.user.update({
      where: { id: session.user.id },
      data: {
        preferences: JSON.parse(JSON.stringify(updatedPrefs)),
      },
    });

    return NextResponse.json({ filter: newFilter }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error creating filter:", error);
    return NextResponse.json(
      { error: "Failed to create filter" },
      { status: 500 }
    );
  }
}

// PUT - Update a saved filter
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // For partial updates (like toggling isPinned), we have a simpler schema
    const partialUpdateSchema = z.object({
      id: z.string(),
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional(),
      filter: filterGroupSchema.optional(),
      isPinned: z.boolean().optional(),
      isDefault: z.boolean().optional(),
    });

    const validatedData = partialUpdateSchema.parse(body);

    // Get current user preferences
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const preferences = (user.preferences || {}) as Record<string, unknown>;
    const savedFilters = getSavedFiltersFromPreferences(preferences);

    // Find the filter to update
    const filterIndex = savedFilters.findIndex((f) => f.id === validatedData.id);
    if (filterIndex === -1) {
      return NextResponse.json({ error: "Filter not found" }, { status: 404 });
    }

    const existingFilter = savedFilters[filterIndex];

    // Validate filter conditions if filter is being updated
    if (validatedData.filter) {
      const fieldDefinitions = getFilterFields(existingFilter.entityType);
      const errors = validateFilterGroup(validatedData.filter, fieldDefinitions);
      if (errors.length > 0) {
        return NextResponse.json(
          { error: `Invalid filter: ${errors[0]}` },
          { status: 400 }
        );
      }
    }

    // If this is set as default, unset any existing default for this entity type
    if (validatedData.isDefault) {
      savedFilters.forEach((f) => {
        if (f.entityType === existingFilter.entityType && f.id !== validatedData.id) {
          f.isDefault = false;
        }
      });
    }

    // Update the filter
    savedFilters[filterIndex] = {
      ...existingFilter,
      ...(validatedData.name !== undefined && { name: validatedData.name }),
      ...(validatedData.description !== undefined && { description: validatedData.description }),
      ...(validatedData.filter && { filter: validatedData.filter }),
      ...(validatedData.isPinned !== undefined && { isPinned: validatedData.isPinned }),
      ...(validatedData.isDefault !== undefined && { isDefault: validatedData.isDefault }),
      updatedAt: new Date().toISOString(),
    };

    // Update user preferences
    await db.user.update({
      where: { id: session.user.id },
      data: {
        preferences: JSON.parse(JSON.stringify(updateSavedFiltersInPreferences(preferences, savedFilters))),
      },
    });

    return NextResponse.json({ filter: savedFilters[filterIndex] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Error updating filter:", error);
    return NextResponse.json(
      { error: "Failed to update filter" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a saved filter
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filterId = searchParams.get("id");

    if (!filterId) {
      return NextResponse.json(
        { error: "Filter ID is required" },
        { status: 400 }
      );
    }

    // Get current user preferences
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const preferences = (user.preferences || {}) as Record<string, unknown>;
    const savedFilters = getSavedFiltersFromPreferences(preferences);

    // Find and remove the filter
    const filterIndex = savedFilters.findIndex((f) => f.id === filterId);
    if (filterIndex === -1) {
      return NextResponse.json({ error: "Filter not found" }, { status: 404 });
    }

    savedFilters.splice(filterIndex, 1);

    // Update user preferences
    await db.user.update({
      where: { id: session.user.id },
      data: {
        preferences: JSON.parse(JSON.stringify(updateSavedFiltersInPreferences(preferences, savedFilters))),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting filter:", error);
    return NextResponse.json(
      { error: "Failed to delete filter" },
      { status: 500 }
    );
  }
}
