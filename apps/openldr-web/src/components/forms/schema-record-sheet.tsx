import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/sheet";
import SchemaRecordForm from "./schema-record-form";

import { ListRestart, Save, Trash2, CircleAlert, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@radix-ui/react-dropdown-menu";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@radix-ui/react-tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ErrorBoundary from "../error-boundary";
import { useKeycloakClient } from "@/components/react-keycloak-provider";
import { AutoFormProvider } from "@/components/autoform-provider";

export type SubmitHandler<T> = (
  data: T,
  event?: React.BaseSyntheticEvent
) => unknown | Promise<unknown>;

const SchemaRecordSheet = ({
  isOpen,
  data,
  value,
  onOpenChange,
  setOpen,
  showButtons = true,

  onSubmit = () => {},
  onCleared,
  onDelete,
}: {
  data: any;
  isOpen: boolean;
  showButtons?: boolean;
  value: any | undefined;
  onOpenChange: (value: boolean) => void;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;

  onSubmit?: SubmitHandler<{ [x: string]: any }> | undefined;
  onCleared?: () => void;
  onDelete?: (keys: any) => void;
}) => {
  const client = useKeycloakClient();
  const keycloak = client.kc;
  const hasPriviledges = keycloak.hasRealmRole(
    import.meta.env.VITE_PRIVILEDGED_ROLE || "user"
  );

  const [canSave, setCanSave] = useState<boolean>(false);

  const formRef = useRef<{
    save: () => void;
    clear: () => void;
    delete: () => void;
  } | null>(null);

  const saveData = (event: any) => {
    event.preventDefault();
    if (formRef.current) {
      formRef.current.save();
    }
  };

  const clearData = (event: any) => {
    event.preventDefault();
    if (formRef.current) {
      formRef.current.clear();
    }
  };

  const deleteData = (event: any) => {
    event.preventDefault();
    if (formRef.current) {
      formRef.current.delete();
    }
  };

  const onError = (errors: any) => {
    if (isOpen && errors && Object.keys(errors).length > 0) {
      toast.custom((id) => (
        <div className="flex rounded-lg border border-[#ff4500] bg-[#b33000] text-foreground-default shadow-lg ring-1 ring-[#74d0408] w-full md:max-w-[364px] p-4">
          <div className="flex pr-2 py-1 text-foreground-default">
            <CircleAlert size={16} strokeWidth={2} />
          </div>
          <div className="flex flex-1 items-center">
            <div className="w-full px-2">
              <p className="text-xs font-medium">{"Error orruced"}</p>
              <ul className="list-inside list-disc text-xs opacity-80">
                {Object.keys(errors).map((key) => (
                  <li key={`${key}_error`}>
                    <span className="font-bold">{key}</span>
                    {" : "}
                    <span>{errors[key].message}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="shrink-0 max-w-8">
            <button
              className="flex items-center h-[16px] w-[16px] justify-center rounded-[56px] bg-transparent font-semibold hover:bg-[#ffffff] hover:text-[#000000]"
              onClick={(e) => {
                e.preventDefault();
                toast.dismiss(id);
              }}
            >
              <XIcon width={24} height={24} strokeWidth={2} />
            </button>
          </div>
        </div>
      ));
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col min-w-[640px] p-0 pt-2 gap-0 "
        overlayClassName="bg-white/30 backdrop-blur-lg"
        closeButtonClassName="hidden"
        onPointerDownOutside={(e) => {
          if (
            e.target instanceof Element &&
            e.target.closest("[data-sonner-toast]")
          ) {
            e.preventDefault();
          }
          // if you are wrapping this component like shadcn, also call the caller's onPointerDownOutside method
          // onPointerDownOutside?.(e);
        }}
      >
        <SheetHeader>
          <SheetTitle className="sr-only text-foreground-default">
            {!value ? "New Record" : "Record Details"}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Detailed information about the selected row.
          </SheetDescription>
        </SheetHeader>

        <button className="opacity-0 w-[0px] h-[0px] pointer-events-none">
          This is to grab focus so tooltip is not triggered immediately
        </button>

        <div className="flex justify-between px-3">
          <div className="text-lg font-bold cursor-default">
            {!value ? "New Record" : "Record Details"}
          </div>

          {showButtons && hasPriviledges && (
            <div className="flex">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={clearData}
                    variant="ghost"
                    size="icon"
                    disabled={data?.columns && data?.columns.length === 0}
                  >
                    <ListRestart className="h-4 w-4" />
                    <span className="sr-only">Clear</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="flex items-center gap-4 rounded-xs bg-primary py-1 px-2">
                  <span className="ml-auto text-muted text-sm">Clear</span>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={saveData}
                    variant="ghost"
                    size="icon"
                    disabled={
                      !canSave || (data?.columns && data?.columns.length === 0)
                    }
                  >
                    <Save className="h-4 w-4" />
                    <span className="sr-only">Save</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="flex items-center gap-4 rounded-xs bg-primary py-1 px-2">
                  <span className="ml-auto text-muted text-sm">Save</span>
                </TooltipContent>
              </Tooltip>
              {value && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={deleteData}
                      disabled={data?.columns && data?.columns.length === 0}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="flex items-center gap-4 rounded-xs bg-primary py-1 px-2">
                    <span className="ml-auto text-muted text-sm">Delete</span>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </div>

        <Separator className="mt-1 mb-1 border" />
        {data?.columns && data?.columns.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center h-[100%] w-[100%] relative">
            <div className="flex flex-1 h-[100%] w-[100%] relative">
              <svg
                className="absolute inset-0 size-full z-0 stroke-foreground/10 m-0 p-0"
                fill="none"
              >
                <defs>
                  <pattern
                    id="pattern-5c1e4f0e-62d5-498b-8ff0-cf77bb448c8e"
                    x="0"
                    y="0"
                    width="10"
                    height="10"
                    patternUnits="userSpaceOnUse"
                  >
                    <path d="M-3 13 15-5M-5 5l18-18M-1 21 17 3"></path>
                  </pattern>
                </defs>
                <rect
                  stroke="none"
                  fill="url(#pattern-5c1e4f0e-62d5-498b-8ff0-cf77bb448c8e)"
                  width="100%"
                  height="100%"
                ></rect>
              </svg>
            </div>

            <Card className="w-[300px] cursor-default rounded-[4px] bg-background absolute">
              <CardHeader className="pb-3 pt-3">
                <CardTitle className="text-sm">No Columns</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-row text-sm bt-1 border pt-4">
                No columns found for this table, add columns to this table
                first.
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex flex-1 w-[100%] overflow-y-auto px-3 overflow-x-hidden">
            <ErrorBoundary>
              <AutoFormProvider>
                <SchemaRecordForm
                  ref={formRef}
                  onSubmit={onSubmit}
                  onDelete={onDelete}
                  onCleared={onCleared}
                  value={value}
                  data={data}
                  onError={onError}
                  canSave={(value: boolean) => {
                    setCanSave(value);
                  }}
                ></SchemaRecordForm>
              </AutoFormProvider>
            </ErrorBoundary>
          </div>
        )}

        <Separator className="mt-1 mb-1 border" />
        <Button className="m-4" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </SheetContent>
    </Sheet>
  );
};

export default SchemaRecordSheet;
