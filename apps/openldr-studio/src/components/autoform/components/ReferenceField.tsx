import { Input } from "@/components/ui/input";
import { type AutoFormFieldProps } from "@/lib/autoform/react";
import React, {
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
} from "react";
import { extractOption } from "@/lib/schemaUtils";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";

import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useKeycloakClient } from "@/components/react-keycloak-provider";
import * as SchemaRestClient from "@/lib/restClients/schemaRestClient";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/table";

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
import { cn } from "@/lib/utils";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DoubleArrowLeftIcon,
  DoubleArrowRightIcon,
  CheckIcon,
  CopyIcon,
} from "@radix-ui/react-icons";

import { useCopyToClipboard } from "@/hooks/misc/useCopyToClipboard";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { SearchIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export type CustomColumnDef<TData, TValue> = ColumnDef<TData, TValue> & {
  className?: string;
  customComponent?: React.ReactElement;
};

export const ReferenceField: React.FC<AutoFormFieldProps> = ({
  field,
  value,
  inputProps,
  error,
  id,
}) => {
  const { key, ...props } = inputProps;

  const { copyToClipboard, isCopied } = useCopyToClipboard();

  const [isSheetOpen, setSheetOpen] = useState(false);
  const [data, setData] = useState<any | undefined>(undefined);
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 100,
  });

  const refTableContainer = useRef<HTMLTableElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const client = useKeycloakClient();

  const reference = extractOption("reference", field.options) as any;
  const title = `Reference: ${reference?.table || ""}`;

  useEffect(() => {
    if (isSheetOpen) {
      loadData();
    } else setData(undefined);
  }, [isSheetOpen]);

  const loadData = async () => {
    if (reference && reference.table && reference.key) {
      const filter: any = {
        offset: pagination.pageIndex, //<--page
        limit: pagination.pageSize, //<--limit
        attributes: [],
      };
      if (reference.attributes) {
        filter.attributes.push(...reference.attributes);
      }

      if (filter.attributes && !filter.attributes.includes(reference.key)) {
        filter.attributes.push(reference.key);
      }

      const msg = await SchemaRestClient.getTableData(
        reference.table,
        filter,
        client.kc.token,
      );

      const { count, rows } = msg.data;
      setData({
        key: reference.key,
        totalPages: Math.ceil(count / pagination.pageSize),
        items: rows,
        columns: (reference.attributes || []).map((row) => {
          return {
            id: row,
            name: row
              .replace(/([A-Z]+)/g, " $1") // Handle consecutive capitals
              .replace(/([A-Z][a-z])/g, " $1") // Handle normal capitals
              .trim()
              .replace(/^./, (str) => str.toUpperCase())
              .replace(/\s+/g, " "), // Clean up multiple spaces
            type: "string",
            nullable: true,
            primaryKey: false,
            constraint: undefined,
          };
        }),
      });
    }
  };

  const onOpenSheetClick = (event) => {
    event.preventDefault();
    setSheetOpen(true);
  };

  const handleRowClick = (rowData) => {
    if (data && data.key) {
      const value = rowData[data.key];

      if (inputRef.current) {
        inputRef.current.value = value;
      }

      const event = {
        target: {
          name: field.key,
          value: value,
        },
      };
      inputProps.onChange(event);

      setSheetOpen(false);
    }
  };

  const handleCopyClick = (event) => {
    event.preventDefault();
    if (inputRef.current && inputRef.current.value) {
      copyToClipboard(inputRef.current.value);
    }
  };

  const columns: CustomColumnDef<unknown, unknown>[] = [
    ...(data && data.columns && data.columns.length > 0
      ? data.columns
      : []
    ).map((col) => ({
      header: col.name.charAt(0).toUpperCase() + col.name.slice(1),
      id: col.id,
      accessorKey: col.id,
      className: "cursor-default whitespace-nowrap",
      enableSorting: false,
      enableHiding: false,
    })),
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

  const enhancedComponent = (
    component: React.ReactElement | undefined,
    type: string | React.JSXElementConstructor<any>,
    props?: (Partial<any> & React.Attributes) | undefined,
  ): React.ReactElement | undefined => {
    return component && isValidElement(component) && component.type === type
      ? cloneElement(component, props)
      : component;
  };

  return (
    <div className="w-full">
      <ButtonGroup className="w-full">
        <Input
          id={id}
          {...props}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          readOnly
          ref={inputRef}
          defaultValue={value}
        />
        <Button
          variant="outline"
          aria-label="Options"
          onClick={handleCopyClick}
        >
          {isCopied ? <CheckIcon /> : <CopyIcon />}
        </Button>
        <Button
          variant="outline"
          aria-label="Options"
          onClick={onOpenSheetClick}
        >
          <ChevronRightIcon />
        </Button>
      </ButtonGroup>

      <Sheet open={isSheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader className="border-b pb-0">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription></SheetDescription>
          </SheetHeader>
          <div className="flex w-full items-center px-2 py-0 my-0">
            <InputGroup className="rounded-xs">
              <InputGroupInput placeholder="Search" />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label="Search"
                  title="Search"
                  size="icon-xs"
                  onClick={() => {
                    //search
                  }}
                >
                  <SearchIcon />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </div>
          <Separator />
          <div className="flex flex-1 ">
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
                      const customComponent = columnDefinition.customComponent;

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
                    onClick={() => handleRowClick(row.original)}
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
          <div className="flex items-center justify-between px-0 text-foreground-default border-t">
            <div className="flex items-center space-x-6 lg:space-x-8">
              <div className="flex items-center space-x-2">
                <Select
                  value={`${_table.getState().pagination.pageSize}`}
                  onValueChange={(value) => {
                    _table.setPageSize(Number(value));
                  }}
                >
                  <SelectTrigger className="h-8 w-22.5 rounded-none">
                    <SelectValue
                      placeholder={_table.getState().pagination.pageSize}
                    />
                  </SelectTrigger>
                  <SelectContent side="top" className="text-xs">
                    {[100, 500, 1000].map((pageSize) => (
                      <SelectItem key={pageSize} value={`${pageSize}`}>
                        {pageSize}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex w-25 items-center justify-center text-xs font-medium cursor-default">
                Page {_table.getState().pagination.pageIndex + 1} of{" "}
                {_table.getPageCount()}
              </div>
              <div className="flex items-center">
                <Button
                  variant="outline"
                  className="hidden h-8 w-8 p-0 lg:flex rounded-none"
                  onClick={() => _table.setPageIndex(0)}
                  disabled={!_table.getCanPreviousPage()}
                >
                  <span className="sr-only">Go to first page</span>
                  <DoubleArrowLeftIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="h-8 w-8 p-0 rounded-none"
                  onClick={() => _table.previousPage()}
                  disabled={!_table.getCanPreviousPage()}
                >
                  <span className="sr-only">Go to previous page</span>
                  <ChevronLeftIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="h-8 w-8 p-0 rounded-none"
                  onClick={() => _table.nextPage()}
                  disabled={!_table.getCanNextPage()}
                >
                  <span className="sr-only">Go to next page</span>
                  <ChevronRightIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="hidden h-8 w-8 p-0 lg:flex rounded-none"
                  onClick={() => _table.setPageIndex(_table.getPageCount() - 1)}
                  disabled={!_table.getCanNextPage()}
                >
                  <span className="sr-only">Go to last page</span>
                  <DoubleArrowRightIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
