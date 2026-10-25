"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

// The portal has one dark theme (owner decision, Oct 2026). This page used to
// offer light / dark / system; it now says so and shows what follows the system.
const SWATCHES = [
  { name: "Ground", value: "#0e0f12", note: "the page" },
  { name: "Tile", value: "#1b1d22", note: "cards and panels" },
  { name: "Accent", value: "#ffd23f", note: "the primary action and keyboard focus" },
  { name: "Approved", value: "#d3d7de", note: "field state" },
  { name: "Ready", value: "#6ea8ff", note: "field state" },
  { name: "Changes", value: "#ff7d6e", note: "field state" },
];

export default function AppearanceSettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="-ml-2 mt-0.5">
          <Link href="/dashboard/settings" aria-label="Back to settings">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight">Appearance</h1>
          <p className="mt-1 text-[15px] text-muted-foreground">
            CCM Portal uses one dark theme, built for long review sessions in dim rooms.
          </p>
        </div>
      </div>

      <section aria-labelledby="palette-h" className="rounded-lg bg-card p-5">
        <h2 id="palette-h" className="text-[17px] font-semibold">The palette</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Colour is kept for state and the one primary action on each screen.
        </p>
        <ul className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {SWATCHES.map((s) => (
            <li key={s.name} className="flex items-center gap-3">
              <span
                className="h-8 w-8 shrink-0 rounded-md border border-line"
                style={{ backgroundColor: s.value }}
                aria-hidden="true"
              />
              <span className="min-w-0 text-sm">
                <span className="font-medium">{s.name}</span>
                <span className="text-muted-foreground">, {s.note}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="system-h" className="rounded-lg bg-card p-5">
        <h2 id="system-h" className="text-[17px] font-semibold">What follows your device</h2>
        <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Reduced motion</dt>
          <dd>Animations drop their movement when your system asks for less motion.</dd>
          <dt className="text-muted-foreground">Contrast</dt>
          <dd>Lines and secondary text get stronger when your system asks for more contrast.</dd>
          <dt className="text-muted-foreground">Text size</dt>
          <dd>Browser zoom and text size settings are respected everywhere.</dd>
        </dl>
      </section>
    </div>
  );
}
