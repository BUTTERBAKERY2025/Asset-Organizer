import { cn } from "@/lib/utils";

interface RiyalProps {
  className?: string;
}

export function Riyal({ className }: RiyalProps) {
  return (
    <span
      className={cn("font-riyal inline-block leading-none align-middle", className)}
      aria-label="ريال سعودي"
    >
      
    </span>
  );
}
