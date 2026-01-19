import React, { Fragment } from "react";
// import { Label } from "@/components/ui/label";
import { FieldWrapperProps } from "@/lib/autoform/react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

// const DISABLED_LABELS = ["boolean", "object", "array"];

export const FieldWrapper: React.FC<FieldWrapperProps> = ({
  label,
  children,
  id,
  field,
  error,
}) => {
  // const isDisabled = DISABLED_LABELS.includes(field.type);

  return (
    <Fragment key={`${id}_form_item`}>
      <div
        key={`${id}_info`}
        className={`flex items-center justify-center whitespace-nowrap col-start-1`}
      >
        {error ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <CircleAlert
                size={16}
                strokeWidth={1}
                className={cn(error ? "text-red-500" : "text-foreground")}
              />
            </TooltipTrigger>
            <TooltipContent className="cursor-default">{error}</TooltipContent>
          </Tooltip>
        ) : (
          <CircleAlert
            size={16}
            strokeWidth={1}
            className={cn(error ? "text-red-500" : "text-foreground")}
          />
        )}
      </div>
      <label className="col-start-2 flex gap-x-1 ml-1 mr-4 items-center text-xs">
        {label}
        {field.required && <span className="text-destructive"> *</span>}
      </label>
      <div className="col-start-3 flex flex-1 w-[100%]">{children}</div>
    </Fragment>
    // <div className="space-y-2">
    //   {!isDisabled && (
    //     <Label htmlFor={id}>
    //       {label}
    //       {field.required && <span className="text-destructive"> *</span>}
    //     </Label>
    //   )}
    //   {children}
    //   {field.fieldConfig?.description && (
    //     <p className="text-sm text-muted-foreground">
    //       {field.fieldConfig.description}
    //     </p>
    //   )}
    //   {error && <p className="text-sm text-destructive">{error}</p>}
    // </div>
  );
};
