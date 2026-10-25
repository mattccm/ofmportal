"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { useMergedRef, useWarnIfUnnamed } from "./dev-a11y";

/**
 * Title Wall buttons. One yellow fill per region (`default`, the primary action),
 * everything else is tone or outline. Every button gives under the finger
 * (scale 0.97) and shows the yellow focus ring from the keyboard.
 */
const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent",
    "text-sm font-semibold leading-none select-none touch-manipulation",
    "transition-[background-color,border-color,color,transform] duration-150 ease-out",
    "active:scale-[0.97] motion-reduce:active:scale-100",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "disabled:pointer-events-none disabled:border-line disabled:bg-transparent disabled:text-ink-2",
    "aria-disabled:pointer-events-none aria-disabled:border-line aria-disabled:bg-transparent aria-disabled:text-ink-2",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-']):not([class*='h-'])]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        /** The one primary action: yellow with dark ink */
        default: "bg-primary text-primary-foreground hover:bg-acc-hi",
        /** Destructive: a red tint, never a red slab */
        destructive:
          "border-late/35 bg-late/12 text-late hover:bg-late/20 hover:border-late/55",
        /** A bordered control on the ground or a tile */
        outline: "border-ctl bg-transparent text-foreground hover:border-ctl-hi hover:bg-tile-hi",
        /** Tile tone: a quiet filled action */
        secondary: "bg-tile-hi text-foreground hover:bg-raised",
        ghost: "text-foreground hover:bg-tile-hi",
        /** Light fill for a page-level create action (New request) when yellow is taken */
        light: "bg-ink text-ground hover:bg-white",
        link: "h-auto border-0 px-0 text-foreground underline decoration-ctl-hi underline-offset-[3px] hover:decoration-ink active:scale-100",
      },
      size: {
        default: "h-10 px-4 md:h-9 md:px-3.5",
        sm: "h-9 px-3 text-[13px] md:h-8",
        lg: "h-11 px-6 text-[15px]",
        icon: "size-10 md:size-9",
        "icon-sm": "size-9 md:size-8",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const innerRef = React.useRef<HTMLButtonElement>(null);
    const mergedRef = useMergedRef(innerRef, ref);
    // Icon-only sizes carry no text: warn in development when nothing names them.
    useWarnIfUnnamed(innerRef, `Button size="${size}"`, !!size?.startsWith("icon"));
    return (
      <Comp
        data-slot="button"
        data-variant={variant ?? "default"}
        className={cn(buttonVariants({ variant, size, className }))}
        ref={mergedRef}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
