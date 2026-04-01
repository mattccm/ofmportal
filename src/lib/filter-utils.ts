// Filter Utilities for Saved Views System
// Provides parsing, applying, and serialization for filter configurations

export type FilterOperator =
  | "equals"
  | "notEquals"
  | "contains"
  | "notContains"
  | "startsWith"
  | "endsWith"
  | "greaterThan"
  | "lessThan"
  | "greaterThanOrEqual"
  | "lessThanOrEqual"
  | "between"
  | "in"
  | "notIn"
  | "isNull"
  | "isNotNull";

export type FilterLogic = "AND" | "OR";

export interface FilterCondition {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string | number | boolean | string[] | null;
  secondValue?: string | number | null; // For "between" operator
}

export interface FilterGroup {
  id: string;
  logic: FilterLogic;
  conditions: FilterCondition[];
  groups?: FilterGroup[]; // Nested groups for complex logic
}

export interface SavedFilter {
  id: string;
  name: string;
  description?: string;
  entityType: "requests" | "uploads" | "creators";
  filter: FilterGroup;
  isPinned: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FilterFieldDefinition {
  field: string;
  label: string;
  type: "string" | "number" | "date" | "datetime" | "boolean" | "enum" | "relation";
  operators: FilterOperator[];
  options?: { value: string; label: string }[]; // For enum/relation fields
  relationEntity?: string; // For relation fields
}

// Field definitions for different entity types
export const REQUEST_FILTER_FIELDS: FilterFieldDefinition[] = [
  {
    field: "status",
    label: "Status",
    type: "enum",
    operators: ["equals", "notEquals", "in", "notIn"],
    options: [
      { value: "DRAFT", label: "Draft" },
      { value: "PENDING", label: "Pending" },
      { value: "IN_PROGRESS", label: "In Progress" },
      { value: "SUBMITTED", label: "Submitted" },
      { value: "UNDER_REVIEW", label: "Under Review" },
      { value: "NEEDS_REVISION", label: "Needs Revision" },
      { value: "APPROVED", label: "Approved" },
      { value: "CANCELLED", label: "Cancelled" },
      { value: "ARCHIVED", label: "Archived" },
    ],
  },
  {
    field: "urgency",
    label: "Urgency",
    type: "enum",
    operators: ["equals", "notEquals", "in", "notIn"],
    options: [
      { value: "LOW", label: "Low" },
      { value: "NORMAL", label: "Normal" },
      { value: "HIGH", label: "High" },
      { value: "URGENT", label: "Urgent" },
    ],
  },
  {
    field: "title",
    label: "Title",
    type: "string",
    operators: ["contains", "notContains", "startsWith", "endsWith", "equals"],
  },
  {
    field: "creatorId",
    label: "Creator",
    type: "relation",
    operators: ["equals", "notEquals", "in", "notIn", "isNull", "isNotNull"],
    relationEntity: "creator",
  },
  {
    field: "templateId",
    label: "Template",
    type: "relation",
    operators: ["equals", "notEquals", "in", "notIn", "isNull", "isNotNull"],
    relationEntity: "template",
  },
  {
    field: "dueDate",
    label: "Due Date",
    type: "date",
    operators: ["equals", "greaterThan", "lessThan", "between", "isNull", "isNotNull"],
  },
  {
    field: "createdAt",
    label: "Created Date",
    type: "datetime",
    operators: ["equals", "greaterThan", "lessThan", "between"],
  },
  {
    field: "updatedAt",
    label: "Last Updated",
    type: "datetime",
    operators: ["equals", "greaterThan", "lessThan", "between"],
  },
];

export const UPLOAD_FILTER_FIELDS: FilterFieldDefinition[] = [
  {
    field: "status",
    label: "Review Status",
    type: "enum",
    operators: ["equals", "notEquals", "in", "notIn"],
    options: [
      { value: "PENDING", label: "Pending" },
      { value: "APPROVED", label: "Approved" },
      { value: "REJECTED", label: "Rejected" },
    ],
  },
  {
    field: "uploadStatus",
    label: "Upload Status",
    type: "enum",
    operators: ["equals", "notEquals", "in", "notIn"],
    options: [
      { value: "PENDING", label: "Pending" },
      { value: "UPLOADING", label: "Uploading" },
      { value: "PROCESSING", label: "Processing" },
      { value: "COMPLETED", label: "Completed" },
      { value: "FAILED", label: "Failed" },
    ],
  },
  {
    field: "fileType",
    label: "File Type",
    type: "string",
    operators: ["contains", "startsWith", "equals"],
  },
  {
    field: "originalName",
    label: "File Name",
    type: "string",
    operators: ["contains", "notContains", "startsWith", "endsWith", "equals"],
  },
  {
    field: "creatorId",
    label: "Creator",
    type: "relation",
    operators: ["equals", "notEquals", "in", "notIn"],
    relationEntity: "creator",
  },
  {
    field: "requestId",
    label: "Request",
    type: "relation",
    operators: ["equals", "notEquals", "in", "notIn"],
    relationEntity: "request",
  },
  {
    field: "uploadedAt",
    label: "Upload Date",
    type: "datetime",
    operators: ["equals", "greaterThan", "lessThan", "between", "isNull", "isNotNull"],
  },
  {
    field: "fileSize",
    label: "File Size (bytes)",
    type: "number",
    operators: ["equals", "greaterThan", "lessThan", "between"],
  },
  {
    field: "rating",
    label: "Rating",
    type: "number",
    operators: ["equals", "greaterThan", "lessThan", "greaterThanOrEqual", "lessThanOrEqual", "isNull", "isNotNull"],
  },
];

export const CREATOR_FILTER_FIELDS: FilterFieldDefinition[] = [
  {
    field: "inviteStatus",
    label: "Invite Status",
    type: "enum",
    operators: ["equals", "notEquals", "in", "notIn"],
    options: [
      { value: "PENDING", label: "Pending" },
      { value: "ACCEPTED", label: "Accepted" },
      { value: "EXPIRED", label: "Expired" },
    ],
  },
  {
    field: "name",
    label: "Name",
    type: "string",
    operators: ["contains", "notContains", "startsWith", "endsWith", "equals"],
  },
  {
    field: "email",
    label: "Email",
    type: "string",
    operators: ["contains", "notContains", "startsWith", "endsWith", "equals"],
  },
  {
    field: "preferredContact",
    label: "Preferred Contact",
    type: "enum",
    operators: ["equals", "notEquals"],
    options: [
      { value: "EMAIL", label: "Email" },
      { value: "SMS", label: "SMS" },
      { value: "BOTH", label: "Both" },
    ],
  },
  {
    field: "createdAt",
    label: "Created Date",
    type: "datetime",
    operators: ["equals", "greaterThan", "lessThan", "between"],
  },
  {
    field: "lastLoginAt",
    label: "Last Login",
    type: "datetime",
    operators: ["equals", "greaterThan", "lessThan", "between", "isNull", "isNotNull"],
  },
];

// Get filter fields by entity type
export function getFilterFields(entityType: "requests" | "uploads" | "creators"): FilterFieldDefinition[] {
  switch (entityType) {
    case "requests":
      return REQUEST_FILTER_FIELDS;
    case "uploads":
      return UPLOAD_FILTER_FIELDS;
    case "creators":
      return CREATOR_FILTER_FIELDS;
    default:
      return [];
  }
}

// Get operators available for a field type
export function getOperatorsForFieldType(type: FilterFieldDefinition["type"]): FilterOperator[] {
  switch (type) {
    case "string":
      return ["equals", "notEquals", "contains", "notContains", "startsWith", "endsWith"];
    case "number":
      return ["equals", "notEquals", "greaterThan", "lessThan", "greaterThanOrEqual", "lessThanOrEqual", "between"];
    case "date":
    case "datetime":
      return ["equals", "greaterThan", "lessThan", "between", "isNull", "isNotNull"];
    case "boolean":
      return ["equals"];
    case "enum":
      return ["equals", "notEquals", "in", "notIn"];
    case "relation":
      return ["equals", "notEquals", "in", "notIn", "isNull", "isNotNull"];
    default:
      return ["equals"];
  }
}

// Get human-readable operator label
export function getOperatorLabel(operator: FilterOperator): string {
  const labels: Record<FilterOperator, string> = {
    equals: "equals",
    notEquals: "does not equal",
    contains: "contains",
    notContains: "does not contain",
    startsWith: "starts with",
    endsWith: "ends with",
    greaterThan: "is greater than",
    lessThan: "is less than",
    greaterThanOrEqual: "is greater than or equal to",
    lessThanOrEqual: "is less than or equal to",
    between: "is between",
    in: "is one of",
    notIn: "is not one of",
    isNull: "is empty",
    isNotNull: "is not empty",
  };
  return labels[operator];
}

// Check if operator requires a value
export function operatorRequiresValue(operator: FilterOperator): boolean {
  return !["isNull", "isNotNull"].includes(operator);
}

// Check if operator requires a second value (for between)
export function operatorRequiresSecondValue(operator: FilterOperator): boolean {
  return operator === "between";
}

// Generate a unique ID for conditions/groups
export function generateFilterId(): string {
  return `filter_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Create a new empty filter condition
export function createEmptyCondition(): FilterCondition {
  return {
    id: generateFilterId(),
    field: "",
    operator: "equals",
    value: null,
  };
}

// Create a new empty filter group
export function createEmptyFilterGroup(): FilterGroup {
  return {
    id: generateFilterId(),
    logic: "AND",
    conditions: [createEmptyCondition()],
  };
}

// Create a new saved filter
export function createEmptySavedFilter(entityType: "requests" | "uploads" | "creators"): Omit<SavedFilter, "id" | "createdAt" | "updatedAt"> {
  return {
    name: "",
    entityType,
    filter: createEmptyFilterGroup(),
    isPinned: false,
    isDefault: false,
  };
}

// Validate a filter condition
export function validateCondition(condition: FilterCondition, fieldDefs: FilterFieldDefinition[]): string | null {
  if (!condition.field) {
    return "Field is required";
  }

  const fieldDef = fieldDefs.find((f) => f.field === condition.field);
  if (!fieldDef) {
    return "Invalid field selected";
  }

  if (!fieldDef.operators.includes(condition.operator)) {
    return "Invalid operator for this field";
  }

  if (operatorRequiresValue(condition.operator)) {
    if (condition.value === null || condition.value === undefined || condition.value === "") {
      return "Value is required";
    }
  }

  if (operatorRequiresSecondValue(condition.operator)) {
    if (condition.secondValue === null || condition.secondValue === undefined || condition.secondValue === "") {
      return "Second value is required for between operator";
    }
  }

  return null;
}

// Validate a filter group
export function validateFilterGroup(group: FilterGroup, fieldDefs: FilterFieldDefinition[]): string[] {
  const errors: string[] = [];

  if (group.conditions.length === 0 && (!group.groups || group.groups.length === 0)) {
    errors.push("At least one condition is required");
    return errors;
  }

  group.conditions.forEach((condition, index) => {
    const error = validateCondition(condition, fieldDefs);
    if (error) {
      errors.push(`Condition ${index + 1}: ${error}`);
    }
  });

  if (group.groups) {
    group.groups.forEach((nestedGroup, index) => {
      const nestedErrors = validateFilterGroup(nestedGroup, fieldDefs);
      nestedErrors.forEach((error) => {
        errors.push(`Group ${index + 1}: ${error}`);
      });
    });
  }

  return errors;
}

// Serialize a filter to a URL-safe string
export function serializeFilter(filter: FilterGroup): string {
  return encodeURIComponent(JSON.stringify(filter));
}

// Deserialize a filter from a URL-safe string
export function deserializeFilter(serialized: string): FilterGroup | null {
  try {
    return JSON.parse(decodeURIComponent(serialized));
  } catch {
    return null;
  }
}

// Convert filter condition to Prisma where clause
export function conditionToPrismaWhere(condition: FilterCondition): Record<string, unknown> | null {
  if (!condition.field || !operatorRequiresValue(condition.operator) && !["isNull", "isNotNull"].includes(condition.operator)) {
    return null;
  }

  const { field, operator, value, secondValue } = condition;

  switch (operator) {
    case "equals":
      return { [field]: value };
    case "notEquals":
      return { [field]: { not: value } };
    case "contains":
      return { [field]: { contains: value as string, mode: "insensitive" } };
    case "notContains":
      return { NOT: { [field]: { contains: value as string, mode: "insensitive" } } };
    case "startsWith":
      return { [field]: { startsWith: value as string, mode: "insensitive" } };
    case "endsWith":
      return { [field]: { endsWith: value as string, mode: "insensitive" } };
    case "greaterThan":
      return { [field]: { gt: value } };
    case "lessThan":
      return { [field]: { lt: value } };
    case "greaterThanOrEqual":
      return { [field]: { gte: value } };
    case "lessThanOrEqual":
      return { [field]: { lte: value } };
    case "between":
      return { [field]: { gte: value, lte: secondValue } };
    case "in":
      return { [field]: { in: Array.isArray(value) ? value : [value] } };
    case "notIn":
      return { [field]: { notIn: Array.isArray(value) ? value : [value] } };
    case "isNull":
      return { [field]: null };
    case "isNotNull":
      return { NOT: { [field]: null } };
    default:
      return null;
  }
}

// Convert filter group to Prisma where clause
export function filterGroupToPrismaWhere(group: FilterGroup): Record<string, unknown> {
  const conditions: Record<string, unknown>[] = [];

  // Process conditions
  group.conditions.forEach((condition) => {
    const prismaCondition = conditionToPrismaWhere(condition);
    if (prismaCondition) {
      conditions.push(prismaCondition);
    }
  });

  // Process nested groups
  if (group.groups) {
    group.groups.forEach((nestedGroup) => {
      const nestedWhere = filterGroupToPrismaWhere(nestedGroup);
      if (Object.keys(nestedWhere).length > 0) {
        conditions.push(nestedWhere);
      }
    });
  }

  if (conditions.length === 0) {
    return {};
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  return group.logic === "AND" ? { AND: conditions } : { OR: conditions };
}

// Parse date value for filters
export function parseDateValue(value: string | number | Date): Date {
  if (value instanceof Date) {
    return value;
  }
  return new Date(value);
}

// Format a condition for display
export function formatConditionForDisplay(
  condition: FilterCondition,
  fieldDefs: FilterFieldDefinition[]
): string {
  const fieldDef = fieldDefs.find((f) => f.field === condition.field);
  const fieldLabel = fieldDef?.label || condition.field;
  const operatorLabel = getOperatorLabel(condition.operator);

  if (!operatorRequiresValue(condition.operator)) {
    return `${fieldLabel} ${operatorLabel}`;
  }

  let valueDisplay: string;
  if (fieldDef?.options && !Array.isArray(condition.value)) {
    const option = fieldDef.options.find((o) => o.value === condition.value);
    valueDisplay = option?.label || String(condition.value);
  } else if (Array.isArray(condition.value)) {
    if (fieldDef?.options) {
      valueDisplay = condition.value
        .map((v) => fieldDef.options?.find((o) => o.value === v)?.label || v)
        .join(", ");
    } else {
      valueDisplay = condition.value.join(", ");
    }
  } else {
    valueDisplay = String(condition.value);
  }

  if (operatorRequiresSecondValue(condition.operator) && condition.secondValue !== undefined) {
    return `${fieldLabel} ${operatorLabel} ${valueDisplay} and ${condition.secondValue}`;
  }

  return `${fieldLabel} ${operatorLabel} "${valueDisplay}"`;
}

// Format a filter group for display (short summary)
export function formatFilterGroupSummary(group: FilterGroup, fieldDefs: FilterFieldDefinition[]): string {
  const totalConditions = group.conditions.length + (group.groups?.reduce((sum, g) => sum + g.conditions.length, 0) || 0);

  if (totalConditions === 0) {
    return "No filters";
  }

  if (totalConditions === 1 && group.conditions.length === 1) {
    return formatConditionForDisplay(group.conditions[0], fieldDefs);
  }

  return `${totalConditions} filter${totalConditions !== 1 ? "s" : ""} (${group.logic})`;
}

// Quick filter presets
export interface QuickFilterPreset {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  entityType: "requests" | "uploads" | "creators";
  filter: FilterGroup;
}

export const QUICK_FILTER_PRESETS: QuickFilterPreset[] = [
  {
    id: "requests-overdue",
    name: "Overdue Requests",
    description: "Requests past their due date",
    entityType: "requests",
    filter: {
      id: "preset-overdue",
      logic: "AND",
      conditions: [
        {
          id: "cond-1",
          field: "dueDate",
          operator: "lessThan",
          value: new Date().toISOString(),
        },
        {
          id: "cond-2",
          field: "status",
          operator: "notIn",
          value: ["APPROVED", "CANCELLED", "ARCHIVED"],
        },
      ],
    },
  },
  {
    id: "requests-urgent",
    name: "Urgent Requests",
    description: "High priority and urgent requests",
    entityType: "requests",
    filter: {
      id: "preset-urgent",
      logic: "AND",
      conditions: [
        {
          id: "cond-1",
          field: "urgency",
          operator: "in",
          value: ["HIGH", "URGENT"],
        },
      ],
    },
  },
  {
    id: "requests-pending-review",
    name: "Pending Review",
    description: "Submitted requests awaiting review",
    entityType: "requests",
    filter: {
      id: "preset-pending-review",
      logic: "AND",
      conditions: [
        {
          id: "cond-1",
          field: "status",
          operator: "in",
          value: ["SUBMITTED", "UNDER_REVIEW"],
        },
      ],
    },
  },
  {
    id: "uploads-pending",
    name: "Pending Uploads",
    description: "Uploads waiting for review",
    entityType: "uploads",
    filter: {
      id: "preset-uploads-pending",
      logic: "AND",
      conditions: [
        {
          id: "cond-1",
          field: "status",
          operator: "equals",
          value: "PENDING",
        },
      ],
    },
  },
  {
    id: "uploads-rejected",
    name: "Rejected Uploads",
    description: "Uploads that were rejected",
    entityType: "uploads",
    filter: {
      id: "preset-uploads-rejected",
      logic: "AND",
      conditions: [
        {
          id: "cond-1",
          field: "status",
          operator: "equals",
          value: "REJECTED",
        },
      ],
    },
  },
  {
    id: "creators-inactive",
    name: "Inactive Creators",
    description: "Creators who haven't logged in recently",
    entityType: "creators",
    filter: {
      id: "preset-creators-inactive",
      logic: "OR",
      conditions: [
        {
          id: "cond-1",
          field: "lastLoginAt",
          operator: "isNull",
          value: null,
        },
      ],
    },
  },
  {
    id: "creators-pending-invite",
    name: "Pending Invites",
    description: "Creators who haven't accepted their invitation",
    entityType: "creators",
    filter: {
      id: "preset-creators-pending",
      logic: "AND",
      conditions: [
        {
          id: "cond-1",
          field: "inviteStatus",
          operator: "equals",
          value: "PENDING",
        },
      ],
    },
  },
];

export function getQuickFilterPresets(entityType: "requests" | "uploads" | "creators"): QuickFilterPreset[] {
  return QUICK_FILTER_PRESETS.filter((preset) => preset.entityType === entityType);
}
