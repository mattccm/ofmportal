"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Copy,
  Loader2,
  Calendar,
  User,
  FileText,
  Check,
  X,
  ChevronRight,
  Eye,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";

interface Creator {
  id: string;
  name: string;
  email: string;
}

interface TemplateField {
  id: string;
  label: string;
  value: string;
  type: string;
  required: boolean;
}

interface Request {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  urgency: string;
  status: string;
  fields: TemplateField[] | null;
  requirements: Record<string, string> | null;
  creator: Creator;
  template: {
    id: string;
    name: string;
  } | null;
}

interface CloneRequestDialogProps {
  request: Request;
  creators: Creator[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloneSuccess?: (clonedRequests: string[]) => void;
}

type CloneStep = "select" | "configure" | "preview";

export function CloneRequestDialog({
  request,
  creators,
  open,
  onOpenChange,
  onCloneSuccess,
}: CloneRequestDialogProps) {
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<CloneStep>("select");

  // Selection state
  const [selectedCreatorIds, setSelectedCreatorIds] = useState<string[]>([
    request.creator.id,
  ]);
  const [cloneToSameCreator, setCloneToSameCreator] = useState(true);

  // Configuration state
  const [modifiedTitle, setModifiedTitle] = useState(request.title);
  const [modifiedDueDate, setModifiedDueDate] = useState(
    request.dueDate
      ? format(new Date(request.dueDate), "yyyy-MM-dd")
      : ""
  );
  const [dueDateOffset, setDueDateOffset] = useState<number>(0);
  const [useDueDateOffset, setUseDueDateOffset] = useState(false);
  const [modifiedUrgency, setModifiedUrgency] = useState(request.urgency);
  const [modifiedFields, setModifiedFields] = useState<TemplateField[]>(
    request.fields || []
  );
  const [sendNotification, setSendNotification] = useState(true);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentStep("select");
      setSelectedCreatorIds([request.creator.id]);
      setCloneToSameCreator(true);
      setModifiedTitle(request.title);
      setModifiedDueDate(
        request.dueDate
          ? format(new Date(request.dueDate), "yyyy-MM-dd")
          : ""
      );
      setDueDateOffset(0);
      setUseDueDateOffset(false);
      setModifiedUrgency(request.urgency);
      setModifiedFields(request.fields || []);
      setSendNotification(true);
    }
  }, [open, request]);

  // Update selected creators based on clone to same creator toggle
  useEffect(() => {
    if (cloneToSameCreator) {
      setSelectedCreatorIds([request.creator.id]);
    } else {
      setSelectedCreatorIds([]);
    }
  }, [cloneToSameCreator, request.creator.id]);

  const toggleCreatorSelection = (creatorId: string) => {
    setSelectedCreatorIds((prev) =>
      prev.includes(creatorId)
        ? prev.filter((id) => id !== creatorId)
        : [...prev, creatorId]
    );
  };

  const handleFieldChange = (fieldId: string, value: string) => {
    setModifiedFields((prev) =>
      prev.map((field) =>
        field.id === fieldId ? { ...field, value } : field
      )
    );
  };

  const calculateDueDate = (creatorIndex: number): string | null => {
    if (!modifiedDueDate && !useDueDateOffset) return null;

    if (useDueDateOffset) {
      // Apply offset for each additional creator
      const baseDate = modifiedDueDate
        ? new Date(modifiedDueDate)
        : new Date();
      const offsetDays = dueDateOffset * creatorIndex;
      return addDays(baseDate, offsetDays).toISOString();
    }

    return new Date(modifiedDueDate).toISOString();
  };

  const handleClone = async () => {
    if (selectedCreatorIds.length === 0) {
      toast.error("Please select at least one creator");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/requests/${request.id}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetCreatorIds: selectedCreatorIds,
          modifications: {
            title: modifiedTitle,
            dueDate: useDueDateOffset ? null : modifiedDueDate || null,
            dueDateOffset: useDueDateOffset ? dueDateOffset : null,
            urgency: modifiedUrgency,
            fields: modifiedFields,
          },
          sendNotification,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to clone request");
      }

      toast.success(
        `Successfully cloned request to ${data.clonedRequests.length} creator(s)`
      );

      onOpenChange(false);
      onCloneSuccess?.(data.clonedRequests);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clone request");
    } finally {
      setLoading(false);
    }
  };

  const getStepNumber = (step: CloneStep): number => {
    switch (step) {
      case "select":
        return 1;
      case "configure":
        return 2;
      case "preview":
        return 3;
    }
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case "select":
        return selectedCreatorIds.length > 0;
      case "configure":
        return modifiedTitle.trim().length > 0;
      case "preview":
        return true;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5 text-indigo-600" />
            Clone Request
          </DialogTitle>
          <DialogDescription>
            Create copies of this request for the same or different creators.
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 py-4">
          {(["select", "configure", "preview"] as CloneStep[]).map(
            (step, index) => (
              <div key={step} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                    currentStep === step
                      ? "bg-indigo-600 text-white"
                      : getStepNumber(currentStep) > getStepNumber(step)
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {getStepNumber(currentStep) > getStepNumber(step) ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={`ml-2 text-sm hidden sm:inline ${
                    currentStep === step
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {step === "select" && "Select Creators"}
                  {step === "configure" && "Configure"}
                  {step === "preview" && "Preview"}
                </span>
                {index < 2 && (
                  <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground" />
                )}
              </div>
            )
          )}
        </div>

        <Separator />

        {/* Step Content */}
        <div className="py-4">
          {/* Step 1: Select Creators */}
          {currentStep === "select" && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="clone-same-creator"
                  checked={cloneToSameCreator}
                  onCheckedChange={(checked) =>
                    setCloneToSameCreator(checked as boolean)
                  }
                />
                <Label htmlFor="clone-same-creator" className="font-normal">
                  Clone to same creator ({request.creator.name})
                </Label>
              </div>

              {!cloneToSameCreator && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    Select target creators
                  </Label>
                  <div className="grid gap-2 max-h-64 overflow-y-auto border rounded-lg p-2">
                    {creators.map((creator) => {
                      const isSelected = selectedCreatorIds.includes(
                        creator.id
                      );
                      return (
                        <div
                          key={creator.id}
                          className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-indigo-50 border-indigo-200 border dark:bg-indigo-900/20 dark:border-indigo-800"
                              : "bg-muted/50 hover:bg-muted border border-transparent"
                          }`}
                          onClick={() => toggleCreatorSelection(creator.id)}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() =>
                              toggleCreatorSelection(creator.id)
                            }
                          />
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-xs">
                              {creator.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {creator.name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {creator.email}
                            </p>
                          </div>
                          {creator.id === request.creator.id && (
                            <Badge variant="outline" className="text-xs">
                              Original
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedCreatorIds.length} creator(s) selected
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Configure */}
          {currentStep === "configure" && (
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="fields">
                  Template Fields
                  {modifiedFields.length > 0 && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {modifiedFields.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="clone-title">Title</Label>
                  <Input
                    id="clone-title"
                    value={modifiedTitle}
                    onChange={(e) => setModifiedTitle(e.target.value)}
                    placeholder="Request title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clone-urgency">Priority</Label>
                  <Select
                    value={modifiedUrgency}
                    onValueChange={setModifiedUrgency}
                  >
                    <SelectTrigger id="clone-urgency">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="NORMAL">Normal</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="URGENT">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clone-due-date">Due Date</Label>
                  <Input
                    id="clone-due-date"
                    type="date"
                    value={modifiedDueDate}
                    onChange={(e) => setModifiedDueDate(e.target.value)}
                  />
                </div>

                {selectedCreatorIds.length > 1 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="use-offset"
                        checked={useDueDateOffset}
                        onCheckedChange={(checked) =>
                          setUseDueDateOffset(checked as boolean)
                        }
                      />
                      <Label htmlFor="use-offset" className="font-normal">
                        Stagger due dates for each creator
                      </Label>
                    </div>
                    {useDueDateOffset && (
                      <div className="ml-6 space-y-2">
                        <Label htmlFor="due-date-offset" className="text-sm">
                          Days between each creator&apos;s due date
                        </Label>
                        <Input
                          id="due-date-offset"
                          type="number"
                          min="0"
                          value={dueDateOffset}
                          onChange={(e) =>
                            setDueDateOffset(parseInt(e.target.value) || 0)
                          }
                          className="w-24"
                        />
                        <p className="text-xs text-muted-foreground">
                          Each subsequent creator will have their due date
                          offset by this many days.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="send-notification"
                    checked={sendNotification}
                    onCheckedChange={(checked) =>
                      setSendNotification(checked as boolean)
                    }
                  />
                  <Label htmlFor="send-notification" className="font-normal">
                    Send notification to creator(s)
                  </Label>
                </div>
              </TabsContent>

              <TabsContent value="fields" className="space-y-4 mt-4">
                {modifiedFields.length > 0 ? (
                  <div className="space-y-3">
                    {modifiedFields.map((field) => (
                      <div key={field.id} className="space-y-2">
                        <Label htmlFor={`field-${field.id}`}>
                          {field.label}
                          {field.required && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </Label>
                        <Input
                          id={`field-${field.id}`}
                          value={field.value}
                          onChange={(e) =>
                            handleFieldChange(field.id, e.target.value)
                          }
                          placeholder={`Enter ${field.label.toLowerCase()}`}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No template fields to modify</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}

          {/* Step 3: Preview */}
          {currentStep === "preview" && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground mb-4">
                Review the clone configuration before proceeding.
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Clone Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Title</span>
                      <span className="font-medium">{modifiedTitle}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Priority</span>
                      <Badge
                        variant="outline"
                        className={
                          modifiedUrgency === "URGENT"
                            ? "bg-red-100 text-red-700 border-red-200"
                            : modifiedUrgency === "HIGH"
                            ? "bg-orange-100 text-orange-700 border-orange-200"
                            : ""
                        }
                      >
                        {modifiedUrgency}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {useDueDateOffset ? "Base Due Date" : "Due Date"}
                      </span>
                      <span>
                        {modifiedDueDate
                          ? format(new Date(modifiedDueDate), "MMM d, yyyy")
                          : "Not set"}
                      </span>
                    </div>
                    {useDueDateOffset && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Date Offset
                        </span>
                        <span>+{dueDateOffset} days per creator</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Send Notifications
                      </span>
                      <span>{sendNotification ? "Yes" : "No"}</span>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        Target Creators ({selectedCreatorIds.length})
                      </span>
                    </div>
                    <div className="space-y-2">
                      {selectedCreatorIds.map((creatorId, index) => {
                        const creator = creators.find(
                          (c) => c.id === creatorId
                        );
                        if (!creator) return null;
                        const dueDate = calculateDueDate(index);
                        return (
                          <div
                            key={creatorId}
                            className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                          >
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-xs">
                                  {creator.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{creator.name}</span>
                            </div>
                            {dueDate && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(dueDate), "MMM d, yyyy")}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {modifiedFields.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            Template Fields
                          </span>
                        </div>
                        <div className="space-y-1 text-sm">
                          {modifiedFields.map((field) => (
                            <div
                              key={field.id}
                              className="flex justify-between"
                            >
                              <span className="text-muted-foreground">
                                {field.label}
                              </span>
                              <span>{field.value || "—"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="border-indigo-200 bg-indigo-50/50 dark:bg-indigo-900/10 dark:border-indigo-800">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                      <Copy className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="text-sm">
                      <p className="font-medium text-indigo-900 dark:text-indigo-300">
                        {selectedCreatorIds.length} request(s) will be created
                      </p>
                      <p className="text-indigo-700 dark:text-indigo-400 mt-1">
                        Each cloned request will be linked to the original for
                        tracking purposes.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {currentStep !== "select" && (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setCurrentStep(
                  currentStep === "configure" ? "select" : "configure"
                )
              }
              disabled={loading}
            >
              Back
            </Button>
          )}

          <div className="flex gap-2 ml-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>

            {currentStep !== "preview" ? (
              <Button
                type="button"
                onClick={() =>
                  setCurrentStep(
                    currentStep === "select" ? "configure" : "preview"
                  )
                }
                disabled={!canProceed()}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {currentStep === "select" && (
                  <>
                    Configure
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </>
                )}
                {currentStep === "configure" && (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    Preview
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleClone}
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cloning...
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Clone Request{selectedCreatorIds.length > 1 ? "s" : ""}
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
