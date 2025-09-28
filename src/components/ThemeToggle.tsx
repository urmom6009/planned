"use client";

import * as React from "react";
import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Laptop },
] as const;

type Option = (typeof OPTIONS)[number];

export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const active = mounted ? theme ?? "system" : "system";

  if (!mounted) {
    return (
      <div
        className={cn(
          "h-8 w-[6.5rem] animate-pulse rounded-full bg-slate-200/70 dark:bg-slate-700/40",
          className,
        )}
        aria-hidden
      />
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full border border-slate-200 bg-white/70 p-1 shadow-sm backdrop-blur supports-[backdrop-filter]:backdrop-blur transition-colors dark:border-slate-700 dark:bg-slate-800/80",
        className,
      )}
      role="radiogroup"
      aria-label="Theme"
    >
      {OPTIONS.map((option: Option) => {
        const isActive =
          active === option.value ||
          (option.value === "system" && active === "system");
        return (
          <Button
            key={option.value}
            type="button"
            variant="ghost"
            size="icon"
            role="radio"
            aria-label={option.label}
            aria-checked={isActive}
            onClick={() => setTheme(option.value)}
            className={cn(
              "h-8 w-8 rounded-full text-slate-600 transition-colors dark:text-slate-300",
              isActive
                ? "bg-slate-200 text-slate-900 shadow dark:bg-slate-600 dark:text-white"
                : "hover:bg-slate-100 dark:hover:bg-slate-700/70",
            )}
          >
            <option.icon className="size-4" />
          </Button>
        );
      })}
    </div>
  );
}
