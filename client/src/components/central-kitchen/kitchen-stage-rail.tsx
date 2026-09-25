import {
  Archive,
  ClipboardList,
  FileClock,
  ListFilter,
  PackageCheck,
  Truck,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type KitchenStage = "attention" | "requested" | "approved" | "prepared" | "dispatched" | "archive" | "all";

type KitchenStageRailProps = {
  stage: KitchenStage;
  counts: Record<KitchenStage, number>;
  onStageChange: (stage: KitchenStage) => void;
  className?: string;
};

type StageDefinition = {
  key: KitchenStage;
  label: string;
  icon: LucideIcon;
};

const stages: StageDefinition[] = [
  { key: "attention", label: "يتطلب تدخلاً", icon: TriangleAlert },
  { key: "requested", label: "طلبات جديدة", icon: FileClock },
  { key: "approved", label: "قيد التجهيز", icon: ClipboardList },
  { key: "prepared", label: "جاهز للإرسال", icon: PackageCheck },
  { key: "dispatched", label: "في الطريق", icon: Truck },
  { key: "archive", label: "السجل", icon: Archive },
  { key: "all", label: "الكل", icon: ListFilter },
];

export function KitchenStageRail({ stage, counts, onStageChange, className }: KitchenStageRailProps) {
  return (
    <nav className={cn("kitchen-stage-rail", className)} aria-label="مراحل الطلبات">
      <div className="kitchen-stage-rail__scroller">
        <div className="kitchen-stage-rail__track">
          {stages.map(({ key, label, icon: Icon }) => {
            const isActive = stage === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onStageChange(key)}
                aria-current={isActive ? "page" : undefined}
                className="kitchen-stage-rail__item"
                data-active={isActive}
                data-stage={key}
              >
                <Icon className="kitchen-stage-rail__icon" aria-hidden="true" />
                <span className="kitchen-stage-rail__label">{label}</span>
                <span className="kitchen-stage-rail__count" aria-label={`${counts[key]} طلب`}>
                  {counts[key]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}