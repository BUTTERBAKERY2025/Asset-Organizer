import type { LucideIcon } from "lucide-react";

export type SemanticColor = "money" | "production" | "people" | "inventory" | "projects" | "marketing" | "executive" | "system";

const backgrounds: Record<SemanticColor, string> = {
  money: "bg-emerald-500",
  production: "bg-blue-500",
  people: "bg-teal-500",
  inventory: "bg-amber-500",
  projects: "bg-orange-500",
  marketing: "bg-pink-500",
  executive: "bg-violet-500",
  system: "bg-slate-500",
};

/** The same icon tile is rendered on home and the branch board. */
export function PlatformAppIcon({ icon: Icon, color }: { icon: LucideIcon; color: SemanticColor }) {
  return <span className={`platform-app-icon flex items-center justify-center ${backgrounds[color]} shadow-sm group-hover:shadow-lg group-hover:-translate-y-1 transition-all duration-300 motion-reduce:transition-none motion-reduce:transform-none`}>
    <Icon className="w-8 h-8 text-white" aria-hidden="true" />
  </span>;
}