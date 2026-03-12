import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CodingSystem } from "@/lib/restClients/conceptRestClient";

interface CodingSystemListProps {
  systems: CodingSystem[];
  selectedSystemId: string | undefined;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onEdit: (system: CodingSystem) => void;
  onDelete: (system: CodingSystem) => void;
  isLoading?: boolean;
}

export function CodingSystemList({
  systems,
  selectedSystemId,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  isLoading,
}: CodingSystemListProps) {
  return (
    <div className="flex flex-col h-full border-r">
      <div className="flex items-center justify-between p-3 border-b">
        <span className="text-sm font-semibold">Coding Systems</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAdd}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-3 text-sm text-muted-foreground">Loading...</div>
        ) : systems.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground">
            No coding systems found
          </div>
        ) : (
          <div className="p-1">
            {systems.map((system) => (
              <CodingSystemItem
                key={system.id}
                system={system}
                isSelected={system.id === selectedSystemId}
                onSelect={() => onSelect(system.id)}
                onEdit={() => onEdit(system)}
                onDelete={() => onDelete(system)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function CodingSystemItem({
  system,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: {
  system: CodingSystem;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-md px-2 py-1.5 cursor-pointer group text-sm",
        isSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
      )}
      onClick={onSelect}
    >
      <div className="flex flex-col min-w-0 flex-1">
        <span className="font-medium truncate">{system.system_code}</span>
        <span className="text-xs text-muted-foreground truncate">
          {system.system_name}
        </span>
      </div>
      <div className="flex items-center gap-1 ml-2">
        {system.concept_count !== undefined && (
          <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
            {system.concept_count}
          </Badge>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Pencil className="h-3.5 w-3.5 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Deactivate
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
