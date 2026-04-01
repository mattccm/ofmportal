"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { PrintButton } from "./print-button";
import { format } from "date-fns";

interface PrintableWrapperProps {
  children: React.ReactNode;
  /** Title for the printed document */
  title?: string;
  /** Subtitle or description */
  subtitle?: string;
  /** Show print button in the header */
  showPrintButton?: boolean;
  /** Print button props */
  printButtonProps?: {
    label?: string;
    showOptions?: boolean;
    showPageSetupHints?: boolean;
  };
  /** Header content (logo, agency name, etc.) */
  headerContent?: React.ReactNode;
  /** Footer content for printed pages */
  footerContent?: React.ReactNode;
  /** Show page numbers in footer */
  showPageNumbers?: boolean;
  /** Show print date in footer */
  showPrintDate?: boolean;
  /** Additional class names */
  className?: string;
  /** ID for targeting specific print area */
  id?: string;
  /** Layout orientation hint */
  orientation?: "portrait" | "landscape";
  /** Callback before print */
  onBeforePrint?: () => void;
  /** Callback after print */
  onAfterPrint?: () => void;
}

export function PrintableWrapper({
  children,
  title,
  subtitle,
  showPrintButton = true,
  printButtonProps,
  headerContent,
  footerContent,
  showPageNumbers = true,
  showPrintDate = true,
  className,
  id,
  orientation = "portrait",
  onBeforePrint,
  onAfterPrint,
}: PrintableWrapperProps) {
  const wrapperId = id || React.useId();
  const printDate = format(new Date(), "MMMM d, yyyy 'at' h:mm a");

  return (
    <div
      id={wrapperId}
      className={cn(
        "printable-wrapper",
        orientation === "landscape" && "print-landscape",
        className
      )}
    >
      {/* Screen Header - only visible on screen */}
      {(showPrintButton || title) && (
        <div className="flex items-center justify-between mb-6 print:hidden">
          <div>
            {title && (
              <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            )}
            {subtitle && (
              <p className="text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          {showPrintButton && (
            <PrintButton
              targetId={wrapperId}
              documentTitle={title}
              onBeforePrint={onBeforePrint}
              onAfterPrint={onAfterPrint}
              {...printButtonProps}
            />
          )}
        </div>
      )}

      {/* Print Header - only visible when printing */}
      <div className="print-header print-only hidden print:flex print:justify-between print:items-center print:mb-6 print:pb-4 print:border-b print:border-gray-300">
        <div>
          {headerContent || (
            <>
              {title && (
                <h1 className="text-xl font-bold text-foreground print:text-black">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="text-sm text-muted-foreground print:text-gray-600">
                  {subtitle}
                </p>
              )}
            </>
          )}
        </div>
        {showPrintDate && (
          <div className="text-xs text-muted-foreground print:text-gray-500">
            Printed: {printDate}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="print-content print:p-0">{children}</div>

      {/* Print Footer - only visible when printing */}
      <div className="print-footer print-only hidden print:block print:mt-8 print:pt-4 print:border-t print:border-gray-200 print:text-center print:text-xs print:text-gray-500">
        {footerContent || (
          <div className="flex justify-between items-center">
            <div>
              {showPrintDate && <span>Generated: {printDate}</span>}
            </div>
            {showPageNumbers && (
              <div className="page-number">
                {/* Page numbers are handled by @page CSS counter */}
              </div>
            )}
            <div>
              <span>UploadPortal</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Utility components for print layout control
interface PrintOnlyProps {
  children: React.ReactNode;
  className?: string;
}

export function PrintOnly({ children, className }: PrintOnlyProps) {
  return (
    <div className={cn("hidden print:block", className)}>
      {children}
    </div>
  );
}

interface ScreenOnlyProps {
  children: React.ReactNode;
  className?: string;
}

export function ScreenOnly({ children, className }: ScreenOnlyProps) {
  return (
    <div className={cn("print:hidden", className)}>
      {children}
    </div>
  );
}

interface PageBreakProps {
  type?: "before" | "after" | "avoid";
}

export function PageBreak({ type = "before" }: PageBreakProps) {
  const breakClass = {
    before: "print:break-before-page",
    after: "print:break-after-page",
    avoid: "print:break-inside-avoid",
  }[type];

  if (type === "avoid") {
    return null; // Use as a wrapper class instead
  }

  return <div className={cn("hidden print:block h-0", breakClass)} />;
}

interface PrintSectionProps {
  children: React.ReactNode;
  title?: string;
  avoidBreak?: boolean;
  breakBefore?: boolean;
  breakAfter?: boolean;
  className?: string;
}

export function PrintSection({
  children,
  title,
  avoidBreak = true,
  breakBefore = false,
  breakAfter = false,
  className,
}: PrintSectionProps) {
  return (
    <section
      className={cn(
        avoidBreak && "print:break-inside-avoid",
        breakBefore && "print:break-before-page",
        breakAfter && "print:break-after-page",
        className
      )}
    >
      {title && (
        <h2 className="text-lg font-semibold mb-3 border-b pb-2 print:text-base print:font-bold">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

interface PrintTableProps {
  headers: string[];
  rows: (string | number | React.ReactNode)[][];
  caption?: string;
  className?: string;
}

export function PrintTable({ headers, rows, caption, className }: PrintTableProps) {
  return (
    <div className={cn("print:break-inside-avoid", className)}>
      {caption && (
        <h3 className="text-sm font-medium mb-2 text-muted-foreground">
          {caption}
        </h3>
      )}
      <table className="w-full text-sm border-collapse print:text-xs">
        <thead>
          <tr className="bg-muted/50 print:bg-gray-100">
            {headers.map((header, index) => (
              <th
                key={index}
                className="text-left p-3 font-medium border-b print:border-gray-300 print:p-2"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="border-b print:border-gray-200"
            >
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="p-3 print:p-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface PrintMetricProps {
  label: string;
  value: string | number;
  description?: string;
  className?: string;
}

export function PrintMetric({ label, value, description, className }: PrintMetricProps) {
  return (
    <div
      className={cn(
        "p-4 border rounded-lg print:border-gray-300 print:p-3 print:break-inside-avoid",
        className
      )}
    >
      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1 print:text-gray-500">
        {label}
      </div>
      <div className="text-2xl font-bold text-foreground print:text-xl print:text-black">
        {value}
      </div>
      {description && (
        <div className="text-xs text-muted-foreground mt-1 print:text-gray-600">
          {description}
        </div>
      )}
    </div>
  );
}

interface PrintMetricsGridProps {
  metrics: PrintMetricProps[];
  columns?: 2 | 3 | 4;
  className?: string;
}

export function PrintMetricsGrid({
  metrics,
  columns = 4,
  className,
}: PrintMetricsGridProps) {
  const gridCols = {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-2 md:grid-cols-4",
  }[columns];

  return (
    <div
      className={cn(
        "grid gap-4 print:flex print:flex-wrap print:gap-4",
        gridCols,
        className
      )}
    >
      {metrics.map((metric, index) => (
        <PrintMetric
          key={index}
          {...metric}
          className="print:flex-1 print:min-w-[140px]"
        />
      ))}
    </div>
  );
}

// Export all components
export type { PrintableWrapperProps, PrintSectionProps, PrintTableProps, PrintMetricProps };
