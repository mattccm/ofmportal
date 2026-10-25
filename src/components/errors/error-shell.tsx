"use client";

import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

// Support address for error pages; nothing renders when it is unset
const ENV_SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || null;

export interface ErrorShellAction {
  label: string;
  /** Navigate with a link (takes precedence over onClick) */
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
}

export interface ErrorShellProps {
  title: string;
  message: ReactNode;
  primaryAction?: ErrorShellAction;
  secondaryAction?: ErrorShellAction;
  /** Extra actions under the main pair (e.g. a second home link) */
  extraActions?: ErrorShellAction[];
  /** Small status line above the title, e.g. "404" */
  eyebrow?: string;
  /** Error digest shown as a reference ID */
  digest?: string;
  /**
   * Overrides the support address (e.g. the agency's own contact on creator
   * pages). Falls back to NEXT_PUBLIC_SUPPORT_EMAIL; renders nothing if neither is set.
   */
  supportEmail?: string | null;
  /** Fill the viewport (top-level pages) instead of sitting inside a layout */
  fullScreen?: boolean;
  children?: ReactNode;
}

function ActionButton({
  action,
  variant,
  className,
}: {
  action: ErrorShellAction;
  variant: "default" | "outline" | "ghost";
  className?: string;
}) {
  const Icon = action.icon;
  const content = (
    <>
      {Icon && <Icon className="h-4 w-4 mr-2" aria-hidden="true" />}
      {action.label}
    </>
  );

  if (action.href) {
    return (
      <Button asChild variant={variant} className={className}>
        <Link href={action.href}>{content}</Link>
      </Button>
    );
  }
  return (
    <Button type="button" variant={variant} onClick={action.onClick} className={className}>
      {content}
    </Button>
  );
}

/**
 * Branded error / not-found card shared by every error boundary in the app.
 * Uses design tokens only (the one dark Title Wall theme).
 */
export function ErrorShell({
  title,
  message,
  primaryAction,
  secondaryAction,
  extraActions,
  eyebrow,
  digest,
  supportEmail,
  fullScreen = false,
  children,
}: ErrorShellProps) {
  const support = supportEmail?.trim() || ENV_SUPPORT_EMAIL;

  return (
    <div
      className={cn(
        "flex w-full items-center justify-center px-4 py-8",
        fullScreen ? "min-h-[100dvh] bg-background" : "min-h-[60vh]"
      )}
    >
      <div className="w-full max-w-md">
        <Card className="overflow-hidden border-0 pt-0">
          <CardHeader className="pt-7 text-left">
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-md border border-ink">
              <Image
                src={BRAND.logoPath}
                alt={BRAND.name}
                width={28}
                height={28}
                className="h-7 w-7 object-contain invert"
              />
            </div>
            <CardTitle className="text-[22px] font-bold leading-tight">{title}</CardTitle>
            <CardDescription className="mt-1 max-w-sm text-[15px] leading-normal">{message}</CardDescription>
            {/* the status (e.g. "404") reads after the heading, never above it */}
            {eyebrow && <p className="mt-1 text-[13px] text-muted-foreground">{eyebrow}</p>}
            {digest && (
              <p className="mt-2 break-all font-mono text-xs text-muted-foreground">Error ID: {digest}</p>
            )}
          </CardHeader>

          {children && <CardContent>{children}</CardContent>}

          {(primaryAction || secondaryAction || extraActions?.length) && (
            <CardFooter className="flex flex-col gap-3 border-t-0 bg-transparent">
              {(primaryAction || secondaryAction) && (
                <div className="flex w-full flex-col gap-3 sm:flex-row">
                  {primaryAction && (
                    <ActionButton action={primaryAction} variant="default" className="flex-1" />
                  )}
                  {secondaryAction && (
                    <ActionButton action={secondaryAction} variant="outline" className="flex-1" />
                  )}
                </div>
              )}
              {extraActions?.map((action) => (
                <ActionButton
                  key={action.label}
                  action={action}
                  variant="ghost"
                  className="w-full text-muted-foreground"
                />
              ))}
            </CardFooter>
          )}
        </Card>

        {support && (
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Still stuck? Email{" "}
            <a href={`mailto:${support}`} className="text-foreground underline decoration-ctl-hi underline-offset-3 hover:decoration-ink">
              {support}
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
