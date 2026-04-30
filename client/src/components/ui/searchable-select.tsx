import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

export interface SearchableSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  disabled?: boolean;
}

interface SearchableSelectProps {
  value?: string | null;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  clearable?: boolean;
  onClear?: () => void;
  dataTestid?: string;
  popoverWidth?: string;
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "اختر...",
  searchPlaceholder = "ابحث...",
  emptyText = "لا توجد نتائج",
  disabled = false,
  className,
  triggerClassName,
  clearable = false,
  onClear,
  dataTestid,
  popoverWidth = "w-[--radix-popover-trigger-width]",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);

  const selectedOption = useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );

  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between text-right h-11 font-normal",
              !selectedOption && "text-muted-foreground",
              triggerClassName,
            )}
            data-testid={dataTestid}
          >
            <span className="flex items-center gap-2 flex-1 min-w-0 truncate">
              {selectedOption ? (
                <>
                  <span className="font-medium truncate">{selectedOption.label}</span>
                  {selectedOption.sublabel && (
                    <span className="text-xs text-muted-foreground truncate">
                      {selectedOption.sublabel}
                    </span>
                  )}
                  {selectedOption.badge && (
                    <Badge variant={selectedOption.badgeVariant || "secondary"} className="text-xs shrink-0">
                      {selectedOption.badge}
                    </Badge>
                  )}
                </>
              ) : (
                <span>{placeholder}</span>
              )}
            </span>
            <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className={cn("p-0", popoverWidth)} align="start">
          <Command
            filter={(value, search) => {
              // Search both label and sublabel; value is "label sublabel" string
              return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
            }}
          >
            <CommandInput placeholder={searchPlaceholder} className="h-11" />
            <CommandList className="max-h-[300px] overflow-y-auto">
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={`${opt.label} ${opt.sublabel || ""} ${opt.badge || ""}`}
                    disabled={opt.disabled}
                    onSelect={() => {
                      onValueChange(opt.value);
                      setOpen(false);
                    }}
                    className="cursor-pointer min-h-[44px]"
                    data-testid={dataTestid ? `${dataTestid}-option-${opt.value}` : undefined}
                  >
                    <Check
                      className={cn(
                        "ms-auto h-4 w-4",
                        value === opt.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="font-medium truncate">{opt.label}</span>
                      {opt.sublabel && (
                        <span className="text-xs text-muted-foreground truncate">
                          {opt.sublabel}
                        </span>
                      )}
                      {opt.badge && (
                        <Badge variant={opt.badgeVariant || "secondary"} className="text-xs shrink-0 ms-auto">
                          {opt.badge}
                        </Badge>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {clearable && selectedOption && !disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear?.();
          }}
          className="absolute top-1/2 -translate-y-1/2 end-9 h-6 w-6 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground"
          aria-label="مسح الاختيار"
          data-testid={dataTestid ? `${dataTestid}-clear` : undefined}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
