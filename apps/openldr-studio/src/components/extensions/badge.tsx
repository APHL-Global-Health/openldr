import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium border leading-none",
  {
    variants: {
      variant: {
        default: "border-[#1e2232]",
        active: "bg-emerald-950/50 border-emerald-900/60 text-[#34d399]",
        error: "bg-red-950/50 border-red-900/60 text-[#f87171]",
        warning: "bg-amber-950/50 border-amber-900/60 text-[#f59e0b]",
        fetching: "bg-violet-950/50 border-violet-900/60 text-[#a78bfa]",
        teal: "bg-teal-950/50 border-teal-900/60 text-[#2dd4bf]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}
function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
export { Badge, badgeVariants };
