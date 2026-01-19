"use client";
import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LucideIcon, Loader2 } from "lucide-react";

type ButtonVariant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "link";

interface ButtonInfo {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
}

interface ButtonGroupProps {
  buttons: ButtonInfo[];
  variant?: ButtonVariant;
  size?: "default" | "sm" | "lg";
  isOutline?: boolean;
  className?: string;
  orientation?: "horizontal" | "vertical";
  isToggle?: boolean;
  isPill?: boolean;
  color?: string;
}

const ButtonGroup = ({
  buttons,
  variant = "default",
  size = "default",
  isOutline = false,
  className,
  orientation = "horizontal",
  isToggle = false,
  isPill = false,
  color,
}: ButtonGroupProps) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(
    isToggle ? 0 : null
  );
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    buttonRefs.current = buttonRefs.current.slice(0, buttons.length);
  }, [buttons]);

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = (index + 1) % buttons.length;
      buttonRefs.current[nextIndex]?.focus();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      const prevIndex = (index - 1 + buttons.length) % buttons.length;
      buttonRefs.current[prevIndex]?.focus();
    }
  };

  return (
    <div
      className={cn(
        "inline-flex",
        orientation === "vertical" ? "flex-col" : "flex-row",
        isPill ? "rounded-full" : "rounded-md",
        "shadow-sm",
        className
      )}
      role="group"
      style={{ "--button-color": color } as React.CSSProperties}
    >
      {buttons.map((button, index) => {
        const Icon = button.icon;
        const isActive = activeIndex === index;
        return (
          <Button
            key={index}
            variant={isOutline ? "outline" : variant}
            size={size}
            onClick={() => {
              if (isToggle) {
                setActiveIndex(index);
              }
              button.onClick();
            }}
            disabled={button.disabled}
            className={cn(
              orientation === "horizontal"
                ? "first:rounded-l-md last:rounded-r-md rounded-none"
                : "first:rounded-t-md last:rounded-b-md rounded-none",
              index !== 0 && orientation === "horizontal" && "-ml-px",
              index !== 0 && orientation === "vertical" && "-mt-px",
              isOutline && orientation === "horizontal" && "border-r-[1px]",
              isOutline && orientation === "vertical" && "border-b-[1px]",
              //   isPill && 'first:rounded-l-full last:rounded-r-full',
              "first:rounded-l-[4px] last:rounded-r-[4px] text-zinc-600 dark:text-zinc-200",
              isActive && "bg-primary text-primary-foreground",
              "transition-colors hover:bg-primary/90 hover:text-primary-foreground",
              "focus:relative focus:z-10",
              color && `hover:bg-[var(--button-color)] hover:text-white`
            )}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            onKeyDown={(e) => handleKeyDown(e, index)}
            aria-pressed={isToggle ? isActive : undefined}
          >
            {button.loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              Icon && <Icon className="mr-2 h-4 w-4" />
            )}
            {button.label}
          </Button>
        );
      })}
    </div>
  );
};

export { ButtonGroup };
