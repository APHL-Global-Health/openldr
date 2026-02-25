import { ContentLayout } from "@/components/admin-panel/content-layout";

import {
  useState,
  useEffect,
  useRef,
  useId,
  isValidElement,
  cloneElement,
} from "react";

import { Separator } from "@/components/ui/separator";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  Filter,
  List,
  ListIcon,
  Plus,
  X,
  Logs,
  Trash2,
  ListPlus,
} from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/table";

import { DataTablePagination } from "@/components/datatable/data-table-pagination";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { JOINING_VALS, FILTER_VALS } from "@/lib/constants";
import {
  type FilterOption,
  type ProjectionOption,
  type SortingOption,
} from "@/types/database";
import { Input } from "@/components/ui/input";
import { PopoverClose } from "@radix-ui/react-popover";
import { Switch } from "@/components/ui/switch";
import {
  SchemaSwitcher,
  type DatabaseType,
} from "@/components/database/schema-switcher";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import SchemaRecordSheet from "@/components/forms/schema-record-sheet";
import SchemaSheet from "@/components/forms/schema-sheet";
import { useKeycloakClient } from "@/components/react-keycloak-provider";

import * as SchemaRestClient from "@/lib/restClients/schemaRestClient";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { manipulateData } from "@/lib/restClients/schemaRestClient";
import { toast } from "sonner";

import { formatDate } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useMultiNamespaceTranslation } from "@/i18n/hooks";

export type CustomColumnDef<TData, TValue> = ColumnDef<TData, TValue> & {
  className?: string;
  customComponent?: React.ReactElement;
};

// Define a type for your data structure
export type TableData = {
  items: any[];
  columns?: { name: string }[];
  totalPages?: number;
  [key: string]: any;
};

function ArchivePage() {
  const [filters, setFilters] = useState<FilterOption[]>([]);
  const [sorts, setSorts] = useState<SortingOption[]>([]);
  const [sortValue, setSortValue] = useState<string>();
  const [projections, setProjections] = useState<ProjectionOption[]>([]);
  const [projectionValue, setProjectionValue] = useState<string>();
  const [isRecordSheetOpen, setRecordSheetOpen] = useState(false);
  const [selectedRecordItem, setSelectedRecordItem] = useState<any | undefined>(
    undefined,
  );
  const [isSchemaSheetOpen, setSchemaSheetOpen] = useState(false);
  const [schema, setSchema] = useState<string | undefined>(undefined);
  const [table, setTable] = useState<string | undefined>(undefined);
  const [altTable, setAltTable] = useState<string | undefined>(undefined);
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 100,
  });

  const queryClient = useQueryClient();
  const client = useKeycloakClient();

  const refTableContainer = useRef<HTMLTableElement>(null);

  const { t } = useMultiNamespaceTranslation(["common", "app"]);

  const { data: tableSchemas } = useQuery({
    queryKey: ["Tables", "ArchivePage"],
    queryFn: async () => {
      //TODO focus on the core tables for now, in order of how to input data
      // const msg = await SchemaRestClient.getAllTables(client.kc.token);

      // return {
      //   data: {
      //     Internal: msg.data,
      //     // Management: [
      //     //   "Projects",
      //     //   "Use Cases",
      //     //   "Facilities",
      //     //   "Plugins",
      //     //   "Mapper",
      //     // ],
      //   },
      // };

      return {
        data: {
          Internal: [
            "projects",
            "useCases",
            "facilities",
            "plugins",
            "dataFeeds",
            "users",
            "formSchemas",
          ],
        },
      };
    },
    refetchInterval: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchIntervalInBackground: false,
  });

  const { data, refetch, isLoading, isRefetching } = useQuery<TableData>({
    queryKey: ["Data", "ArchivePage", table, schema],
    queryFn: async () => {
      if (table && schema) {
        if (schema === "Internal") {
          const cols = await SchemaRestClient.getTableColumns(
            table,
            client.kc.token,
          );

          const filter: any = {
            offset: pagination.pageIndex, //<--page
            limit: pagination.pageSize, //<--limit
          };

          if (filters && filters.length > 0) {
            const _cols = cols?.data || [];
            const _filters = filters.map((f: any) => {
              const _col = _cols.find((c: any) => c.Name === f.column);
              if (_col) {
                if (_col.Type === "boolean") {
                  if (f.value == "true") f.value = true;
                  else if (f.value == "false") f.value = false;
                }
              }

              return f;
            });

            setFilters(_filters);

            filter["where"] = _filters;
          }

          if (sorts && sorts.length > 0) {
            filter["order"] = sorts.map((p) => [
              p.column,
              p.ascending ? "ASC" : "DESC",
            ]);
          }

          if (projections && projections.length > 0) {
            filter["attributes"] = projections.map((p) => p.column);
          }

          const msg = await SchemaRestClient.getTableData(
            table,
            filter,
            client.kc.token,
          );

          const { count, rows } = msg.data;

          return {
            totalPages: Math.ceil(count / pagination.pageSize),
            items: rows,
            columns: (cols?.data || []).map((row) => {
              return {
                id: row.Name,
                name: row.Name.replace(/([A-Z]+)/g, " $1") // Handle consecutive capitals
                  .replace(/([A-Z][a-z])/g, " $1") // Handle normal capitals
                  .trim()
                  .replace(/^./, (str) => str.toUpperCase())
                  .replace(/\s+/g, " "), // Clean up multiple spaces
                type: row.Type,
                nullable: row.Nullable,
                primaryKey: row.PrimaryKey || false,
                constraint: row.Constraint,
              };
            }),
          };
        }
      }
      return { items: [] };
    },
    refetchInterval: false,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchIntervalInBackground: false,
  });

  const info = tableSchemas?.data;
  let schemas: string[] = [];
  if (info) {
    schemas = Object.keys(info);
  }

  const columns: CustomColumnDef<unknown, unknown>[] = [
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
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
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
    ...(data && data.columns && data.columns.length > 0
      ? data.columns
      : []
    ).map((col: any) => {
      return {
        header: col.name,
        id: col.id,
        accessorKey: col.id,
        className: "cursor-default whitespace-nowrap",
        enableSorting: false,
        enableHiding: false,
        cell: (info) => {
          const row = info.row.original as any;

          const column = info.column.id;
          const columnDef: any = data?.columns?.find(
            (c: any) => c.id === column,
          );
          const value = info.getValue();

          if (columnDef) {
            if (value !== undefined && value !== null) {
              if (columnDef.type === "date" || columnDef.type === "datetime") {
                const format = "yyyy-MM-dd HH:mm";
                const date = new Date(value);
                return date ? formatDate(date, format) : value;
              } else if (columnDef.type === "boolean") {
                return value ? "True" : "False";
              } else if (
                columnDef.type === "json" ||
                columnDef.type === "jsonb"
              ) {
                return JSON.stringify(value);
              }
            }
          }

          return value;
        },
      };
    }),
  ];

  const _table = useReactTable({
    data: (data && data.items) || [],
    columns: data && data.items && data.items.length > 0 ? columns : [],
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
    pageCount: data ? data.totalPages : 0,
  });

  const onSchemaChanged = (db: string, tb: string) => {
    queryClient.cancelQueries({
      queryKey: ["Data", "ArchivePage", table, schema],
    });
    setSchema(db);
    setTable(tb);
    setFilters([]);
    setSorts([]);
    setProjections([]);
  };

  useEffect(() => _table.resetRowSelection(), [data, _table]);

  useEffect(() => {
    if (pagination) {
      refetch();
      if (refTableContainer.current) {
        refTableContainer.current.scrollTo({
          top: 0,
          left: 0,
          // behavior: "smooth"
        });
      }
    }
  }, [pagination, refetch]);

  const id = useId();
  const _columns = data && data.columns ? data.columns : [];

  const databases: DatabaseType[] = (schemas.length > 0 ? schemas : []).map(
    (schema: any) => {
      return {
        name: schema,
        tables: (info && info[schema]) || [],
      };
    },
  );

  const enhancedComponent = (
    component: React.ReactElement | undefined,
    type: string | React.JSXElementConstructor<any>,
    props?: (Partial<any> & React.Attributes) | undefined,
  ): React.ReactElement | undefined => {
    return component && isValidElement(component) && component.type === type
      ? cloneElement(component, props)
      : component;
  };

  const addData = (event: any) => {
    if (event) event.preventDefault();
    setSelectedRecordItem(undefined);
    setRecordSheetOpen(true);
  };

  const onSubmit = async (data: any) => {
    let _data = data;
    if (selectedRecordItem) {
      _data = {
        ...selectedRecordItem,
        ...data,
      };
    }

    if (table && schema) {
      //TODO improve this part
      if (
        table === "formSchemas" &&
        _data.schema &&
        typeof _data.schema === "string"
      ) {
        _data.schema = JSON.parse(_data.schema);
      }

      if (altTable) {
        _data.config = JSON.stringify({
          oclUrl: _data.oclUrl,
          orgId: _data.orgId,
          sourceId: _data.sourceId,
          auth: _data.auth || "",
        });
        delete _data.oclUrl;
        delete _data.orgId;
        delete _data.sourceId;
        delete _data.auth;
      }

      const keys = [_data];
      const results = await Promise.allSettled(
        keys.map((item) => {
          return manipulateData(
            table,
            schema,
            "archive",
            _data,
            client.kc.token,
            !selectedRecordItem ? "POST" : "PUT",
          );
        }),
      );

      console.log("onSubmit", results);

      const successful = results.filter((r: any) => r.status === "fulfilled");
      const failed = results.filter((r: any) => r.status === "rejected");
      if (successful.length > 0) {
        toast.success(
          `(${successful.length}) ${!selectedRecordItem ? "created" : "updated"} successfully`,
          {
            className: "bg-card text-card-foreground border-border",
          },
        );
      }
      if (failed.length > 0) {
        toast.error(
          `Failed to ${!selectedRecordItem ? "create" : "update"}. Please try again.`,
          {
            className: "bg-card text-card-foreground border-border",
          },
        );
      }
      refetch();
      setSelectedRecordItem(undefined);
      setRecordSheetOpen(false);
    }
  };

  const onDelete = async (data: any) => {
    if (table && schema) {
      const keys = [data];
      const results = await Promise.allSettled(
        keys.map((item) => {
          return manipulateData(
            table,
            schema,
            "archive",
            data,
            client.kc.token,
            "DELETE",
          );
        }),
      );

      // console.log("onDelete", results);

      const successful = results.filter((r: any) => r.status === "fulfilled");
      const failed = results.filter((r: any) => r.status === "rejected");
      if (successful.length > 0) {
        toast.success(`(${successful.length}) dleted successfully`, {
          className: "bg-card text-card-foreground border-border",
        });
      }
      if (failed.length > 0) {
        toast.error(`Failed to delete. Please try again.`, {
          className: "bg-card text-card-foreground border-border",
        });
      }
      refetch();
      setSelectedRecordItem(undefined);
      setRecordSheetOpen(false);
    }
  };

  const onCleared = async () => {
    // Handle form submission logic here
    console.log("Form cleared");
  };

  const navComponents = () => {
    return (
      <div className="flex min-h-13 max-h-13 w-full items-center px-2 py-2">
        <SchemaSwitcher
          databases={databases}
          onTableSelect={onSchemaChanged}
          onTableCreate={() => setSchemaSheetOpen(true)}
        />

        <Separator orientation="vertical" className="mx-2 min-h-6" />

        <Popover
          onOpenChange={(value) => {
            if (!value) {
              setFilters([...filters]);
              if (filters.length > 0) refetch();
            }
          }}
        >
          <PopoverTrigger
            disabled={
              _columns.length === 0 && _table.getRowModel().rows?.length === 0
            }
            asChild
          >
            <Button variant="ghost" className="h-8 px-2 border border-default">
              <Filter className="mr-2 h-3 w-3" />
              Filter
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="overflow-y-auto  m-0 p-0 w-lg max-h-64 rounded border border-default bg-dash-sidebar"
          >
            <div className="w-full h-fullflex flex-col">
              {filters.length === 0 ? (
                <div className="overflow-hidden text-ellipsis whitespace-nowrap flex items-center relative w-full flex-col">
                  <span className="text-foreground-light group-hover:text-foreground text-[12px] transition truncate w-full p-2 cursor-default">
                    No filters applied to this view
                  </span>
                </div>
              ) : (
                <ul className="p-0">
                  {filters.map((option, index) => (
                    <li key={option.id}>
                      <div className="flex">
                        <Select
                          key={`${option.id}_filters`}
                          disabled={index == 0}
                          defaultValue={option.combineWith}
                          onValueChange={(value) => {
                            option.combineWith = value;
                          }}
                        >
                          <SelectTrigger className="h-8 min-w-16.5 max-w-24 border border-default m-1 text-[12px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent
                            align="start"
                            className="w-7 max-h-64 rounded border border-default bg-dash-sidebar"
                          >
                            <SelectGroup>
                              {index == 0
                                ? "N/A"
                                : JOINING_VALS.map((option) => (
                                    <SelectItem
                                      key={option.key}
                                      value={option.symbol}
                                    >
                                      {option.symbol}
                                    </SelectItem>
                                  ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>

                        <Select
                          defaultValue={option.column}
                          onValueChange={(value) => {
                            option.column = value;
                          }}
                        >
                          <SelectTrigger className="min-w-49max-w-49 h-8 flex flex-1 border border-default m-1 text-[12px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent
                            align="start"
                            className="max-h-64 rounded border border-default bg-dash-sidebar"
                          >
                            <SelectGroup>
                              {_columns.length > 0 &&
                                _columns.map((column: any) => (
                                  <SelectItem
                                    key={id + "_" + column.id}
                                    value={column.id}
                                  >
                                    {column.name}
                                  </SelectItem>
                                ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <Select
                          defaultValue={option.operator}
                          onValueChange={(value) => {
                            option.operator = value;
                          }}
                        >
                          <SelectTrigger className="h-8 min-w-16.5 max-w-24 border border-default m-1 text-[12px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent
                            align="start"
                            className="w-7 max-h-64 rounded border border-default bg-dash-sidebar"
                          >
                            <SelectGroup>
                              {FILTER_VALS.map((option) => (
                                <SelectItem
                                  key={option.key}
                                  value={option.symbol}
                                >
                                  {option.symbol}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>

                        <Input
                          placeholder="Enter value"
                          key={
                            Math.floor(Math.random() * 1000) + "-filter-input"
                          }
                          defaultValue={option.value}
                          onChange={(event) => {
                            option.value = event.target.value;
                          }}
                          className="h-8 min-w-24 max-w-24 border border-default m-1 text-[12px]"
                        />

                        <Button
                          onClick={() => {
                            if (filters) {
                              const others = filters.filter(
                                (item) => item.id !== option.id,
                              );
                              setFilters([...others]);
                            }
                          }}
                          variant="ghost"
                          className="flex items-center justify-center rounded h-8 px-2 border-0 border-default text-[12px] hover:bg-sky-950 hover:text-white mr-1 mt-1 mb-1"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex w-full border-t justify-between border-default">
                <Button
                  onClick={() => {
                    if (_columns && _columns.length > 0) {
                      const defaultFilter = FILTER_VALS[0];
                      const defaultJoin = JOINING_VALS[0];
                      const defaultColumn = (_columns[0] as any).id;
                      if (defaultColumn && defaultFilter && defaultJoin) {
                        filters.push({
                          id: Date.now() + "_filters",
                          column: defaultColumn,
                          operator: defaultFilter.symbol,
                          value: "",
                          combineWith: defaultJoin.symbol,
                        });
                        setFilters([...filters]);
                      }
                    }
                  }}
                  variant="ghost"
                  className="h-8 px-2 rounded border-0 border-default text-[12px] hover:bg-sky-950 hover:text-white m-1"
                >
                  <Plus className="mr-2 h-3 w-3" />
                  Add filter
                </Button>
                <PopoverClose asChild>
                  <Button
                    onClick={() => {
                      refetch();
                    }}
                    variant="ghost"
                    className="h-8 px-2 rounded border-0 border-default text-[12px] hover:bg-sky-950 hover:text-white m-1"
                  >
                    Apply
                  </Button>
                </PopoverClose>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Popover
          onOpenChange={(value) => {
            if (!value) {
              setSorts([...sorts]);
              if (sorts.length > 0) refetch();
            }
          }}
        >
          <PopoverTrigger
            disabled={
              _columns.length === 0 && _table.getRowModel().rows?.length === 0
            }
            asChild
            className="ml-2"
          >
            <Button variant="ghost" className="h-8 px-2 border border-default">
              <List className="mr-2 h-3 w-3" />
              Sort
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="overflow-y-auto m-0 p-0 w-[320px] max-h-64 rounded border border-default bg-dash-sidebar"
          >
            <div className="w-full h-fullflex flex-col">
              {sorts.length === 0 ? (
                <div className="overflow-hidden text-ellipsis whitespace-nowrap flex items-center relative w-full flex-col">
                  <span className="text-foreground-light group-hover:text-foreground text-[12px] transition truncate w-full p-2 cursor-default">
                    No sorts applied to this view
                  </span>
                </div>
              ) : (
                <ul className="p-0">
                  {sorts.map((option) => (
                    <li key={option.id}>
                      <div className="flex">
                        <Button
                          variant="ghost"
                          className="flex items-center justify-center rounded h-8 px-2 border-0 border-default text-[12px] hover:bg-sky-950 hover:text-white m-1"
                        >
                          <ListIcon className="h-3 w-3" />
                        </Button>
                        <div className="flex flex-1 text-[12px] items-center">
                          {option.column}
                        </div>
                        <div className="flex items-center space-x-2 m-1">
                          <Label
                            htmlFor={option.column}
                            className="text-[12px]"
                          >
                            ascending
                          </Label>
                          <Switch
                            id={option.column}
                            defaultChecked={option.ascending}
                            onCheckedChange={(value) => {
                              option.ascending = value;
                            }}
                          />
                        </div>
                        <Button
                          onClick={() => {
                            if (sorts) {
                              const others = sorts.filter(
                                (item) => item.id !== option.id,
                              );
                              setSorts([...others]);
                            }
                          }}
                          variant="ghost"
                          className="flex items-center justify-center rounded h-8 px-2 border-0 border-default text-[12px] hover:bg-sky-950 hover:text-white mr-1 mt-1 mb-1"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex w-full border-t justify-between border-default">
                <Select
                  value={sortValue}
                  onValueChange={(value) => {
                    sorts.push({
                      id: Date.now() + "_sorts",
                      column: value,
                      ascending: true,
                    });
                    setSorts([...sorts]);
                    setSortValue("");
                  }}
                >
                  <SelectTrigger className="min-w-49 rounded-xs max-w-49 h-8 flex flex-1 border border-default m-1 text-[12px]">
                    <SelectValue placeholder="Pick a column to sort by" />
                  </SelectTrigger>
                  <SelectContent
                    align="start"
                    className="max-h-64 rounded border border-default bg-dash-sidebar"
                  >
                    <SelectGroup>
                      {_columns.length > 0 &&
                        _columns
                          .filter(
                            (option: any) =>
                              !sorts.some(
                                (sort: any) => option == sort.column.id,
                              ),
                          )
                          .map((option: any) => (
                            <SelectItem
                              key={id + "_sort_" + option.id}
                              value={option.id}
                            >
                              {option.name}
                            </SelectItem>
                          ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <PopoverClose asChild>
                  <Button
                    onClick={() => {
                      refetch();
                    }}
                    variant="ghost"
                    className="h-8 px-2 rounded border-0 border-default text-[12px] hover:bg-sky-950 hover:text-white m-1"
                  >
                    Apply sorting
                  </Button>
                </PopoverClose>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Popover
          onOpenChange={(value) => {
            if (!value) {
              setProjections([...projections]);
              if (projections.length > 0) refetch();
            }
          }}
        >
          <PopoverTrigger
            disabled={
              _columns.length === 0 && _table.getRowModel().rows?.length === 0
            }
            asChild
            className="ml-2"
          >
            <Button variant="ghost" className="h-8 px-2 border border-default">
              <Logs className="mr-2 h-3 w-3" />
              Projections
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="overflow-y-auto m-0 p-0 w-[320px] max-h-64 rounded border border-default bg-dash-sidebar"
          >
            <div className="w-full h-fullflex flex-col">
              {projections.length === 0 ? (
                <div className="overflow-hidden text-ellipsis whitespace-nowrap flex items-center relative w-full flex-col">
                  <span className="text-foreground-light group-hover:text-foreground text-[12px] transition truncate w-full p-2 cursor-default">
                    No projections applied to this view
                  </span>
                </div>
              ) : (
                <ul className="p-0">
                  {projections.map((option) => (
                    <li key={option.id}>
                      <div className="flex">
                        <Button
                          variant="ghost"
                          className="flex items-center justify-center rounded h-8 px-2 border-0 border-default text-[12px] hover:bg-sky-950 hover:text-white m-1"
                        >
                          <ListIcon className="h-3 w-3" />
                        </Button>
                        <div className="flex flex-1 text-[12px] items-center">
                          {option.column}
                        </div>
                        <Button
                          onClick={() => {
                            if (projections) {
                              const others = projections.filter(
                                (item) => item.id !== option.id,
                              );
                              setProjections([...others]);
                            }
                          }}
                          variant="ghost"
                          className="flex items-center justify-center rounded h-8 px-2 border-0 border-default text-[12px] hover:bg-sky-950 hover:text-white mr-1 mt-1 mb-1"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex w-full border-t justify-between border-default">
                <Select
                  value={projectionValue}
                  onValueChange={(value) => {
                    projections.push({
                      id: Date.now() + "_projections",
                      column: value,
                    });
                    setProjections([...projections]);
                    setProjectionValue("");
                  }}
                >
                  <SelectTrigger className="min-w-49 max-w-49 rounded-xs h-8 flex flex-1 border border-default m-1 text-[12px]">
                    <SelectValue placeholder="Pick a columns to project" />
                  </SelectTrigger>
                  <SelectContent
                    align="start"
                    className="max-h-64 rounded-xs border border-default bg-dash-sidebar"
                  >
                    <SelectGroup>
                      {_columns.length > 0 &&
                        _columns
                          .filter(
                            (option: any) =>
                              !projections.some(
                                (project: any) => option == project.column.id,
                              ),
                          )
                          .map((option: any) => (
                            <SelectItem
                              key={id + "_projection_" + option}
                              value={option.id}
                            >
                              {option.name}
                            </SelectItem>
                          ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <PopoverClose asChild>
                  <Button
                    onClick={() => {
                      refetch();
                    }}
                    variant="ghost"
                    className="h-8 px-2 rounded border-0 border-default text-[12px] hover:bg-sky-950 hover:text-white m-1"
                  >
                    Apply projection
                  </Button>
                </PopoverClose>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex flex-1"></div>

        <div className="flex h-full items-center">
          <Separator orientation="vertical" className="mx-2 min-h-6" />
          <div className="flex">
            <Tooltip>
              <TooltipTrigger asChild>
                {table && table === "plugins" ? (
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <ListPlus className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-40" align="end">
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          onSelect={() => {
                            setAltTable(undefined);
                            setSelectedRecordItem(undefined);
                            setRecordSheetOpen(true);
                          }}
                        >
                          Add Plugin
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => {
                            setAltTable("mapper");
                            setSelectedRecordItem(undefined);
                            setRecordSheetOpen(true);
                          }}
                        >
                          Add Mapper
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button
                    disabled={_columns.length === 0}
                    onClick={addData}
                    variant="ghost"
                    size="icon"
                  >
                    <ListPlus className="h-4 w-4" />
                    <span className="sr-only">Add Record</span>
                  </Button>
                )}
              </TooltipTrigger>
              <TooltipContent>Add Record</TooltipContent>
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
                    const primaryKeys = (data?.columns || [])
                      .filter((col: any) => col.primaryKey)
                      .map((col: any) => col.id);

                    const rows = _table
                      .getFilteredSelectedRowModel()
                      .rows.map((row: any) => {
                        return row.original;
                      });

                    const ids = primaryKeys
                      .map((key: any) => {
                        return rows.map((row: any) => {
                          return row[key];
                        });
                      })
                      .flat();

                    onDelete(ids);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">{`Delete Selected Record${_table.getFilteredSelectedRowModel().rows.length === 1 ? "" : "s"}`}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{`Delete Selected Record${_table.getFilteredSelectedRowModel().rows.length === 1 ? "" : "s"}`}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <Separator orientation="vertical" className="mx-2 min-h-6" />
      </div>
    );
  };

  return (
    <ContentLayout nav={navComponents()}>
      <div
        className={cn(
          "flex flex-col min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)] w-full h-full",
        )}
      >
        <div className="flex w-full h-full flex-col overflow-auto min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)]">
          <div className="flex flex-1 border-b ">
            {isLoading || isRefetching ? (
              <div className="flex min-h-[calc(100vh-26px-58px-36px)] max-h-[calc(100vh-26px-36px)] flex-col items-center justify-center h-full w-full relative">
                <LoadingSpinner />
              </div>
            ) : schema === undefined ||
              (schema && _table.getRowModel().rows?.length === 0) ? (
              <div className="flex min-h-[calc(100vh-26px-58px-36px)] max-h-[calc(100vh-26px-58px-36px)] flex-col items-center justify-center h-full w-full relative">
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
                    <CardTitle>{t("app:archive.title")}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm border py-4">
                    {schema && _table.getRowModel().rows?.length === 0
                      ? `"${table?.toUpperCase()}" table found in "${schema?.toUpperCase()}" database, has no data`
                      : "Select a database table from the panel above to view its data"}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Table
                className={cn(
                  ((data && data.items) || []).length === 0 ? "h-full" : "",
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
                              //TODO improve this part
                              if (table && table === "plugins") {
                                if (row.original) {
                                  const _item = row.original as any;
                                  const pluginType = _item.pluginType;
                                  if (pluginType === "mapper") {
                                    const config = _item.config;
                                    if (config && typeof config === "string") {
                                      const _config = JSON.parse(config);
                                      _item.oclUrl = _config.oclUrl;
                                      _item.orgId = _config.orgId;
                                      _item.sourceId = _config.sourceId;
                                      _item.auth = _config.auth || "";
                                    }

                                    setAltTable("mapper");
                                  } else setAltTable(undefined);
                                }
                              }
                              setSelectedRecordItem(row.original);
                              setRecordSheetOpen(true);
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
            )}
          </div>
          <DataTablePagination table={_table} />

          <SchemaRecordSheet
            isOpen={isRecordSheetOpen}
            data={{
              columns: data ? data.columns : [],
              table: altTable || table,
              schema: schema,
            }}
            onSubmit={onSubmit}
            onDelete={onDelete}
            onCleared={onCleared}
            value={selectedRecordItem}
            setOpen={setRecordSheetOpen}
            onOpenChange={(value: boolean) => {
              if (!value) setSelectedRecordItem(undefined);
              setRecordSheetOpen(value);
            }}
          />

          <SchemaSheet
            isOpen={isSchemaSheetOpen}
            // data={data}
            value={selectedRecordItem}
            setOpen={setSchemaSheetOpen}
            onOpenChange={(value: boolean) => {
              // if (!value) setSelectedSchemaItem(undefined);
              setSchemaSheetOpen(value);
            }}
          />
        </div>
      </div>
    </ContentLayout>
  );
}

export default ArchivePage;
