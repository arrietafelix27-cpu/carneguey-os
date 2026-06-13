import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-[var(--radius-md)] border-[1.5px] border-transparent bg-secondary px-4 py-3 text-[15px] text-foreground transition-[color,background-color,border-color] outline-none placeholder:text-text-tertiary focus-visible:border-primary focus-visible:bg-card disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
