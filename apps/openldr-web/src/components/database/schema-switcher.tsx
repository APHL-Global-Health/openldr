"use client";

import * as React from "react";
import {
  CaretSortIcon,
  CheckIcon,
  PlusCircledIcon,
} from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import { Table2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type PopoverTriggerProps = React.ComponentPropsWithoutRef<
  typeof PopoverTrigger
>;

export type DatabaseType = {
  name: string;
  tables: string[];
};

type DatabaseTableType = {
  database: string;
  table: string;
};

interface SchemaSwitcherProps extends PopoverTriggerProps {
  databases: DatabaseType[];
  onTableSelect: (database: string, table: string) => void;
  onTableCreate: () => void;
}

export function SchemaSwitcher({
  databases,
  onTableSelect,
  onTableCreate,
  className,
}: SchemaSwitcherProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedSchema, setSelectedSchema] =
    React.useState<DatabaseTableType | null>(null);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select a team"
          className={cn("w-[200px] h-8 justify-between", className)}
        >
          <Table2Icon className="mr-2 h-5 w-5" />
          {selectedSchema ? selectedSchema.table : "Databases"}
          <CaretSortIcon className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search databases..." />
          <CommandEmpty>No databases found.</CommandEmpty>
          <CommandList className="bg-background max-h-[256px]">
            {databases.map((database) => (
              <CommandGroup
                className="[&_[cmdk-group-heading]]:text-foreground-default/50"
                key={database.name}
                heading={database.name}
              >
                {database.tables.map((table) => (
                  <CommandItem
                    key={`${database.name}_${table}`}
                    onSelect={() => {
                      setSelectedSchema({
                        database: database.name,
                        table: table,
                      });
                      onTableSelect(database.name, table);
                      setOpen(false);
                    }}
                    className="text-sm"
                  >
                    <Table2Icon className="mr-2 h-5 w-5" />
                    {table}
                    <CheckIcon
                      className={cn(
                        "ml-auto h-4 w-4",
                        selectedSchema &&
                          selectedSchema.database === database.name &&
                          selectedSchema.table === table
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
          {/* <CommandSeparator />
          <CommandList className="bg-background">
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  onTableCreate();
                }}
              >
                <PlusCircledIcon className="mr-2 h-5 w-5" />
                Create Schema
              </CommandItem>
            </CommandGroup>
          </CommandList> */}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
