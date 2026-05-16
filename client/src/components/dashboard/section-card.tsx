import { type LucideIcon, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface SectionCardMenuItem {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
}

interface SectionCardProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  menuItems?: SectionCardMenuItem[];
  className?: string;
  bodyClassName?: string;
  noPadding?: boolean;
  children: React.ReactNode;
  "data-testid"?: string;
}

export function SectionCard({
  title,
  description,
  icon: Icon,
  actions,
  menuItems,
  className,
  bodyClassName,
  noPadding,
  children,
  ...rest
}: SectionCardProps) {
  const hasHeader = title || description || actions || Icon || (menuItems && menuItems.length > 0);

  return (
    <section
      className={cn(
        "rounded-2xl border border-gray-100 dark:border-border bg-white dark:bg-card overflow-hidden",
        className,
      )}
      data-testid={rest["data-testid"] ?? "section-card"}
    >
      {hasHeader && (
        <header className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-gray-50 dark:border-border/50">
          <div className="flex items-center gap-2 min-w-0">
            {Icon && <Icon className="w-4 h-4 text-gray-500 dark:text-muted-foreground shrink-0" />}
            <div className="min-w-0">
              {title && (
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-foreground truncate">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-xs text-gray-500 dark:text-muted-foreground truncate">{description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {actions}
            {menuItems && menuItems.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 hover:text-gray-700 dark:hover:text-foreground"
                    aria-label="more"
                    data-testid="section-card-menu"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {menuItems.map((item, i) => {
                    const ItemIcon = item.icon;
                    return (
                      <DropdownMenuItem key={i} onClick={item.onClick} className="gap-2">
                        {ItemIcon && <ItemIcon className="w-4 h-4" />}
                        {item.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>
      )}
      <div className={cn(!noPadding && "p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
