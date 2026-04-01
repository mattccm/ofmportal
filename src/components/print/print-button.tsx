"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Printer, ChevronDown, FileText, Settings, Info } from "lucide-react";

interface PrintButtonProps extends Omit<ButtonProps, "onClick"> {
  /** Target element ID to print (optional - prints whole page if not specified) */
  targetId?: string;
  /** Document title for the print job */
  documentTitle?: string;
  /** Callback before print starts */
  onBeforePrint?: () => void;
  /** Callback after print completes or is cancelled */
  onAfterPrint?: () => void;
  /** Show dropdown with options */
  showOptions?: boolean;
  /** Custom print styles to inject */
  customStyles?: string;
  /** Show page setup hints dialog */
  showPageSetupHints?: boolean;
  /** Default button label */
  label?: string;
}

export function PrintButton({
  targetId,
  documentTitle,
  onBeforePrint,
  onAfterPrint,
  showOptions = false,
  customStyles,
  showPageSetupHints = false,
  label = "Print",
  className,
  variant = "outline",
  size = "default",
  ...props
}: PrintButtonProps) {
  const [showHintsDialog, setShowHintsDialog] = React.useState(false);

  const handlePrint = React.useCallback(() => {
    // Call before print callback
    onBeforePrint?.();

    // Set document title if provided
    const originalTitle = document.title;
    if (documentTitle) {
      document.title = documentTitle;
    }

    // Inject custom styles if provided
    let styleElement: HTMLStyleElement | null = null;
    if (customStyles) {
      styleElement = document.createElement("style");
      styleElement.id = "print-custom-styles";
      styleElement.textContent = customStyles;
      document.head.appendChild(styleElement);
    }

    // If targeting a specific element, add print-target class
    if (targetId) {
      const target = document.getElementById(targetId);
      if (target) {
        // Add class to hide everything except target
        document.body.classList.add("print-target-mode");
        target.classList.add("print-target");

        // Add style to hide non-target elements
        const targetStyle = document.createElement("style");
        targetStyle.id = "print-target-style";
        targetStyle.textContent = `
          @media print {
            body.print-target-mode > *:not(.print-target):not(script):not(style):not(link) {
              display: none !important;
            }
            body.print-target-mode .print-target {
              display: block !important;
              position: static !important;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 20pt !important;
            }
          }
        `;
        document.head.appendChild(targetStyle);
      }
    }

    // Trigger print
    window.print();

    // Cleanup after print
    const cleanup = () => {
      // Restore document title
      if (documentTitle) {
        document.title = originalTitle;
      }

      // Remove custom styles
      if (styleElement) {
        styleElement.remove();
      }

      // Remove target mode
      if (targetId) {
        document.body.classList.remove("print-target-mode");
        const target = document.getElementById(targetId);
        if (target) {
          target.classList.remove("print-target");
        }
        const targetStyle = document.getElementById("print-target-style");
        if (targetStyle) {
          targetStyle.remove();
        }
      }

      // Call after print callback
      onAfterPrint?.();
    };

    // Use matchMedia to detect when print dialog closes
    if (window.matchMedia) {
      const mediaQueryList = window.matchMedia("print");
      const handleChange = (e: MediaQueryListEvent) => {
        if (!e.matches) {
          cleanup();
          mediaQueryList.removeEventListener("change", handleChange);
        }
      };
      mediaQueryList.addEventListener("change", handleChange);
    } else {
      // Fallback - cleanup after a short delay
      setTimeout(cleanup, 1000);
    }
  }, [targetId, documentTitle, onBeforePrint, onAfterPrint, customStyles]);

  const handlePreview = React.useCallback(() => {
    // Open print dialog - browsers handle preview
    handlePrint();
  }, [handlePrint]);

  if (showOptions) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={variant}
              size={size}
              className={cn("print:hidden", className)}
              {...props}
            >
              <Printer className="mr-2 h-4 w-4" />
              {label}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print Now
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handlePreview}>
              <FileText className="mr-2 h-4 w-4" />
              Print Preview
            </DropdownMenuItem>
            {showPageSetupHints && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowHintsDialog(true)}>
                  <Info className="mr-2 h-4 w-4" />
                  Page Setup Tips
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <PageSetupHintsDialog
          open={showHintsDialog}
          onOpenChange={setShowHintsDialog}
        />
      </>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handlePrint}
      className={cn("print:hidden", className)}
      {...props}
    >
      <Printer className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}

interface PageSetupHintsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function PageSetupHintsDialog({ open, onOpenChange }: PageSetupHintsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Page Setup Tips
          </DialogTitle>
          <DialogDescription>
            For the best print results, follow these recommendations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Recommended Settings</h4>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="font-medium text-foreground">Paper Size:</span>
                A4 or Letter (8.5" x 11")
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium text-foreground">Orientation:</span>
                Portrait (use Landscape for reports with tables)
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium text-foreground">Margins:</span>
                Default or Normal (0.75" - 1")
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium text-foreground">Scale:</span>
                100% (Default)
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm">Enable These Options</h4>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-center gap-2">
                <div className="h-4 w-4 rounded border border-primary flex items-center justify-center">
                  <div className="h-2 w-2 rounded-sm bg-primary" />
                </div>
                Background graphics (for colors and badges)
              </li>
              <li className="flex items-center gap-2">
                <div className="h-4 w-4 rounded border border-primary flex items-center justify-center">
                  <div className="h-2 w-2 rounded-sm bg-primary" />
                </div>
                Headers and footers (if you want page numbers)
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm">Browser Tips</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>
                <span className="font-medium">Chrome/Edge:</span> Use "More settings" for all options
              </li>
              <li>
                <span className="font-medium">Firefox:</span> Check "Print backgrounds" in Page Setup
              </li>
              <li>
                <span className="font-medium">Safari:</span> Enable "Print backgrounds" in print dialog
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => { onOpenChange(false); window.print(); }}>
            <Printer className="mr-2 h-4 w-4" />
            Print Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Export individual components for flexibility
export { PageSetupHintsDialog };
