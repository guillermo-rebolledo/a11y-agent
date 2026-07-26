import type { HTMLAttributes } from "react";

import { cn } from "@a11y-agent/ui/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
