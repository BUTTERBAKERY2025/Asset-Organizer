import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

interface ThemeToggleProps {
  variant?: "ghost" | "outline";
  size?: "sm" | "icon";
  className?: string;
}

export function ThemeToggle({ variant = "outline", size = "sm", className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && theme === "dark";
  const Icon = isDark ? Sun : Moon;

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={className}
      data-testid="button-theme-toggle"
      aria-label={isDark ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"}
      title={isDark ? "الوضع الفاتح" : "الوضع الداكن"}
    >
      <Icon className="w-4 h-4" />
      {size !== "icon" && <span className="ms-2 hidden sm:inline">{isDark ? "فاتح" : "داكن"}</span>}
    </Button>
  );
}
