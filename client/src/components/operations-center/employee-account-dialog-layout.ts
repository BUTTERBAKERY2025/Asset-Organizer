import { useVisualViewportDialog } from "@/components/central-kitchen/use-visual-viewport-dialog";

/** One scroll region, with context and explicit actions outside it. */
export const employeeDialogShell = "flex min-h-0 flex-col gap-0 overflow-hidden rounded-xl p-0 sm:p-0 [&>button]:right-3 [&>button]:top-3 [&>button]:flex [&>button]:min-h-11 [&>button]:min-w-11 [&>button]:items-center [&>button]:justify-center";
export const employeeDialogHeader = "shrink-0 border-b py-3 pl-4 pr-16 text-right sm:pl-6";
export const employeeDialogBody = "min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3 sm:px-6";
export const employeeDialogFooter = "shrink-0 flex-row flex-wrap gap-2 border-t bg-background px-4 py-3 sm:gap-2 sm:px-6 sm:space-x-0";

export function useEmployeeAccountDialogLayout(maxHeight = 800) {
  // The existing viewport hook is browser-only. Node renderers/SSR retain the
  // CSS fallback; real dialogs track keyboard resize and viewport pan events.
  return useVisualViewportDialog({
    open: typeof window !== "undefined" && typeof window.addEventListener === "function",
    maxHeight,
    viewportFraction: 0.94,
  });
}