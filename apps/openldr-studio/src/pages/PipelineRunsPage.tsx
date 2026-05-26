import { useState, useMemo, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/table";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { DataTablePagination } from "@/components/datatable/data-table-pagination";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, ToggleLeft, ToggleRight } from "lucide-react";
import { getColumns } from "@/components/pipeline-runs/columns";
import { RunDetailSheet } from "@/components/pipeline-runs/RunDetailSheet";
import { usePipelineRunsList } from "@/hooks/misc/usePipelineRuns";
import type { PipelineRun } from "@/lib/restClients/pipelineRunsRestClient";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/lib/autoform/shadcn/components/ui/label";

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "queued", label: "Queued" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "deleted", label: "Deleted" },
];

export default function PipelineRunsPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 100,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);

  const queryParams = useMemo(
    () => ({
      page: pagination.pageIndex,
      limit: pagination.pageSize,
      sortBy: sorting[0]?.id ?? "createdAt",
      sortDir: (sorting[0]?.desc ? "desc" : "asc") as "asc" | "desc",
      status: statusFilter === "all" ? undefined : statusFilter,
      autoRefresh,
    }),
    [pagination, sorting, statusFilter, autoRefresh],
  );

  const { data, isLoading, refetch } = usePipelineRunsList(queryParams);

  const onRowClick = useCallback((messageId: string) => {
    setSelectedRunId(messageId);
    setDetailOpen(true);
  }, []);

  const columns = useMemo(() => getColumns(onRowClick), [onRowClick]);

  const table = useReactTable<PipelineRun>({
    data: data?.data ?? [],
    columns,
    pageCount: data ? Math.ceil(data.total / data.limit) : 0,
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
  });

  const nav = (
    <div className="flex items-center gap-2 w-full">
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="h-8 w-36 text-xs rounded-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="flex-1" />

      <Separator orientation="vertical" className="mx-2 min-h-6" />

      <div className="flex items-center space-x-2">
        <Switch
          id="auto-mode"
          checked={autoRefresh}
          onCheckedChange={setAutoRefresh}
        />
        <Label className="text-xs" htmlFor="auto-mode">
          Auto
        </Label>
      </div>

      <Separator orientation="vertical" className="mx-2 min-h-6" />

      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => refetch()}
      >
        <RefreshCw className={`h-3.5 w-3.5`} />
      </Button>

      <Separator orientation="vertical" className="mx-2 min-h-6" />

      {data && (
        <div className="flex items-center">
          <span className="text-xs text-muted-foreground">
            {data.total} run{data.total !== 1 ? "s" : ""}
          </span>
          <Separator orientation="vertical" className="mx-2 min-h-6" />
        </div>
      )}
    </div>
  );

  return (
    <ContentLayout nav={nav}>
      <div
        className={cn(
          "flex flex-col min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)] w-full h-full",
        )}
      >
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex min-h-[calc(100vh-26px-58px-36px)] max-h-[calc(100vh-26px-36px)] flex-col items-center justify-center h-full w-full relative">
              <LoadingSpinner />
            </div>
          ) : table.getRowModel().rows.length === 0 ? (
            <div className="flex w-full items-center justify-center min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)] relative">
              <div className="flex w-full min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)] relative">
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

              <Card className="w-75 cursor-default p-0 m-0 gap-0 rounded-sm bg-background absolute">
                <CardHeader className="pb-0 py-2">
                  <CardTitle>{"Pipelines"}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm border py-4">
                  No pipeline runs found
                </CardContent>
              </Card>
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 z-10">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="text-[10px] uppercase tracking-[1.5px] text-muted-foreground h-8 cursor-pointer select-none"
                        style={{ width: header.getSize() }}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                        {header.column.getIsSorted() === "asc" ? " ↑" : ""}
                        {header.column.getIsSorted() === "desc" ? " ↓" : ""}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onRowClick(row.original.messageId)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className="py-1.5"
                        style={{ width: cell.column.getSize() }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <DataTablePagination selectable={false} table={table} />
      </div>

      <RunDetailSheet
        messageId={selectedRunId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onDeleted={() => {
          setSelectedRunId(null);
          refetch();
        }}
      />
    </ContentLayout>
  );
}
