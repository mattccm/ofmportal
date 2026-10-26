"use client";

import { createContext, useContext, type ReactNode } from "react";
import { FALLBACK_TIMEZONE } from "./time";

const ViewerTimeZone = createContext<string>(FALLBACK_TIMEZONE);

/**
 * The viewer's timezone for every moment on the wall (sent, uploaded,
 * messages). Staff: User.timezone, given by the server layout so the server
 * render and the browser print the same text. Creators: Creator.timezone.
 * Due DATES never use it: they print the request's dueOn day as is.
 */
export function ViewerTimeZoneProvider({ value, children }: { value: string; children: ReactNode }) {
  return <ViewerTimeZone.Provider value={value || FALLBACK_TIMEZONE}>{children}</ViewerTimeZone.Provider>;
}

export function useViewerTimeZone(): string {
  return useContext(ViewerTimeZone);
}
