import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { useKeycloakClient } from "@/components/react-keycloak-provider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { CodingSystemList } from "@/components/concepts/CodingSystemList";
import { ConceptsTable } from "@/components/concepts/ConceptsTable";
import { ConceptDetailSheet } from "@/components/concepts/ConceptDetailSheet";
import { CodingSystemDialog } from "@/components/concepts/CodingSystemDialog";
import { MappingFormDialog } from "@/components/concepts/MappingFormDialog";

import {
  getCodingSystems,
  getConcepts,
  getConcept,
  getConceptClasses,
  getConceptMappings,
  createCodingSystem,
  updateCodingSystem,
  deleteCodingSystem as deleteCodingSystemApi,
  createConcept,
  updateConcept,
  deleteConcept as deleteConceptApi,
  createConceptMapping,
  updateConceptMapping,
  deleteConceptMapping,
  searchConcepts,
  type CodingSystem,
  type Concept,
  type ConceptMapping,
} from "@/lib/restClients/conceptRestClient";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Form,
  ListPlus,
  MoreHorizontalIcon,
  Pencil,
  Plus,
  Trash2,
  Trash2Icon,
} from "lucide-react";
import type { data } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { table } from "console";

import {
  useEffect,
  useMemo,
  useRef,
  isValidElement,
  cloneElement,
} from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  type SortingState,
  type VisibilityState,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTablePagination } from "@/components/datatable/data-table-pagination";
import type {
  FilterOption,
  ProjectionOption,
  SortingOption,
} from "@/types/database";
import { Checkbox } from "@/components/ui/checkbox";

type CustomColumnDef<TData, TValue> = ColumnDef<TData, TValue> & {
  className?: string;
  customComponent?: React.ReactElement;
};

function ConceptsPage() {
  const client = useKeycloakClient();
  const queryClient = useQueryClient();
  const token = client.kc.token;

  // ── State ───────────────────────────────────────────────────────────
  const [selectedSystemId, setSelectedSystemId] = useState<string | undefined>(
    undefined,
  );
  const [selectedConcept, setSelectedConcept] = useState<Concept | undefined>(
    undefined,
  );
  const [conceptSheetOpen, setConceptSheetOpen] = useState(false);
  const [isNewConcept, setIsNewConcept] = useState(false);
  const [conceptSearch, setConceptSearch] = useState("");
  const [conceptClassFilter, setConceptClassFilter] = useState("all");
  const [conceptPage, setConceptPage] = useState(1);

  // Coding system dialog
  const [systemDialogOpen, setSystemDialogOpen] = useState(false);
  const [editingSystem, setEditingSystem] = useState<CodingSystem | undefined>(
    undefined,
  );

  // Mapping dialog
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<
    ConceptMapping | undefined
  >(undefined);

  const [isSaving, setIsSaving] = useState(false);

  const [filters, setFilters] = useState<FilterOption[]>([]);
  const [sorts, setSorts] = useState<SortingOption[]>([]);
  const [sortValue, setSortValue] = useState<string>();
  const [projections, setProjections] = useState<ProjectionOption[]>([]);
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 100,
  });

  //   const [searchInput, setSearchInput] = useState(search);

  const refTableContainer = useRef<HTMLTableElement>(null);

  //   useEffect(() => {
  //     setSearchInput(search);
  //   }, [search]);

  //   useEffect(() => {
  //     const timer = setTimeout(() => {
  //       if (searchInput !== search) {
  //         onSearchChange(searchInput);
  //       }
  //     }, 300);
  //     return () => clearTimeout(timer);
  //   }, [searchInput]);

  // ── Queries ─────────────────────────────────────────────────────────
  const systemsQuery = useQuery({
    queryKey: ["coding-systems"],
    queryFn: () => getCodingSystems(token, { include_stats: true }),
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const conceptsQuery = useQuery({
    queryKey: [
      "concepts",
      selectedSystemId,
      //   conceptSearch,
      //   conceptClassFilter,
      //   pagination.pageIndex,
      //   pagination.pageSize,
    ],
    queryFn: () =>
      getConcepts(token, selectedSystemId!, {
        search: conceptSearch || undefined,
        concept_class:
          conceptClassFilter !== "all" ? conceptClassFilter : undefined,
        page: pagination.pageIndex,
        limit: pagination.pageSize,
      }),
    enabled: !!selectedSystemId,
    refetchInterval: false,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchIntervalInBackground: false,
  });

  const classesQuery = useQuery({
    queryKey: ["concept-classes", selectedSystemId],
    queryFn: () => getConceptClasses(token, selectedSystemId!),
    enabled: !!selectedSystemId,
    refetchOnWindowFocus: false,
  });

  const mappingsQuery = useQuery({
    queryKey: ["concept-mappings", selectedConcept?.id],
    queryFn: () => getConceptMappings(token, selectedConcept!.id),
    enabled: !!selectedConcept?.id && conceptSheetOpen,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (pagination) {
      conceptsQuery.refetch();
      if (refTableContainer.current) {
        refTableContainer.current.scrollTo({
          top: 0,
          left: 0,
          // behavior: "smooth"
        });
      }
    }
  }, [pagination]);

  // ── Handlers ────────────────────────────────────────────────────────

  const handleSelectSystem = (id: string) => {
    setSelectedSystemId(id);
    setConceptSearch("");
    setConceptClassFilter("all");
    setConceptPage(1);
  };

  // Coding System CRUD
  const handleAddSystem = () => {
    setEditingSystem(undefined);
    setSystemDialogOpen(true);
  };

  const handleEditSystem = (system: CodingSystem) => {
    setEditingSystem(system);
    setSystemDialogOpen(true);
  };

  const handleDeleteSystem = async (system: CodingSystem) => {
    try {
      await deleteCodingSystemApi(token, system.id);
      toast.success(`Deactivated coding system: ${system.system_code}`);
      queryClient.invalidateQueries({ queryKey: ["coding-systems"] });
      if (selectedSystemId === system.id) {
        setSelectedSystemId(undefined);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to deactivate coding system");
    }
  };

  const handleSaveSystem = async (data: Partial<CodingSystem>) => {
    setIsSaving(true);
    try {
      if (editingSystem) {
        await updateCodingSystem(token, editingSystem.id, data);
        toast.success("Coding system updated");
      } else {
        await createCodingSystem(token, data);
        toast.success("Coding system created");
      }
      queryClient.invalidateQueries({ queryKey: ["coding-systems"] });
      setSystemDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save coding system");
    } finally {
      setIsSaving(false);
    }
  };

  // Concept CRUD
  const handleAddConcept = () => {
    setSelectedConcept(undefined);
    setIsNewConcept(true);
    setConceptSheetOpen(true);
  };

  const handleSelectConcept = async (concept: Concept) => {
    try {
      const full = await getConcept(token, concept.id);
      setSelectedConcept(full);
    } catch {
      setSelectedConcept(concept);
    }
    setIsNewConcept(false);
    setConceptSheetOpen(true);
  };

  const handleSaveConcept = async (data: Partial<Concept>) => {
    setIsSaving(true);
    try {
      if (isNewConcept) {
        await createConcept(token, data);
        toast.success("Concept created");
      } else if (selectedConcept) {
        await updateConcept(token, selectedConcept.id, data);
        toast.success("Concept updated");
      }
      queryClient.invalidateQueries({ queryKey: ["concepts"] });
      queryClient.invalidateQueries({ queryKey: ["coding-systems"] });
      setConceptSheetOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save concept");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConcept = async () => {
    if (!selectedConcept) return;
    try {
      await deleteConceptApi(token, selectedConcept.id);
      toast.success(`Deactivated concept: ${selectedConcept.concept_code}`);
      queryClient.invalidateQueries({ queryKey: ["concepts"] });
      queryClient.invalidateQueries({ queryKey: ["coding-systems"] });
      setConceptSheetOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to deactivate concept");
    }
  };

  // Mapping CRUD
  const handleAddMapping = () => {
    setEditingMapping(undefined);
    setMappingDialogOpen(true);
  };

  const handleEditMapping = (mapping: ConceptMapping) => {
    setEditingMapping(mapping);
    setMappingDialogOpen(true);
  };

  const handleDeleteMapping = async (id: string) => {
    try {
      await deleteConceptMapping(token, id);
      toast.success("Mapping deleted");
      queryClient.invalidateQueries({ queryKey: ["concept-mappings"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete mapping");
    }
  };

  const handleSaveMapping = async (data: Partial<ConceptMapping>) => {
    setIsSaving(true);
    try {
      if (editingMapping) {
        await updateConceptMapping(token, editingMapping.id, data);
        toast.success("Mapping updated");
      } else {
        await createConceptMapping(token, data);
        toast.success("Mapping created");
      }
      queryClient.invalidateQueries({ queryKey: ["concept-mappings"] });
      setMappingDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save mapping");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSearchConcepts = useCallback(
    async (query: string) => {
      return searchConcepts(token, query, { limit: 20 });
    },
    [token],
  );

  const columns = useMemo<ColumnDef<Concept>[]>(
    () => [
      {
        id: "select",
        className:
          "flex flex-row min-w-[64px] max-w-[64px] cursor-default items-center",
        customComponent: (
          <Button
            size="sm"
            type="button"
            className="relative
                ml-2
                justify-center
                cursor-pointer
                inline-flex
                items-center
                space-x-2
                text-center
                font-regular
                ease-out
                duration-200
                rounded-md
                outline-none
                transition-all
                outline-0
                focus-visible:outline-4
                focus-visible:outline-offset-1
                border
                text-foreground
                shadow-none
                focus-visible:outline-border-strong
                data-[state=open]:bg-transparent
                data-[state=open]:outline-border-strong
                border-transparent
                text-xs
                py-1
                px-1
                pt-1
                bg-transparent
                hover:bg-transparent
                pointer-events-auto
                expandable-button"
          >
            <div className="h-3.5 w-3.5 text-foreground-lighter">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-maximize2"
                data-darkreader-inline-stroke=""
              >
                <polyline points="15 3 21 3 21 9"></polyline>
                <polyline points="9 21 3 21 3 15"></polyline>
                <line x1="21" x2="14" y1="3" y2="10"></line>
                <line x1="3" x2="10" y1="21" y2="14"></line>
              </svg>
            </div>{" "}
          </Button>
        ),
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label="Select all"
            className="translate-y-0.5"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            className="translate-y-0.5 cursor-default"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
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
          <span className="truncate max-w-75 block">
            {row.original.display_name}
          </span>
        ),
      },
      {
        accessorKey: "concept_class",
        header: "Class",
        cell: ({ row }) =>
          row.original.concept_class ? row.original.concept_class : null,
      },
      {
        accessorKey: "datatype",
        header: "Datatype",
        cell: ({ row }) => (
          <span className="text-xs">{row.original.datatype || "-"}</span>
        ),
      },
      {
        accessorKey: "is_active",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={"outline"} className="text-xs">
            {row.original.is_active ? "active" : "inactive"}
          </Badge>
        ),
      },
    ],
    [],
  );

  const totalPages = Math.ceil(
    (conceptsQuery.data?.total ?? 0) / pagination.pageSize,
  );

  const _table = useReactTable({
    data: conceptsQuery.data?.data ?? [],
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    manualPagination: true,
    autoResetPageIndex: false,
    pageCount: totalPages,
  });

  const enhancedComponent = (
    component: React.ReactElement | undefined,
    type: string | React.JSXElementConstructor<any>,
    props?: (Partial<any> & React.Attributes) | undefined,
  ): React.ReactElement | undefined => {
    return component && isValidElement(component) && component.type === type
      ? cloneElement(component, props)
      : component;
  };

  // ── Render ──────────────────────────────────────────────────────────

  const navComponents = () => (
    <div className="flex min-h-13 max-h-13 w-full items-center pr-2 py-2">
      <div className="flex">
        <ButtonGroup className="  focus-visible:outline-none">
          <Select
            key={selectedSystemId ?? "__empty__"}
            disabled={(systemsQuery.data ?? []).length === 0 ? true : false}
            value={selectedSystemId}
            onValueChange={handleSelectSystem}
          >
            <SelectTrigger className="flex  min-w-56 max-w-56 rounded-sm text-sm focus-visible:outline-none">
              <SelectValue placeholder="Coding Systems" />
            </SelectTrigger>
            <SelectContent
              className="rounded-xs"
              side="bottom"
              avoidCollisions={false}
              position="popper"
            >
              <SelectGroup>
                {(systemsQuery.data ?? []).map((system: any) => (
                  <SelectItem
                    key={system.id}
                    value={system.id}
                    description={system.system_name}
                  >
                    {system.system_code}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <div className="flex justify-center items-center min-h-9 max-h-9 w-[0.5px]">
            <div className="flex bg-border min-h-7 max-h-7 w-[0.5px]" />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              asChild
              className="disabled:cursor-not-allowed"
            >
              <Button
                className="rounded-sm disabled:cursor-not-allowed"
                variant="outline"
                size="icon"
                aria-label="More Options"
              >
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-full">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={handleAddSystem}>
                  <Plus width={16} height={16} />
                  New
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!selectedSystemId}
                  onClick={() => {
                    const item = (systemsQuery.data ?? []).find(
                      (f: any) => f.id === selectedSystemId,
                    );
                    if (item) handleEditSystem(item);
                  }}
                >
                  <Pencil width={16} height={16} />
                  Edit
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  variant="destructive"
                  disabled={!selectedSystemId}
                  onClick={() => {
                    const item = (systemsQuery.data ?? []).find(
                      (f: any) => f.id === selectedSystemId,
                    );
                    if (item) handleDeleteSystem(item);
                  }}
                >
                  <Trash2Icon />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </ButtonGroup>
      </div>
      {/*  */}
      <div className="flex flex-1" />

      <div className="flex h-full items-center">
        <Separator orientation="vertical" className="mx-2 min-h-6" />
        <div className="flex">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                disabled={!selectedSystemId}
                onClick={handleAddConcept}
                variant="ghost"
                size="icon"
              >
                <ListPlus className="h-4 w-4" />
                <span className="sr-only">Add Record</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add Concept</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                disabled={
                  _table.getFilteredSelectedRowModel().rows.length === 0
                }
                variant="ghost"
                size="icon"
                onClick={() => {
                  //   const primaryKeys = (data?.columns || [])
                  //     .filter((col: any) => col.primaryKey)
                  //     .map((col: any) => col.id);
                  //   const rows = _table
                  //     .getFilteredSelectedRowModel()
                  //     .rows.map((row: any) => {
                  //       return row.original;
                  //     });
                  //   const ids = primaryKeys
                  //     .map((key: any) => {
                  //       return rows.map((row: any) => {
                  //         return row[key];
                  //       });
                  //     })
                  //     .flat();
                  //   onDelete(ids);
                }}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">{`Delete Selected Record${
                  _table.getFilteredSelectedRowModel().rows.length === 1
                    ? ""
                    : "s"
                }`}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{`Delete Selected Record${
              _table.getFilteredSelectedRowModel().rows.length === 1 ? "" : "s"
            }`}</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <Separator orientation="vertical" className="mx-2 min-h-6" />
    </div>
  );

  return (
    <ContentLayout nav={navComponents()}>
      <div
        className={cn(
          "flex flex-col min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)] w-full h-full",
        )}
      >
        {/* Main Area: Concepts Table */}
        {selectedSystemId ? (
          <div className="flex w-full h-full flex-col min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)]">
            <div className="flex flex-1 border-b overflow-auto ">
              <Table
                className={cn(
                  (conceptsQuery.data?.data ?? []).length === 0 ? "h-full" : "",
                )}
                wrapperRef={refTableContainer}
                wrapperClassName="dataTable"
              >
                <TableHeader>
                  {_table.getHeaderGroups().map((headerGroup) => (
                    <TableRow
                      key={headerGroup.id}
                      className="hover:bg-black/5 data-[state=selected]:bg-black/5"
                    >
                      {headerGroup.headers.map((header) => {
                        const columnDefinition = header.column
                          .columnDef as CustomColumnDef<unknown, unknown>;
                        const className = columnDefinition.className;
                        const customComponent =
                          columnDefinition.customComponent;

                        return (
                          <TableHead
                            key={header.id}
                            colSpan={header.colSpan}
                            className={cn(
                              className,
                              customComponent ? "pl-2.25" : "",
                            )}
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext(),
                                )}
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {_table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const columnDefinition = cell.column
                          .columnDef as CustomColumnDef<unknown, unknown>;
                        const className = columnDefinition.className;

                        const customComponent = enhancedComponent(
                          columnDefinition.customComponent,
                          Button,
                          {
                            onClick: () => {
                              handleSelectConcept(row.original);
                            },
                          },
                        );

                        return (
                          <TableCell key={cell.id} className={className}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                            {customComponent}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DataTablePagination table={_table} />
          </div>
        ) : (
          //   <ConceptsTable
          //     concepts={conceptsQuery.data?.data ?? []}
          //     total={conceptsQuery.data?.total ?? 0}
          //     page={conceptsQuery.data?.page ?? 1}
          //     limit={conceptsQuery.data?.limit ?? 100}
          //     search={conceptSearch}
          //     conceptClass={conceptClassFilter}
          //     conceptClasses={classesQuery.data ?? []}
          //     isLoading={conceptsQuery.isLoading}
          //     onSearchChange={(s) => {
          //       setConceptSearch(s);
          //       setConceptPage(1);
          //     }}
          //     onClassChange={(cls) => {
          //       setConceptClassFilter(cls);
          //       setConceptPage(1);
          //     }}
          //     onPageChange={setConceptPage}
          //     onSelect={handleSelectConcept}
          //     onAdd={handleAddConcept}
          //   />
          <div className="flex w-full items-center justify-center min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)] relative">
            <div className="flex flex-1 h-full w-full relative">
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
                <CardTitle>{"Concepts"}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm border py-4">
                Select a coding system to view its concepts
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Concept Detail Sheet */}
      <ConceptDetailSheet
        open={conceptSheetOpen}
        onOpenChange={setConceptSheetOpen}
        concept={selectedConcept}
        mappings={mappingsQuery.data ?? undefined}
        conceptClasses={classesQuery.data ?? []}
        isNew={isNewConcept}
        systemId={selectedSystemId ?? ""}
        onSave={handleSaveConcept}
        onDelete={handleDeleteConcept}
        onAddMapping={handleAddMapping}
        onEditMapping={handleEditMapping}
        onDeleteMapping={handleDeleteMapping}
        isSaving={isSaving}
      />

      {/* Coding System Dialog */}
      <CodingSystemDialog
        open={systemDialogOpen}
        onOpenChange={setSystemDialogOpen}
        system={editingSystem}
        onSave={handleSaveSystem}
        isSaving={isSaving}
      />

      {/* Mapping Form Dialog */}
      <MappingFormDialog
        open={mappingDialogOpen}
        onOpenChange={setMappingDialogOpen}
        mapping={editingMapping}
        fromConceptId={selectedConcept?.id ?? ""}
        fromConceptCode={selectedConcept?.concept_code ?? ""}
        fromConceptName={selectedConcept?.display_name ?? ""}
        onSave={handleSaveMapping}
        onSearch={handleSearchConcepts}
        isSaving={isSaving}
      />
    </ContentLayout>
  );
}

export default ConceptsPage;
