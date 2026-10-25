"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {

  return (
    <Sonner
      theme="dark"
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4 text-acc" />
        ),
        error: (
          <OctagonXIcon className="size-4 text-late" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--tw-raised)",
          "--normal-text": "var(--tw-ink)",
          "--normal-border": "var(--tw-ctl)",
          "--success-bg": "var(--tw-raised)",
          "--success-text": "var(--tw-ink)",
          "--success-border": "var(--tw-ctl)",
          "--error-bg": "var(--tw-raised)",
          "--error-text": "var(--tw-ink)",
          "--error-border": "color-mix(in srgb, var(--tw-late) 45%, var(--tw-ctl))",
          "--border-radius": "10px",
          "--width": "380px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast !font-sans !text-sm !font-medium !shadow-lg",
          description: "!text-ink-2",
          actionButton: "!bg-transparent !text-acc !font-semibold hover:!bg-raised-hi",
          cancelButton: "!bg-transparent !text-ink-2 hover:!bg-raised-hi",
          icon: "!text-ink",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
