import * as React from "react"

import { cn } from "@/lib/utils"

function Avatar({
  className,
  children,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold text-muted-foreground select-none",
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}

export { Avatar }
