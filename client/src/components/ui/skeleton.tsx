import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("skeleton-pro rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
