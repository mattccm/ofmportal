/**
 * The Title Wall: shared presentation components for CCM Portal.
 * Typed props only; pages fetch and map their own data.
 * Usage notes: .impeccable/build/FOUNDATION.md
 */
export { TitleCard, type TitleCardProps } from "./title-card";
export {
  FieldCell,
  FieldStrip,
  StateIcon,
  StateWord,
  type FieldCellProps,
  type FieldStripProps,
  type StateIconProps,
  type StateWordProps,
} from "./field-strip";
export { StatePill, StateLegend, type StatePillProps, type StateLegendProps } from "./state-legend";
export { Shelf, Wall, type ShelfProps, type WallProps } from "./shelf";
export { Billboard, type BillboardProps } from "./billboard";
export { Countdown, type CountdownProps } from "./countdown";
export { DiscreetPreview, type DiscreetPreviewProps } from "./discreet-preview";
export {
  FIELD_STATE_LABEL,
  FIELD_STATE_SHORT,
  CREATOR_FIELD_STATE_LABEL,
  CREATOR_FIELD_STATE_SHORT,
  FIELD_STATE_ICON,
  FIELD_STATE_TEXT,
  FIELD_STATE_ORDER,
  UNSENT_LABEL,
  UNSENT_SHORT,
  UNSENT_ICON,
  stateLabel,
  stateShort,
  fieldStateLabel,
  fieldStateShort,
  isUnsent,
  requestStatusState,
  uploadStatusState,
  fieldSummary,
  stripLabel,
  type FieldState,
  type FieldSummary,
  type StateAudience,
} from "./types";
export { timeLeft, toDueDate, formatDay, formatDue, formatDueOn, formatDueDay, formatStamp, type TimeLeft } from "./time";
export { ViewerTimeZoneProvider, useViewerTimeZone } from "./viewer-time";
export {
  ensureMotion,
  isReducedMotion,
  useReducedMotion,
  usePressFeedback,
  useFocusWall,
  useFlipLayout,
  usePeek,
  flipLayout,
  fillCell,
  arrive,
  swapIn,
  rollNumber,
  upNextCountdown,
  EASE,
  DUR,
  type FocusWallOptions,
} from "./motion";
