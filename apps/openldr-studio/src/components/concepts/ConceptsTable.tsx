import { useState, useEffect, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";
import type { Concept } from "@/lib/restClients/conceptRestClient";

interface ConceptsTableProps {
  concepts: Concept[];
  total: number;
  page: number;
  limit: number;
  search: string;
  conceptClass: string;
  conceptClasses: string[];
  isLoading?: boolean;
  onSearchChange: (search: string) => void;
  onClassChange: (cls: string) => void;
  onPageChange: (page: number) => void;
  onSelect: (concept: Concept) => void;
  onAdd: () => void;
}

export function ConceptsTable({
  concepts,
  total,
  page,
  limit,
  search,
  conceptClass,
  conceptClasses,
  isLoading,
  onSearchChange,
  onClassChange,
  onPageChange,
  onSelect,
  onAdd,
}: ConceptsTableProps) {
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) {
        onSearchChange(searchInput);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const totalPages = Math.ceil(total / limit);

  const columns = useMemo<ColumnDef<Concept>[]>(
    () => [
      {
        accessorKey: "concept_code",
        header: "Code",
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.concept_code}</span>
        ),
      },
      {
        accessorKey: "display_name",
        header: "Display Name",
        cell: ({ row }) => (
          <span className="truncate max-w-[300px] block">{row.original.display_name}</span>
        ),
      },
      {
        accessorKey: "concept_class",
        header: "Class",
        cell: ({ row }) =>
          row.original.concept_class ? (
            <Badge variant="outline" className="text-xs">
              {row.original.concept_class}
            </Badge>
          ) : null,
      },
      {
        accessorKey: "datatype",
        header: "Datatype",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.datatype || "-"}
          </span>
        ),
      },
      {
        accessorKey: "is_active",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={row.original.is_active ? "default" : "secondary"} className="text-xs">
            {row.original.is_active ? "Active" : "Inactive"}
          </Badge>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: concepts,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-3 border-b">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search concepts..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Select value={conceptClass} onValueChange={onClassChange}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="All Classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {conceptClasses.map((cls) => (
              <SelectItem key={cls} value={cls}>
                {cls}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" className="h-9" onClick={onAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Add Concept
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : concepts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                  No concepts found
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => onSelect(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between px-3 py-2 border-t text-sm">
          <span className="text-muted-foreground">
            Showing {(page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
