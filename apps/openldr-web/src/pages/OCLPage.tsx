"use client";
import { LoadingSpinner } from "@/components/loading-spinner";
import LogoutOptions from "@/components/logout-options";
import { Separator } from "@/components/ui/separator";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, useNavigate, useParams } from "react-router-dom";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/table";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import {
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { DataTablePagination } from "@/components/datatable/data-table-pagination";
import SchemaRecordSheet from "@/components/forms/schema-record-sheet";
import SchemaSheet from "@/components/forms/schema-sheet";
import { cn } from "@/lib/utils";
import { useKeycloakClient } from "@/components/react-keycloak-provider";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
} from "react";
import useWindowSize from "@/hooks/misc/useWindowSize";
import { useSideBarContext } from "@/components/sidebar-provider";

import { Button } from "@/components/ui/button";
import { ListPlus, Trash2 } from "lucide-react";
import { CustomColumnDef } from "@/types/database";
import { Checkbox } from "@/components/ui/checkbox";
import { LanguageSwitcher } from "@/components/language-switcher";

const ENV = import.meta.env;

const fetchApi = async (token: any, signal?) => {
  const response = await fetch(ENV.VITE_OCL_URL, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    signal: signal,
  });

  return await response.json();
};

const fetchData = async (options: any, token: any, signal?) => {
  const { route, org, source, concept } = options;

  if (route === undefined || route === "orgs") {
    let url = `${ENV.VITE_OCL_URL}orgs/`;
    if (org) url += `${org}/sources/`;
    if (source) url += `${source}/concepts/`;
    if (concept) url += `${concept}/`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      signal: signal,
    });

    return (await response.json()).map((row) => {
      const { checksums, ...rest } = row;
      return rest;
    });
  }

  return [];
};

function OCLPage() {
  const [table, setTable] = useState<string | undefined>(undefined);
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 100,
  });

  const [isRecordSheetOpen, setRecordSheetOpen] = useState(false);
  const [selectedRecordItem, setSelectedRecordItem] = useState<any | undefined>(
    undefined
  );
  const [isSchemaSheetOpen, setSchemaSheetOpen] = useState(false);

  const ENV = import.meta.env;
  const baseUrl = ENV.VITE_BASE_URL || "/";
  //   const baseUrl = (ENV.VITE_BASE_URL || "/").replace(/\/$/, "");

  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const client = useKeycloakClient();
  const keycloak = client.kc;

  const refTableContainer = useRef<HTMLTableElement>(null);

  const windowSize = useWindowSize();
  const sideBarContext = useSideBarContext();
  const isCollapsed = sideBarContext?.isCollapsed ?? false;

  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [pageError, setPageError] = useState(null);
  const [ocl, setOcl] = useState<{
    api: any;
    data: any;
  }>({
    api: {},
    data: {
      totalPages: 0,
      items: [],
      columns: [],
    },
  });

  const [_data, setData] = useState<{
    columns: any;
  }>({
    columns: [],
  });

  // Extract the dynamic parameters from the URL
  const { route, org, source, concept } = useParams();

  useEffect(() => {
    if (keycloak.authenticated && keycloak.token) {
      const abortController = new AbortController();
      const signal = abortController.signal;
      (async () => {
        setLoading(true);
        if (route === undefined || route === "orgs") {
          try {
            const [api, data] = await Promise.all([
              fetchApi(keycloak.token, signal),
              fetchData(
                { route, org, source, concept },
                keycloak.token,
                signal
              ),
            ]);

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
                    <div className="h-3.5 w-3..5 text-foreground-lighter">
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
              ...Object.keys(data[0]).map((item) => {
                return {
                  header: item.charAt(0).toUpperCase() + item.slice(1),
                  id: item,
                  accessorKey: item,
                  className: "cursor-default whitespace-nowrap",
                  enableSorting: false,
                  enableHiding: false,
                };
              }),
            ];

            setOcl({
              api,
              data: {
                totalPages: data?.length,
                items: data,
                columns: columns,
              },
            });
          } catch (error: any) {
            setPageError(error.message || "Failed to fetch");
          } finally {
            setLoading(false);
          }
        } else setLoading(false);
      })();

      return () => {
        abortController.abort();
      };
    }
  }, [route, org, source, concept, keycloak.authenticated, keycloak.token]);

  const enhancedComponent = (
    component: React.ReactElement | undefined,
    type: string | React.JSXElementConstructor<any>,
    props?: (Partial<any> & React.Attributes) | undefined
  ): React.ReactElement | undefined => {
    return component && isValidElement(component) && component.type === type
      ? cloneElement(component, props)
      : component;
  };

  const data: any = ocl?.data;
  const columns = ocl?.data?.columns || [];

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

  const processRow = (row: any) => {
    let url = `${baseUrl}ocl${row.url}`;
    if (row.type === "Organization") {
      url += "sources/";
      navigate(url);
    } else if (row.type === "Source") {
      url += "concepts/";
      navigate(url);
    } else if (row.type === "Concept") {
      setData({
        columns: Object.entries(row).map(([key, value]) => {
          const obj = {
            id: key,
            name: key,
            type: "string",
            constraint: null,
            nullable: false,
            primaryKey: false,
            autogenerated: false,
          };
          return obj;
        }),
      });
      setSelectedRecordItem(row);
      setRecordSheetOpen(true);
    }
  };

  return (
    <div className="flex w-full h-full flex-col">
      <div className="flex min-h-13 max-h-13 w-full items-center px-2 py-2">
        <div className="max-w-6 max-h-6 flex items-center justify-center overflow-hidden">
          <img
            src={`${baseUrl}assets/oclicon.ico`}
            className="object-contains"
            alt="ocl icon"
          />
        </div>

        <Separator orientation="vertical" className="mx-2 h-6" />

        <Breadcrumb className="px-2">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <NavLink className="text-foreground" to={`${baseUrl}ocl/orgs`}>
                  orgs
                </NavLink>
              </BreadcrumbLink>
            </BreadcrumbItem>

            <BreadcrumbSeparator />
            {org !== undefined && (
              <>
                <BreadcrumbItem>
                  <BreadcrumbPage className="cursor-default">
                    {org.toLowerCase()}
                  </BreadcrumbPage>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <NavLink
                      className="text-foreground"
                      to={`${baseUrl}ocl/orgs/${org}/sources/`}
                    >
                      sources
                    </NavLink>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </>
            )}
            {source !== undefined && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="cursor-default">
                    {source.toLowerCase()}
                  </BreadcrumbPage>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <NavLink
                      className="text-foreground"
                      to={`${baseUrl}ocl/orgs/${org}/sources/${source}/concepts/`}
                    >
                      concepts
                    </NavLink>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-1"></div>

        {ocl?.api.version && (
          <div className="flex flex-row h-full items-center">
            <Separator orientation="vertical" className="mx-2 h-6" />

            <div className="text-xs px-2 cursor-default">
              {ocl?.api.version}
            </div>
          </div>
        )}

        <Separator orientation="vertical" className="mx-2 h-6" />
        <LanguageSwitcher />
        <Separator orientation="vertical" className="mx-2 h-6" />
        <LogoutOptions />
      </div>
      <Separator />
      <div className="flex w-full h-full flex-col">
        <div
          className="flex flex-1 border-b"
          style={{
            maxWidth: `${windowSize.width - (isCollapsed ? 48 : 196)}px`,
            overflow: "auto",
            maxHeight: `${windowSize.height - (52 + 1 + 32)}px`,
          }}
        >
          {loading || refetching ? (
            <div className="w-full h-full flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : (
            <Table
              className={cn(
                ((data && data.items) || []).length === 0 ? "h-full" : ""
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
                      const customComponent = columnDefinition.customComponent;

                      return (
                        <TableHead
                          key={header.id}
                          colSpan={header.colSpan}
                          className={cn(
                            className,
                            customComponent ? "pl-2.25" : ""
                          )}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {_table.getRowModel().rows.map((row: any) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    // onClick={(e) => {
                    //   e.stopPropagation();
                    //   processRow(row.original);
                    // }}
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
                            // setSelectedRecordItem(row.original);
                            // setRecordSheetOpen(true);
                            processRow(row.original);
                          },
                        }
                      );

                      return (
                        <TableCell key={cell.id} className={className}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
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
          data={_data}
          value={selectedRecordItem}
          setOpen={setRecordSheetOpen}
          onOpenChange={(value: boolean) => {
            if (!value) setSelectedRecordItem(undefined);
            setRecordSheetOpen(value);
          }}
          showButtons={false}
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
  );
}

export default OCLPage;
