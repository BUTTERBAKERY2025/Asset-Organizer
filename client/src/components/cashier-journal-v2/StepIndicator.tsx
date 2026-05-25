import { STEPS } from "./constants";

interface StepIndicatorProps {
  activeStep: 1 | 2 | 3;
  onStepClick?: (step: 1 | 2 | 3) => void;
}

export function StepIndicator({ activeStep, onStepClick }: StepIndicatorProps) {
  return (
    <div
      className="flex items-center justify-between gap-1 overflow-x-auto rounded-xl bg-[#F1EFE8] px-3 py-3 sm:gap-2 sm:px-4"
      data-testid="step-indicator"
    >
      {STEPS.map((s, idx) => {
        const isActive = activeStep === s.id;
        const isDone = activeStep > s.id;
        return (
          <div key={s.id} className="flex flex-1 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => onStepClick?.(s.id as 1 | 2 | 3)}
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                isActive
                  ? "bg-[#534AB7] text-white"
                  : isDone
                  ? "bg-[#173404] text-white"
                  : "border border-gray-200 bg-white text-gray-500"
              }`}
              data-testid={`step-button-${s.id}`}
            >
              {s.id}
            </button>
            <span
              className={`whitespace-nowrap text-[11px] sm:text-xs ${
                isActive ? "font-medium text-[#26215C]" : "text-gray-600"
              } ${isActive ? "" : "hidden sm:inline"}`}
              data-testid={`step-label-${s.id}`}
            >
              {s.label}
            </span>
            {idx < STEPS.length - 1 && (
              <div className="h-px flex-1 bg-gray-300" />
            )}
          </div>
        );
      })}
    </div>
  );
}
