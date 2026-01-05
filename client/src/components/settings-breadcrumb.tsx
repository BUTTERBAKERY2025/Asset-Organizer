import { Link } from "wouter";
import { ChevronLeft, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SettingsBreadcrumbProps {
  currentPage: string;
  currentIcon?: React.ComponentType<{ className?: string }>;
}

export function SettingsBreadcrumb({ currentPage, currentIcon: CurrentIcon }: SettingsBreadcrumbProps) {
  return (
    <div className="flex items-center gap-2 mb-6 pb-4 border-b">
      <Link href="/settings">
        <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back-settings">
          <ChevronLeft className="w-4 h-4" />
          <Settings className="w-4 h-4" />
          <span>لوحة الإعدادات</span>
        </Button>
      </Link>
      <ChevronLeft className="w-4 h-4 text-muted-foreground" />
      <div className="flex items-center gap-2 text-primary font-medium">
        {CurrentIcon && <CurrentIcon className="w-4 h-4" />}
        <span>{currentPage}</span>
      </div>
    </div>
  );
}
