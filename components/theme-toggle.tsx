"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {/* Driven by the `dark` class rather than state, so the correct icon
              renders on the server pass and there is nothing to reconcile. */}
          <Sun className="hidden size-4 dark:block" />
          <Moon className="size-4 dark:hidden" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <span className="hidden dark:inline">Light mode</span>
        <span className="dark:hidden">Dark mode</span>
      </TooltipContent>
    </Tooltip>
  );
}
