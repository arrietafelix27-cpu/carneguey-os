"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4 text-[var(--success)]" />
        ),
        info: (
          <InfoIcon className="size-4 text-white" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4 text-[var(--warning)]" />
        ),
        error: (
          <OctagonXIcon className="size-4 text-[var(--danger)]" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin text-white" />
        ),
      }}
      style={
        {
          "--normal-bg": "#1c1c1e",
          "--normal-text": "#ffffff",
          "--normal-border": "transparent",
          "--border-radius": "var(--radius-md)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
