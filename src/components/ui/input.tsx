import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex min-h-11 h-11 md:h-10 w-full min-w-0 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-3.5 py-2 text-base md:text-sm text-[var(--app-fg)] transition-all outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--app-fg)] placeholder:text-muted-foreground focus-visible:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30 shadow-xs",
        className
      )}
      {...props}
    />
  )
}

export { Input }
