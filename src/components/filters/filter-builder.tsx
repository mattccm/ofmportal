"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus,
  Trash2,
  X,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type FilterCondition,
  type FilterGroup,
  type FilterFieldDefinition,
  type FilterLogic,
  type FilterOperator,
  createEmptyCondition,
  generateFilterId,
  getOperatorLabel,
  operatorRequiresValue,
  operatorRequiresSecondValue,
  formatConditionForDisplay,
} from "@/lib/filter-utils";

interface FilterBuilderProps {
  filterGroup: FilterGroup;
  onChange: (filterGroup: FilterGroup) => void;
  fieldDefinitions: FilterFieldDefinition[];
  relationOptions?: Record<string, { value: string; label: string }[]>;
  className?: string;
  compact?: boolean;
  maxConditions?: number;
}

export function FilterBuilder({
  filterGroup,
  onChange,
  fieldDefinitions,
  relationOptions = {},
  className,
  compact = false,
  maxConditions = 10,
}: FilterBuilderProps) {
  const updateCondition = useCallback(
    (conditionId: string, updates: Partial<FilterCondition>) => {
      const updatedConditions = filterGroup.conditions.map((condition) =>
        condition.id === conditionId ? { ...condition, ...updates } : condition
      );
      onChange({ ...filterGroup, conditions: updatedConditions });
    },
    [filterGroup, onChange]
  );

  const addCondition = useCallback(() => {
    if (filterGroup.conditions.length >= maxConditions) return;
    onChange({
      ...filterGroup,
      conditions: [...filterGroup.conditions, createEmptyCondition()],
    });
  }, [filterGroup, onChange, maxConditions]);

  const removeCondition = useCallback(
    (conditionId: string) => {
      const updatedConditions = filterGroup.conditions.filter(
        (c) => c.id !== conditionId
      );
      onChange({ ...filterGroup, conditions: updatedConditions });
    },
    [filterGroup, onChange]
  );

  const updateLogic = useCallback(
    (logic: FilterLogic) => {
      onChange({ ...filterGroup, logic });
    },
    [filterGroup, onChange]
  );

  const clearAllConditions = useCallback(() => {
    onChange({
      ...filterGroup,
      conditions: [createEmptyCondition()],
    });
  }, [filterGroup, onChange]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Logic Selector */}
      {filterGroup.conditions.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Match</span>
          <Select
            value={filterGroup.logic}
            onValueChange={(value) => updateLogic(value as FilterLogic)}
          >
            <SelectTrigger className="w-[100px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AND">All (AND)</SelectItem>
              <SelectItem value="OR">Any (OR)</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">of the following conditions</span>
        </div>
      )}

      {/* Conditions List */}
      <div className="space-y-3">
        {filterGroup.conditions.map((condition, index) => (
          <FilterConditionRow
            key={condition.id}
            condition={condition}
            index={index}
            fieldDefinitions={fieldDefinitions}
            relationOptions={relationOptions}
            onUpdate={(updates) => updateCondition(condition.id, updates)}
            onRemove={() => removeCondition(condition.id)}
            showLogicLabel={index > 0}
            logic={filterGroup.logic}
            compact={compact}
            canRemove={filterGroup.conditions.length > 1}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addCondition}
          disabled={filterGroup.conditions.length >= maxConditions}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Condition
        </Button>

        {filterGroup.conditions.length > 1 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAllConditions}
            className="text-muted-foreground"
          >
            Clear All
          </Button>
        )}
      </div>
    </div>
  );
}

interface FilterConditionRowProps {
  condition: FilterCondition;
  index: number;
  fieldDefinitions: FilterFieldDefinition[];
  relationOptions: Record<string, { value: string; label: string }[]>;
  onUpdate: (updates: Partial<FilterCondition>) => void;
  onRemove: () => void;
  showLogicLabel: boolean;
  logic: FilterLogic;
  compact: boolean;
  canRemove: boolean;
}

function FilterConditionRow({
  condition,
  index,
  fieldDefinitions,
  relationOptions,
  onUpdate,
  onRemove,
  showLogicLabel,
  logic,
  compact,
  canRemove,
}: FilterConditionRowProps) {
  const selectedField = fieldDefinitions.find((f) => f.field === condition.field);
  const availableOperators = selectedField?.operators || ["equals"];

  // Get value options for enum/relation fields
  const getValueOptions = () => {
    if (selectedField?.type === "relation" && selectedField.relationEntity) {
      return relationOptions[selectedField.relationEntity] || [];
    }
    return selectedField?.options || [];
  };

  const valueOptions = getValueOptions();
  const showValueInput = operatorRequiresValue(condition.operator);
  const showSecondValue = operatorRequiresSecondValue(condition.operator);
  const isMultiValue = ["in", "notIn"].includes(condition.operator);

  const handleFieldChange = (field: string) => {
    const newFieldDef = fieldDefinitions.find((f) => f.field === field);
    const defaultOperator = newFieldDef?.operators[0] || "equals";
    onUpdate({ field, operator: defaultOperator, value: null, secondValue: undefined });
  };

  const handleOperatorChange = (operator: FilterOperator) => {
    // Reset value when operator changes
    onUpdate({ operator, value: null, secondValue: undefined });
  };

  const handleValueChange = (value: string | string[]) => {
    // Handle type conversion based on field type
    let processedValue: string | number | boolean | string[] | null = value;

    if (selectedField) {
      if (selectedField.type === "number") {
        processedValue = value === "" ? null : Number(value);
      } else if (selectedField.type === "boolean") {
        processedValue = value === "true";
      }
    }

    onUpdate({ value: processedValue });
  };

  const handleSecondValueChange = (value: string) => {
    let processedValue: string | number | null = value;
    if (selectedField?.type === "number") {
      processedValue = value === "" ? null : Number(value);
    }
    onUpdate({ secondValue: processedValue });
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        {showLogicLabel && (
          <Badge variant="secondary" className="text-[10px] px-1.5">
            {logic}
          </Badge>
        )}
        <span className="text-muted-foreground">
          {formatConditionForDisplay(condition, fieldDefinitions)}
        </span>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={onRemove}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className="border-dashed">
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          {/* Drag Handle (visual only for now) */}
          <div className="flex items-center pt-2">
            <GripVertical className="h-4 w-4 text-muted-foreground/50" />
          </div>

          {/* Logic Label */}
          <div className="w-14 flex items-center pt-2">
            {showLogicLabel ? (
              <Badge variant="outline" className="text-[10px] px-1.5">
                {logic}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">Where</span>
            )}
          </div>

          {/* Field Selector */}
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Select value={condition.field || ""} onValueChange={handleFieldChange}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent>
                  {fieldDefinitions.map((field) => (
                    <SelectItem key={field.field} value={field.field}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Operator Selector */}
              <Select
                value={condition.operator}
                onValueChange={handleOperatorChange}
                disabled={!condition.field}
              >
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Select operator" />
                </SelectTrigger>
                <SelectContent>
                  {availableOperators.map((op) => (
                    <SelectItem key={op} value={op}>
                      {getOperatorLabel(op)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Value Input */}
              {showValueInput && (
                <>
                  {valueOptions.length > 0 ? (
                    isMultiValue ? (
                      <MultiSelectValue
                        options={valueOptions}
                        value={(Array.isArray(condition.value) ? condition.value : condition.value ? [String(condition.value)] : []) as string[]}
                        onChange={handleValueChange}
                      />
                    ) : (
                      <Select
                        value={String(condition.value || "")}
                        onValueChange={handleValueChange}
                      >
                        <SelectTrigger className="w-[160px] h-9">
                          <SelectValue placeholder="Select value" />
                        </SelectTrigger>
                        <SelectContent>
                          {valueOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )
                  ) : selectedField?.type === "date" || selectedField?.type === "datetime" ? (
                    <Input
                      type={selectedField.type === "datetime" ? "datetime-local" : "date"}
                      value={condition.value ? String(condition.value).slice(0, selectedField.type === "datetime" ? 16 : 10) : ""}
                      onChange={(e) => handleValueChange(new Date(e.target.value).toISOString())}
                      className="w-[180px] h-9"
                    />
                  ) : selectedField?.type === "number" ? (
                    <Input
                      type="number"
                      value={condition.value !== null ? String(condition.value) : ""}
                      onChange={(e) => handleValueChange(e.target.value)}
                      placeholder="Enter value"
                      className="w-[140px] h-9"
                    />
                  ) : (
                    <Input
                      type="text"
                      value={String(condition.value || "")}
                      onChange={(e) => handleValueChange(e.target.value)}
                      placeholder="Enter value"
                      className="w-[160px] h-9"
                    />
                  )}

                  {/* Second Value for "between" */}
                  {showSecondValue && (
                    <>
                      <span className="flex items-center text-sm text-muted-foreground">and</span>
                      {selectedField?.type === "date" || selectedField?.type === "datetime" ? (
                        <Input
                          type={selectedField.type === "datetime" ? "datetime-local" : "date"}
                          value={condition.secondValue ? String(condition.secondValue).slice(0, selectedField.type === "datetime" ? 16 : 10) : ""}
                          onChange={(e) => handleSecondValueChange(new Date(e.target.value).toISOString())}
                          className="w-[180px] h-9"
                        />
                      ) : (
                        <Input
                          type={selectedField?.type === "number" ? "number" : "text"}
                          value={condition.secondValue !== null && condition.secondValue !== undefined ? String(condition.secondValue) : ""}
                          onChange={(e) => handleSecondValueChange(e.target.value)}
                          placeholder="End value"
                          className="w-[140px] h-9"
                        />
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Remove Button */}
          {canRemove && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-destructive"
              onClick={onRemove}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface MultiSelectValueProps {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
}

function MultiSelectValue({ options, value, onChange }: MultiSelectValueProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleValue = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const selectedLabels = value
    .map((v) => options.find((o) => o.value === v)?.label || v)
    .join(", ");

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        className="w-[200px] h-9 justify-between font-normal"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate text-left">
          {value.length > 0 ? selectedLabels : "Select values"}
        </span>
        <span className="ml-2 text-muted-foreground">
          {value.length > 0 && `(${value.length})`}
        </span>
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 z-50 mt-1 w-[200px] rounded-md border bg-popover p-1 shadow-md">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent",
                value.includes(option.value) && "bg-accent"
              )}
              onClick={() => toggleValue(option.value)}
            >
              <div
                className={cn(
                  "h-4 w-4 rounded border",
                  value.includes(option.value)
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-input"
                )}
              >
                {value.includes(option.value) && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              {option.label}
            </button>
          ))}
          <div className="border-t mt-1 pt-1 flex gap-1">
            <button
              type="button"
              className="flex-1 rounded-sm px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
              onClick={() => onChange(options.map((o) => o.value))}
            >
              Select All
            </button>
            <button
              type="button"
              className="flex-1 rounded-sm px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
              onClick={() => onChange([])}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

// Compact filter display component
interface FilterSummaryProps {
  filterGroup: FilterGroup;
  fieldDefinitions: FilterFieldDefinition[];
  onClear?: () => void;
  className?: string;
}

export function FilterSummary({
  filterGroup,
  fieldDefinitions,
  onClear,
  className,
}: FilterSummaryProps) {
  const validConditions = filterGroup.conditions.filter(
    (c) => c.field && (c.value !== null || !operatorRequiresValue(c.operator))
  );

  if (validConditions.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span className="text-xs text-muted-foreground">Filters:</span>
      {validConditions.map((condition, index) => (
        <Badge key={condition.id} variant="secondary" className="text-xs gap-1">
          {index > 0 && (
            <span className="text-muted-foreground">{filterGroup.logic}</span>
          )}
          {formatConditionForDisplay(condition, fieldDefinitions)}
        </Badge>
      ))}
      {onClear && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={onClear}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
