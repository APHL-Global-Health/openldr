import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/sheet";

import {
  KeyRound,
  // ListRestart,
  PlusCircle,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@radix-ui/react-dropdown-menu";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@radix-ui/react-tooltip";
import { Fragment } from "react/jsx-runtime";
import { Column } from "@/types/database";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  // useRef,
  useState,
} from "react";
import { DataTypes } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SchemaSheet = ({
  isOpen,
  //   data,
  value,
  onOpenChange,
  setOpen,
}: {
  //   data: any;
  isOpen: boolean;
  value: any | undefined;
  onOpenChange: (value: boolean) => void;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const [columns, setColumns] = useState<Column[]>([]);
  const [columnName, setColumnName] = useState<string>("");

  // const columnNameInputRef = useRef<HTMLInputElement>(null);

  const saveData = (event: any) => {
    event.preventDefault();
  };

  const deleteData = (event: any) => {
    event.preventDefault();
  };

  const addColumn = (event: any) => {
    event.preventDefault();
    setColumns((prev) => [
      ...prev,
      {
        id: Math.floor(Math.random() * 10000) + "-column-item",
        name: "",
        type: "",
        constraint: null,
        primaryKey: false,
      },
    ]);
  };

  const dataTypes = Object.keys(DataTypes);
  return (
    <Sheet
      open={isOpen}
      onOpenChange={(value) => {
        onOpenChange(value);
        setColumns([]);
      }}
    >
      <SheetContent
        side="right"
        className="flex flex-col min-w-[512px] p-0 pt-2 gap-0 "
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
            {value ? "New Schema" : "Schema Details"}
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
            {value ? "New Schema" : "Schema Details"}
          </div>

          <div className="flex">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={saveData}
                  variant="ghost"
                  size="icon"
                  disabled={
                    columnName.trim().length === 0 || columns.length === 0
                  }
                >
                  <Save className="h-4 w-4" />
                  <span className="sr-only">Save</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save</TooltipContent>
            </Tooltip>
            {value && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={deleteData}>
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        <Separator className="mt-1 mb-1 border" />
        <div className="flex flex-row gap-2 w-[100%] px-3 py-2">
          <div className={`flex grow-1 items-center truncate`}>
            <label className={`block text-sm`}>Name</label>
          </div>
          <input
            defaultValue={columnName}
            onChange={(event) => setColumnName(event.target.value)}
            type="text"
            className="flex flex-grow-3 focus:outline-none focus:border-ring focus:ring-opacity-50 border rounded-xs text-sm p-1"
          />
        </div>

        <Separator className="mt-1 mb-1 border" />
        <div className="flex w-[100%] px-3 text-sm">
          <div className="flex flex-1 items-center truncate cursor-default">
            Columns
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={addColumn}>
                <PlusCircle className="h-4 w-4" />
                <span className="sr-only">Add Column</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add Column</TooltipContent>
          </Tooltip>
        </div>
        <Separator className="mt-1 mb-1 border" />
        <div className="grid grid-cols-[auto_1fr_1fr_auto_auto] gap-0 gap-y-4 w-full">
          <div className="flex w-8 items-center pl-4 h-8 col-start-1 text-sm">
            <KeyRound className="h-[13px] w-[13px]" />
          </div>
          <div className="flex pl-3 items-center h-8 col-start-2 text-[10px] cursor-default">
            Name
          </div>
          <div className="flex items-center h-8 pl-3 col-start-3 text-[10px] cursor-default">
            DataType
          </div>
          <div className="flex w-[96px] items-center p-0  pl-3 h-8 col-start-4 text-[10px] cursor-default">
            Constraint
          </div>
          <div className="flex w-12 items-center justify-center h-8 col-start-5 text-[10px] cursor-default"></div>
        </div>
        <Separator className="mt-1 mb-1 border" />
        {columns.length === 0 ? (
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
                <span className="flex items-center h-4">Click the</span>
                <PlusCircle className="flex h-4 w-4 mx-2" />
                <span className="flex items-center h-4">
                  to add a new column
                </span>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="h-full w-full overflow-y-auto pl-3 py-1 overflow-x-hidden">
            <div className="grid grid-cols-[auto_1fr_1fr_auto_auto] gap-0 gap-y-4 w-full">
              {columns.map((column, index) => (
                <Fragment key={`${column.id}_${index}`}>
                  <div
                    className={`flex items-center pl-1 h-8 col-start-1 row-start-${index + 1}`}
                  >
                    <Checkbox
                      // checked={column.primaryKey}
                      // onCheckedChange={(value) => row.toggleSelected(!!value)}
                      aria-label="Select row"
                      className="cursor-default"
                    />
                  </div>
                  <div
                    className={`flex pl-2 items-center h-8 col-start-2 row-start-${index + 1}`}
                  >
                    <input
                      type="text"
                      defaultValue={column.name ?? ""}
                      onChange={(event) => {
                        column.name = event.target.value;
                      }}
                      placeholder="Name"
                      className="w-full
                      min-w-0 
                      h-[36px] 
                      min-h-0 
                      focus:outline-none 
                      focus:border-ring 
                      focus:ring-opacity-50 
                      border 
                      rounded-xs 
                      text-sm 
                      px-2"
                    />
                  </div>
                  <div
                    className={`flex items-center h-8 pl-2 col-start-3 row-start-${index + 1}`}
                  >
                    <Select
                      defaultValue={column.type ?? ""}
                      onValueChange={(value) => {
                        column.type = value;
                      }}
                    >
                      <SelectTrigger className="w-full min-w-0 rounded-xs border m-1 text-[12px] data-[placeholder]:text-gray-400">
                        <SelectValue placeholder="DataType" />
                      </SelectTrigger>
                      <SelectContent
                        align="start"
                        className="max-h-[256px] rounded-xs border bg-dash-sidebar"
                      >
                        <SelectGroup>
                          {dataTypes.map((type) => (
                            <SelectItem key={`${type}_datatypes`} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div
                    className={`flex w-[96px] items-center p-0  pl-2 h-8 col-start-4 row-start-${index + 1}`}
                  >
                    <input
                      type="text"
                      defaultValue={column.constraint ?? ""}
                      onChange={(event) => {
                        const value = parseInt(event.target.value);
                        if (!isNaN(value)) {
                          column.constraint = value;
                        }
                      }}
                      placeholder="Constraint"
                      className="w-full
                      min-w-0 
                      h-[36px] 
                      min-h-0 
                      focus:outline-none 
                      focus:border-ring 
                      focus:ring-opacity-50 
                      border 
                      rounded-xs 
                      text-sm 
                      text-center"
                    />
                  </div>
                  <div
                    className={`flex w-12 items-center justify-center h-8 col-start-5 row-start-${index + 1}`}
                  >
                    <Button
                      onClick={(e) => {
                        e.preventDefault();
                        setColumns((prevItems) =>
                          prevItems.filter((item) => item.id !== column.id)
                        );
                      }}
                      variant="ghost"
                      size="icon"
                      className="w-9 h-9"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </Fragment>
              ))}
            </div>
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

export default SchemaSheet;
