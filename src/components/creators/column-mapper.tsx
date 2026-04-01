"use client";

import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Check, ArrowRight } from "lucide-react";

// Define the target fields for creator import
export const CREATOR_FIELDS = [
  { key: "name", label: "Name", required: true, description: "Creator's full name" },
  { key: "email", label: "Email", required: true, description: "Valid email address" },
  { key: "phone", label: "Phone", required: false, description: "Phone number for SMS" },
  { key: "preferredContact", label: "Preferred Contact", required: false, description: "EMAIL, SMS, or BOTH" },
  { key: "notes", label: "Notes", required: false, description: "Internal notes" },
] as const;

export type CreatorField = (typeof CREATOR_FIELDS)[number]["key"];

export interface ColumnMapping {
  [sourceColumn: string]: CreatorField | "";
}

interface ColumnMapperProps {
  headers: string[];
  sampleData: Record<string, string>[];
  mapping: ColumnMapping;
  onMappingChange: (mapping: ColumnMapping) => void;
}

// Auto-detect column mapping based on common header names
export function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};

  const headerMatches: Record<CreatorField, string[]> = {
    name: ["name", "full_name", "fullname", "creator_name", "creatorname", "display_name"],
    email: ["email", "email_address", "emailaddress", "e-mail", "mail"],
    phone: ["phone", "phone_number", "phonenumber", "telephone", "tel", "mobile", "cell"],
    preferredContact: ["preferred_contact", "preferredcontact", "contact_method", "contactmethod", "contact_preference"],
    notes: ["notes", "note", "comments", "comment", "description", "internal_notes"],
  };

  headers.forEach((header) => {
    const normalizedHeader = header.toLowerCase().trim().replace(/[\s-_]/g, "_");

    for (const [field, matches] of Object.entries(headerMatches)) {
      if (matches.some((match) => normalizedHeader.includes(match) || match.includes(normalizedHeader))) {
        // Only map if not already mapped
        if (!Object.values(mapping).includes(field as CreatorField)) {
          mapping[header] = field as CreatorField;
          break;
        }
      }
    }

    // If no match found, set empty
    if (!(header in mapping)) {
      mapping[header] = "";
    }
  });

  return mapping;
}

export function ColumnMapper({
  headers,
  sampleData,
  mapping,
  onMappingChange,
}: ColumnMapperProps) {
  // Calculate which fields are mapped
  const mappedFields = useMemo(() => {
    return new Set(Object.values(mapping).filter((v) => v !== ""));
  }, [mapping]);

  // Check for required fields
  const missingRequired = useMemo(() => {
    return CREATOR_FIELDS.filter((field) => field.required && !mappedFields.has(field.key));
  }, [mappedFields]);

  // Get available fields for a specific column (exclude already mapped fields except current)
  const getAvailableFields = (currentColumn: string) => {
    const currentMapping = mapping[currentColumn];
    return CREATOR_FIELDS.filter(
      (field) => !mappedFields.has(field.key) || field.key === currentMapping
    );
  };

  // Handle mapping change for a specific column
  const handleMappingChange = (column: string, value: string) => {
    onMappingChange({
      ...mapping,
      [column]: value as CreatorField | "",
    });
  };

  return (
    <div className="space-y-6">
      {/* Required fields status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Required Fields</CardTitle>
          <CardDescription>
            Map your CSV columns to the required creator fields
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {CREATOR_FIELDS.filter((f) => f.required).map((field) => {
              const isMapped = mappedFields.has(field.key);
              return (
                <Badge
                  key={field.key}
                  variant={isMapped ? "default" : "outline"}
                  className={
                    isMapped
                      ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                      : "bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800"
                  }
                >
                  {isMapped ? (
                    <Check className="w-3 h-3 mr-1" />
                  ) : (
                    <AlertCircle className="w-3 h-3 mr-1" />
                  )}
                  {field.label}
                </Badge>
              );
            })}
          </div>
          {missingRequired.length > 0 && (
            <p className="mt-3 text-sm text-yellow-600 dark:text-yellow-400">
              Please map the required fields: {missingRequired.map((f) => f.label).join(", ")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Column mapping table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Column Mapping</CardTitle>
          <CardDescription>
            Match each CSV column to a creator field. Sample data is shown for reference.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/4">CSV Column</TableHead>
                <TableHead className="w-12 text-center"></TableHead>
                <TableHead className="w-1/4">Maps To</TableHead>
                <TableHead>Sample Values</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {headers.map((header) => {
                const currentMapping = mapping[header];
                const availableFields = getAvailableFields(header);
                const sampleValues = sampleData
                  .slice(0, 3)
                  .map((row) => row[header])
                  .filter((v) => v && v.trim() !== "");

                return (
                  <TableRow key={header}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <code className="px-2 py-1 bg-muted rounded text-sm">
                          {header}
                        </code>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      <ArrowRight className="w-4 h-4 inline-block" />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={currentMapping || ""}
                        onValueChange={(value) => handleMappingChange(header, value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select field..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">
                            <span className="text-muted-foreground">-- Skip this column --</span>
                          </SelectItem>
                          {availableFields.map((field) => (
                            <SelectItem key={field.key} value={field.key}>
                              <div className="flex items-center gap-2">
                                <span>{field.label}</span>
                                {field.required && (
                                  <Badge variant="outline" className="text-xs py-0 px-1">
                                    Required
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {sampleValues.length > 0 ? (
                          sampleValues.map((value, i) => (
                            <code
                              key={i}
                              className="px-2 py-0.5 bg-muted rounded text-xs text-muted-foreground max-w-[150px] truncate"
                              title={value}
                            >
                              {value}
                            </code>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground italic">
                            No data
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Field descriptions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Field Descriptions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {CREATOR_FIELDS.map((field) => (
              <div key={field.key} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{field.label}</span>
                    {field.required && (
                      <Badge variant="outline" className="text-xs py-0">
                        Required
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {field.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
