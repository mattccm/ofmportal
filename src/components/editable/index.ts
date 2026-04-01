// Inline editing components for UploadPortal
export { EditableText, type EditableTextProps } from "./editable-text";
export { EditableSelect, type EditableSelectProps, type SelectOption } from "./editable-select";
export {
  EditableBadge,
  type EditableBadgeProps,
  type BadgeOption,
  STATUS_BADGE_OPTIONS,
  PRIORITY_BADGE_OPTIONS,
} from "./editable-badge";
export { EditableDate, type EditableDateProps } from "./editable-date";

// Pre-configured editable fields for request/creator management
export {
  EditableRequestTitle,
  type EditableRequestTitleProps,
  EditableCreatorName,
  type EditableCreatorNameProps,
  EditableStatusBadge,
  type EditableStatusBadgeProps,
  EditablePriorityBadge,
  type EditablePriorityBadgeProps,
  EditableDueDate,
  type EditableDueDateProps,
} from "./editable-request-fields";
