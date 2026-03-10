// import React, { useState } from "react";
// import {
//   DndContext,
//   closestCenter,
//   PointerSensor,
//   TouchSensor,
//   useSensor,
//   useSensors,
//   type DragEndEvent,
// } from "@dnd-kit/core";
// import {
//   SortableContext,
//   verticalListSortingStrategy,
//   arrayMove,
// } from "@dnd-kit/sortable";
// import { useFormBuilderStore, useActiveForm } from "@/store/formBuilderStore";
// import { FieldCard } from "./FieldCard";
// import { AddFieldPanel } from "./AddFieldPanel";
// import { FormSelector } from "./FormSelector";
// import { Button } from "@/components/ui/button";

// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuGroup,
//   DropdownMenuItem,
//   DropdownMenuRadioGroup,
//   DropdownMenuRadioItem,
//   DropdownMenuSeparator,
//   DropdownMenuSub,
//   DropdownMenuSubContent,
//   DropdownMenuSubTrigger,
//   DropdownMenuTrigger,
// } from "@/components/ui/dropdown-menu";

// import { toast } from "sonner";

// import {
//   ButtonGroup,
//   ButtonGroupSeparator,
// } from "@/components/ui/button-group";
// import { MoreHorizontalIcon, Pencil, Plus, Trash2Icon } from "lucide-react";

// import {
//   Select,
//   SelectContent,
//   SelectGroup,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { useKeycloakClient } from "@/components/react-keycloak-provider";
// import { useQuery } from "@tanstack/react-query";
// import type { TableData } from "@/pages/ArchivePage";

// import * as SchemaRestClient from "@/lib/restClients/schemaRestClient";
// import SchemaRecordSheet from "../schema-record-sheet";
// import { manipulateData } from "@/lib/restClients/schemaRestClient";

// export const BuilderSidebar: React.FC = () => {
//   // const {
//   //   forms,
//   //   activeFormId,
//   //   setActiveFormId,
//   //   createForm,
//   //   deleteForm,
//   //   addField,
//   //   removeField,
//   //   updateField,
//   //   reorderFields,
//   //   toggleFieldExpanded,
//   // } = useFormBuilderStore();

//   const client = useKeycloakClient();

//   const activeForm = useActiveForm();
//   const [showAddPanel, setShowAddPanel] = useState(false);

//   const [isEditMode, setEditMode] = useState(false);

//   const [schema, setSchema] = useState<string | undefined>("Internal");
//   const [table, setTable] = useState<string | undefined>("formSchemas");

//   const [activeFormId, setActiveFormId] = useState<string | undefined>(
//     undefined,
//   );

//   const [selectedRecordItem, setSelectedRecordItem] = useState<any | undefined>(
//     undefined,
//   );

//   const [isRecordSheetOpen, setRecordSheetOpen] = useState(false);

//   const { data, refetch, isLoading, isRefetching } = useQuery<TableData>({
//     queryKey: ["Data", "ProjectsPage", table, schema],
//     queryFn: async () => {
//       if (table && schema) {
//         const filter: any = {};

//         const cols = await SchemaRestClient.getTableColumns(
//           table,
//           client.kc.token,
//         );

//         const msg = await SchemaRestClient.getTableData(
//           table,
//           filter,
//           client.kc.token,
//         );

//         const { count, rows } = msg.data;

//         return {
//           totalPages: 1,
//           items: rows,
//           columns: (cols?.data || []).map((row) => {
//             return {
//               id: row.Name,
//               name: row.Name.replace(/([A-Z]+)/g, " $1") // Handle consecutive capitals
//                 .replace(/([A-Z][a-z])/g, " $1") // Handle normal capitals
//                 .trim()
//                 .replace(/^./, (str) => str.toUpperCase())
//                 .replace(/\s+/g, " "), // Clean up multiple spaces
//               type: row.Type,
//               nullable: row.Nullable,
//               primaryKey: row.PrimaryKey || false,
//               constraint: row.Constraint,
//             };
//           }),
//         };
//       }
//       return { items: [] };
//     },
//     refetchInterval: false,
//     refetchOnMount: true,
//     refetchOnWindowFocus: false,
//     refetchOnReconnect: false,
//     refetchIntervalInBackground: false,
//   });

//   const sensors = useSensors(
//     useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
//     useSensor(TouchSensor, {
//       activationConstraint: { delay: 200, tolerance: 5 },
//     }),
//   );

//   const handleDragEnd = (event: DragEndEvent) => {
//     const { active, over } = event;
//     if (!over || active.id === over.id || !activeForm) return;
//     const oldIndex = activeForm.fields.findIndex((f) => f.id === active.id);
//     const newIndex = activeForm.fields.findIndex((f) => f.id === over.id);
//     // reorderFields(arrayMove(activeForm.fields, oldIndex, newIndex));
//   };

//   const onSubmit = async (data: any) => {
//     let _data = data;
//     if (selectedRecordItem) {
//       _data = {
//         ...selectedRecordItem,
//         ...data,
//       };
//     }

//     if (table && schema) {
//       const keys = [_data];
//       const results = await Promise.allSettled(
//         keys.map((item) => {
//           return manipulateData(
//             table,
//             schema,
//             "archive",
//             _data,
//             client.kc.token,
//             !isEditMode ? "POST" : "PUT",
//           );
//         }),
//       );

//       const successful = results.filter((r: any) => r.status === "fulfilled");
//       const failed = results.filter((r: any) => r.status === "rejected");
//       if (successful.length > 0) {
//         toast.success(
//           `(${successful.length}) ${
//             !selectedRecordItem ? "created" : "updated"
//           } successfully`,
//           {
//             className: "bg-card text-card-foreground border-border",
//           },
//         );
//       }
//       if (failed.length > 0) {
//         toast.error(
//           `Failed to ${
//             !selectedRecordItem ? "create" : "update"
//           }. Please try again.`,
//           {
//             className: "bg-card text-card-foreground border-border",
//           },
//         );
//       }
//       refetch();
//       setSelectedRecordItem(undefined);
//       setRecordSheetOpen(false);
//     }
//   };

//   const onDelete = async (data: any, _table?: string, _schema?: string) => {
//     const effectiveTable = _table ?? table;
//     const effectiveSchema = _schema ?? schema;
//     if (effectiveTable && effectiveSchema) {
//       const keys = [data];
//       console.log("onDelete", effectiveTable, effectiveSchema, data);
//       const results = await Promise.allSettled(
//         keys.map((item) => {
//           return manipulateData(
//             effectiveTable,
//             effectiveSchema,
//             "archive",
//             data,
//             client.kc.token,
//             "DELETE",
//           );
//         }),
//       );

//       // console.log("onDelete", results);

//       const successful = results.filter((r: any) => r.status === "fulfilled");
//       const failed = results.filter((r: any) => r.status === "rejected");
//       if (successful.length > 0) {
//         toast.success(`(${successful.length}) dleted successfully`, {
//           className: "bg-card text-card-foreground border-border",
//         });
//       }
//       if (failed.length > 0) {
//         toast.error(`Failed to delete. Please try again.`, {
//           className: "bg-card text-card-foreground border-border",
//         });
//       }
//       refetch();
//       setSelectedRecordItem(undefined);
//       setRecordSheetOpen(false);
//     }
//   };

//   const EditData = (
//     schema: string,
//     table: string,
//     item: any = undefined,
//     editMode: boolean = false,
//   ) => {
//     console.log(schema, table, item);
//     setEditMode(editMode);
//     setSchema(schema);
//     setTable(table);
//     setSelectedRecordItem(item);
//     setRecordSheetOpen(true);
//   };

//   const DeleteData = (schema: string, table: string, item: any = undefined) => {
//     setSchema(schema);
//     setTable(table);
//     onDelete(item, table, schema);
//   };

//   console.log(data?.items);

//   return (
//     <div className="flex flex-col h-full overflow-hidden">
//       {/* ── Top section (sticky) ── */}
//       <div className="flex-shrink-0 border-b border-border space-y-4">
//         <ButtonGroup className="w-full p-3 focus-visible:outline-none">
//           <Select
//             disabled={data?.items.length === 0}
//             value={activeFormId || undefined}
//             onValueChange={setActiveFormId}
//           >
//             <SelectTrigger className="flex flex-1 rounded-sm text-sm focus-visible:outline-none">
//               <SelectValue placeholder="Form" />
//             </SelectTrigger>
//             <SelectContent
//               className="rounded-xs"
//               side="bottom"
//               avoidCollisions={false}
//               position="popper"
//             >
//               <SelectGroup>
//                 {data?.items?.map((f: any) => {
//                   return (
//                     // <SelectItem value={f.schemaId} description={f.description}>
//                     <SelectItem value={f.schemaId}>{f.schemaName}</SelectItem>
//                   );
//                 })}
//               </SelectGroup>
//             </SelectContent>
//           </Select>
//           <div className="flex justify-center items-center min-h-9 max-h-9 w-[0.5px]">
//             <div className="flex bg-border min-h-7 max-h-7  w-[0.5px]"></div>
//           </div>
//           <DropdownMenu>
//             <DropdownMenuTrigger
//               asChild
//               className="disabled:cursor-not-allowed"
//             >
//               <Button
//                 className="rounded-sm disabled:cursor-not-allowed"
//                 variant="outline"
//                 size="icon"
//                 aria-label="More Options"
//               >
//                 <MoreHorizontalIcon />
//               </Button>
//             </DropdownMenuTrigger>
//             <DropdownMenuContent align="end" className="w-40">
//               <DropdownMenuGroup>
//                 <DropdownMenuItem
//                   onClick={() => EditData("Internal", "formSchemas")}
//                 >
//                   <Plus width={16} height={16} />
//                   New
//                 </DropdownMenuItem>
//                 <DropdownMenuItem
//                 // disabled={!activeFormId}
//                 // onClick={() => {
//                 //   const item = forms.find(
//                 //     (uc: any) => uc.projectId === activeFormId!,
//                 //   );
//                 //   EditData("Internal", "formSchemas", item, true);
//                 // }}
//                 >
//                   <Pencil width={16} height={16} />
//                   Edit
//                 </DropdownMenuItem>
//               </DropdownMenuGroup>
//               <DropdownMenuSeparator />
//               <DropdownMenuGroup>
//                 <DropdownMenuItem
//                   variant="destructive"
//                   // disabled={!activeFormId}
//                   // onClick={() => {
//                   //   deleteForm(activeFormId!);
//                   // }}
//                 >
//                   <Trash2Icon />
//                   Delete
//                 </DropdownMenuItem>
//               </DropdownMenuGroup>
//             </DropdownMenuContent>
//           </DropdownMenu>
//         </ButtonGroup>
//       </div>

//       {/* ── Fields header ── */}
//       <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-border">
//         <span className="text-[10px] font-bold uppercase tracking-widest ">
//           Fields {activeForm ? `(${activeForm.fields.length})` : ""}
//         </span>
//         {activeForm && (
//           <Button
//             size="sm"
//             variant="ghost"
//             className="border border-border"
//             onClick={() => setShowAddPanel((v) => !v)}
//           >
//             <span className="text-base leading-none">+</span>
//             Add Field
//           </Button>
//         )}
//       </div>

//       {/* ── Add panel (inline) ── */}
//       {showAddPanel && (
//         <div className="flex-shrink-0 px-3 py-2 border-b border-border">
//           <AddFieldPanel
//             inline
//             onAdd={(type) => {
//               // addField(type);
//             }}
//             onClose={() => setShowAddPanel(false)}
//           />
//         </div>
//       )}

//       {/* ── Field list (scrollable) ── */}
//       <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
//         {!activeForm && (
//           <div className="flex flex-col items-center justify-center h-40 gap-3 ">
//             <svg
//               width="36"
//               height="36"
//               viewBox="0 0 24 24"
//               fill="none"
//               stroke="currentColor"
//               strokeWidth="1.5"
//             >
//               <rect x="3" y="3" width="18" height="18" rx="3" />
//               <path d="M9 12h6M12 9v6" />
//             </svg>
//             <p className="text-sm">Select or create a form above</p>
//           </div>
//         )}

//         {activeForm && activeForm.fields.length === 0 && !showAddPanel && (
//           <div className="flex flex-col items-center justify-center h-48 gap-3 ">
//             <svg
//               width="40"
//               height="40"
//               viewBox="0 0 24 24"
//               fill="none"
//               stroke="currentColor"
//               strokeWidth="1.2"
//             >
//               <rect x="2" y="5" width="20" height="14" rx="2" />
//               <path d="M8 10h8M8 14h5" />
//             </svg>
//             <p className="text-sm font-medium">No fields yet</p>
//             <p className="text-xs">Click "+ Add Field" to start building</p>
//           </div>
//         )}

//         {/* <DndContext
//           sensors={sensors}
//           collisionDetection={closestCenter}
//           onDragEnd={handleDragEnd}
//         >
//           <SortableContext
//             items={activeForm?.fields.map((f) => f.id) ?? []}
//             strategy={verticalListSortingStrategy}
//           >
//             <div className="space-y-2">
//               {activeForm?.fields.map((field) => (
//                 <FieldCard
//                   key={field.id}
//                   field={field}
//                   onUpdate={(patch) => updateField(field.id, patch)}
//                   onRemove={() => removeField(field.id)}
//                   onToggleExpand={() => toggleFieldExpanded(field.id)}
//                 />
//               ))}
//             </div>
//           </SortableContext>
//         </DndContext> */}
//       </div>

//       {/* ── Modal ─────────────────────────────────────────────────────────── */}
//       <SchemaRecordSheet
//         isOpen={isRecordSheetOpen}
//         data={{
//           columns: data ? data.columns : [],
//           table: table || "",
//           schema: schema || "",
//         }}
//         onSubmit={onSubmit}
//         onDelete={onDelete}
//         onCleared={() => {
//           // handle function
//         }}
//         value={selectedRecordItem}
//         setOpen={setRecordSheetOpen}
//         onOpenChange={(value: boolean) => {
//           if (!value) setSelectedRecordItem(undefined);
//           setRecordSheetOpen(value);
//         }}
//       />
//     </div>
//   );
// };
