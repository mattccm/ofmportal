// Template Types and Client-Side Utilities
// These can be safely imported in client components

// ============================================
// TYPES
// ============================================

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "select"
  | "checkbox"
  | "file";

export interface SelectOption {
  id: string;
  label: string;
  value: string;
}

export interface ValidationRule {
  type: "minLength" | "maxLength" | "min" | "max" | "pattern" | "required";
  value: string | number | boolean;
  message?: string;
}

export interface ConditionalVisibility {
  fieldId: string;
  operator: "equals" | "notEquals" | "contains" | "greaterThan" | "lessThan";
  value: string | number | boolean;
}

export interface TemplateField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  options?: SelectOption[]; // For select fields
  validation?: ValidationRule[];
  conditionalVisibility?: ConditionalVisibility;
  defaultValue?: string | number | boolean;

  // Quantity/multiplier for fields (e.g., "5x Content Photos")
  quantity?: number; // e.g., 5 for "5x Content Photos"
  quantityLabel?: string; // Optional custom label: "pieces", "items", "sets"

  // Rich content for field instructions/examples
  richContent?: {
    description?: string; // Detailed description/instructions (supports markdown)
    exampleText?: string; // Text example of what's expected
    exampleImages?: { url: string; caption?: string }[]; // Multiple example images with optional captions
    exampleVideoUrl?: string; // URL to example video (YouTube, Vimeo, or direct)
    referenceLinks?: { label: string; url: string }[]; // Reference links
    // Legacy single image support (deprecated, use exampleImages array)
    exampleImageUrl?: string;
  };

  // File-specific options (all optional - undefined means no restriction)
  acceptedFileTypes?: string[]; // undefined = accept all types
  maxFileSize?: number; // undefined = no size limit
  maxFiles?: number; // undefined = no max limit
  minFiles?: number; // undefined = no minimum
  showMaxFileSize?: boolean; // Whether to show max file size in upload zone (default true)

  // Flags to enable/disable file restrictions
  enforceFileTypes?: boolean; // If false, acceptedFileTypes is ignored
  enforceMaxFileSize?: boolean; // If false, maxFileSize is ignored
  enforceFileCount?: boolean; // If false, min/maxFiles are ignored
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  fields: TemplateField[];
  defaultDueDays: number;
  defaultUrgency: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    requests: number;
  };
}

export interface TemplateFormData {
  name: string;
  description?: string;
  fields: TemplateField[];
  defaultDueDays: number;
  defaultUrgency: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  isActive: boolean;
  // Index signature for useAutosave compatibility
  [key: string]: unknown;
}

// ============================================
// VALIDATION
// ============================================

export interface ValidationError {
  fieldId?: string;
  field?: string;
  message: string;
}

export function validateTemplateFields(fields: TemplateField[]): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!fields || fields.length === 0) {
    errors.push({ message: "Template must have at least one field" });
    return errors;
  }

  const labelSet = new Set<string>();

  fields.forEach((field, index) => {
    // Check for required properties
    if (!field.id) {
      errors.push({
        fieldId: `field-${index}`,
        message: `Field ${index + 1} is missing an ID`,
      });
    }

    if (!field.label || field.label.trim() === "") {
      errors.push({
        fieldId: field.id,
        message: `Field ${index + 1} must have a label`,
      });
    }

    // Check for duplicate labels
    const normalizedLabel = field.label?.toLowerCase().trim();
    if (normalizedLabel && labelSet.has(normalizedLabel)) {
      errors.push({
        fieldId: field.id,
        message: `Duplicate field label: "${field.label}"`,
      });
    } else if (normalizedLabel) {
      labelSet.add(normalizedLabel);
    }

    // Validate field type
    const validTypes: FieldType[] = [
      "text",
      "textarea",
      "number",
      "date",
      "select",
      "checkbox",
      "file",
    ];
    if (!validTypes.includes(field.type)) {
      errors.push({
        fieldId: field.id,
        message: `Invalid field type: "${field.type}"`,
      });
    }

    // Select fields must have options
    if (field.type === "select") {
      if (!field.options || field.options.length === 0) {
        errors.push({
          fieldId: field.id,
          message: `Select field "${field.label}" must have at least one option`,
        });
      } else {
        // Check for duplicate option values
        const optionValues = new Set<string>();
        field.options.forEach((option, optIndex) => {
          if (!option.value || option.value.trim() === "") {
            errors.push({
              fieldId: field.id,
              message: `Option ${optIndex + 1} in "${field.label}" must have a value`,
            });
          }
          if (optionValues.has(option.value)) {
            errors.push({
              fieldId: field.id,
              message: `Duplicate option value "${option.value}" in "${field.label}"`,
            });
          } else {
            optionValues.add(option.value);
          }
        });
      }
    }

    // Validate validation rules
    if (field.validation) {
      field.validation.forEach((rule) => {
        if (rule.type === "minLength" || rule.type === "maxLength") {
          if (typeof rule.value !== "number" || rule.value < 0) {
            errors.push({
              fieldId: field.id,
              message: `Invalid ${rule.type} value for "${field.label}"`,
            });
          }
        }

        if (rule.type === "pattern") {
          try {
            new RegExp(rule.value as string);
          } catch {
            errors.push({
              fieldId: field.id,
              message: `Invalid regex pattern for "${field.label}"`,
            });
          }
        }
      });
    }

    // Validate conditional visibility
    if (field.conditionalVisibility) {
      const dependentField = fields.find(
        (f) => f.id === field.conditionalVisibility?.fieldId
      );
      if (!dependentField) {
        errors.push({
          fieldId: field.id,
          message: `Conditional visibility references non-existent field`,
        });
      }
    }
  });

  return errors;
}

export function validateFieldValue(
  field: TemplateField,
  value: unknown
): string | null {
  // Required validation
  if (field.required) {
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    ) {
      return `${field.label} is required`;
    }
  }

  // Skip further validation if value is empty and not required
  if (value === undefined || value === null || value === "") {
    return null;
  }

  // Type-specific validation
  if (field.type === "number") {
    const numValue = Number(value);
    if (isNaN(numValue)) {
      return `${field.label} must be a valid number`;
    }
  }

  // Validation rules
  if (field.validation) {
    for (const rule of field.validation) {
      switch (rule.type) {
        case "minLength":
          if (typeof value === "string" && value.length < (rule.value as number)) {
            return rule.message || `${field.label} must be at least ${rule.value} characters`;
          }
          break;
        case "maxLength":
          if (typeof value === "string" && value.length > (rule.value as number)) {
            return rule.message || `${field.label} must be at most ${rule.value} characters`;
          }
          break;
        case "min":
          if (typeof value === "number" && value < (rule.value as number)) {
            return rule.message || `${field.label} must be at least ${rule.value}`;
          }
          break;
        case "max":
          if (typeof value === "number" && value > (rule.value as number)) {
            return rule.message || `${field.label} must be at most ${rule.value}`;
          }
          break;
        case "pattern":
          if (typeof value === "string") {
            const regex = new RegExp(rule.value as string);
            if (!regex.test(value)) {
              return rule.message || `${field.label} format is invalid`;
            }
          }
          break;
      }
    }
  }

  return null;
}

// ============================================
// DEFAULT VALUES
// ============================================

export function getDefaultValues(
  template: { fields: TemplateField[] }
): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};

  template.fields.forEach((field) => {
    if (field.defaultValue !== undefined) {
      defaults[field.id] = field.defaultValue;
    } else {
      // Set type-appropriate defaults
      switch (field.type) {
        case "checkbox":
          defaults[field.id] = false;
          break;
        case "number":
          defaults[field.id] = undefined;
          break;
        case "file":
          defaults[field.id] = [];
          break;
        default:
          defaults[field.id] = "";
      }
    }
  });

  return defaults;
}

// ============================================
// CONDITIONAL VISIBILITY
// ============================================

export function evaluateCondition(
  condition: ConditionalVisibility,
  values: Record<string, unknown>
): boolean {
  const fieldValue = values[condition.fieldId];

  switch (condition.operator) {
    case "equals":
      return fieldValue === condition.value;
    case "notEquals":
      return fieldValue !== condition.value;
    case "contains":
      if (typeof fieldValue === "string" && typeof condition.value === "string") {
        return fieldValue.toLowerCase().includes(condition.value.toLowerCase());
      }
      return false;
    case "greaterThan":
      if (typeof fieldValue === "number" && typeof condition.value === "number") {
        return fieldValue > condition.value;
      }
      return false;
    case "lessThan":
      if (typeof fieldValue === "number" && typeof condition.value === "number") {
        return fieldValue < condition.value;
      }
      return false;
    default:
      return true;
  }
}

export function isFieldVisible(
  field: TemplateField,
  values: Record<string, unknown>
): boolean {
  if (!field.conditionalVisibility) {
    return true;
  }
  return evaluateCondition(field.conditionalVisibility, values);
}

// ============================================
// FIELD HELPERS
// ============================================

export function createEmptyField(type: FieldType = "text"): TemplateField {
  const id = `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const baseField: TemplateField = {
    id,
    type,
    label: "",
    placeholder: "",
    required: false,
    validation: [],
  };

  if (type === "select") {
    baseField.options = [
      { id: `opt_${Date.now()}_1`, label: "Option 1", value: "option1" },
    ];
  }

  if (type === "file") {
    baseField.acceptedFileTypes = ["image/*", "video/*"];
    baseField.maxFileSize = 100 * 1024 * 1024; // 100MB
    baseField.maxFiles = 10;
    baseField.minFiles = 0;
    baseField.showMaxFileSize = true;
  }

  return baseField;
}

export function duplicateField(field: TemplateField): TemplateField {
  const newId = `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return {
    ...field,
    id: newId,
    label: `${field.label} (copy)`,
    options: field.options?.map((opt) => ({
      ...opt,
      id: `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    })),
  };
}

/**
 * Expand fields with quantity into individual fields
 * Example: A field with quantity=3 and label="Content Photo"
 * becomes 3 fields: "Content Photo 1", "Content Photo 2", "Content Photo 3"
 */
export function expandQuantityFields(fields: TemplateField[]): TemplateField[] {
  const expanded: TemplateField[] = [];

  for (const field of fields) {
    const quantity = field.quantity && field.quantity > 1 ? field.quantity : 1;

    if (quantity === 1) {
      // No expansion needed, just use the original field
      expanded.push(field);
    } else {
      // Expand into multiple fields
      for (let i = 1; i <= quantity; i++) {
        const expandedId = `${field.id}_${i}`;
        const expandedField: TemplateField = {
          ...field,
          id: expandedId,
          label: `${field.label} ${i}`,
          // Remove quantity so expanded fields don't show as multiplied
          quantity: undefined,
          quantityLabel: undefined,
          // Preserve options with unique IDs per expanded field
          options: field.options?.map((opt) => ({
            ...opt,
            id: `${opt.id}_${i}`,
          })),
        };
        expanded.push(expandedField);
      }
    }
  }

  return expanded;
}

/**
 * Collapse expanded fields back to their original form
 * (Useful for editing templates where fields were expanded)
 */
export function collapseQuantityFields(fields: TemplateField[]): TemplateField[] {
  const collapsed: TemplateField[] = [];
  const seenBaseIds = new Set<string>();

  for (const field of fields) {
    // Check if this is an expanded field (ends with _N where N is a number)
    const match = field.id.match(/^(.+)_(\d+)$/);

    if (match) {
      const baseId = match[1];
      if (!seenBaseIds.has(baseId)) {
        seenBaseIds.add(baseId);
        // Find all fields with this base ID and count them
        const relatedFields = fields.filter(f => f.id.startsWith(baseId + "_"));
        const originalLabel = field.label.replace(/\s+\d+$/, ""); // Remove trailing number

        collapsed.push({
          ...field,
          id: baseId,
          label: originalLabel,
          quantity: relatedFields.length,
          options: field.options?.map((opt) => ({
            ...opt,
            id: opt.id.replace(/_\d+$/, ""),
          })),
        });
      }
    } else {
      collapsed.push(field);
    }
  }

  return collapsed;
}

export const FIELD_TYPE_CONFIG: Record<
  FieldType,
  {
    label: string;
    icon: string;
    description: string;
    color: string;
  }
> = {
  text: {
    label: "Text",
    icon: "Type",
    description: "Single line text input",
    color: "blue",
  },
  textarea: {
    label: "Long Text",
    icon: "AlignLeft",
    description: "Multi-line text area",
    color: "indigo",
  },
  number: {
    label: "Number",
    icon: "Hash",
    description: "Numeric input",
    color: "green",
  },
  date: {
    label: "Date",
    icon: "Calendar",
    description: "Date picker",
    color: "orange",
  },
  select: {
    label: "Dropdown",
    icon: "ChevronDown",
    description: "Select from options",
    color: "purple",
  },
  checkbox: {
    label: "Checkbox",
    icon: "CheckSquare",
    description: "Yes/No toggle",
    color: "pink",
  },
  file: {
    label: "File Upload",
    icon: "Upload",
    description: "File attachment",
    color: "amber",
  },
};

// ============================================
// SERIALIZATION
// ============================================

export function serializeTemplate(template: TemplateFormData): {
  name: string;
  description: string | null;
  fields: string; // JSON string
  defaultDueDays: number;
  defaultUrgency: string;
  isActive: boolean;
} {
  return {
    name: template.name,
    description: template.description || null,
    fields: JSON.stringify(template.fields),
    defaultDueDays: template.defaultDueDays,
    defaultUrgency: template.defaultUrgency,
    isActive: template.isActive,
  };
}

export function deserializeTemplate(dbTemplate: {
  id: string;
  name: string;
  description: string | null;
  fields: unknown;
  defaultDueDays: number;
  defaultUrgency: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: { requests: number };
}): Template {
  let fields: TemplateField[] = [];

  try {
    if (typeof dbTemplate.fields === "string") {
      fields = JSON.parse(dbTemplate.fields);
    } else if (Array.isArray(dbTemplate.fields)) {
      fields = dbTemplate.fields as TemplateField[];
    }
  } catch {
    fields = [];
  }

  return {
    id: dbTemplate.id,
    name: dbTemplate.name,
    description: dbTemplate.description || undefined,
    fields,
    defaultDueDays: dbTemplate.defaultDueDays,
    defaultUrgency: dbTemplate.defaultUrgency as Template["defaultUrgency"],
    isActive: dbTemplate.isActive,
    createdAt: dbTemplate.createdAt,
    updatedAt: dbTemplate.updatedAt,
    _count: dbTemplate._count,
  };
}
