// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { Button } from "@/components/ui/button";
// import { RefreshCw, Calendar, Filter } from "lucide-react";
// import type { DashboardFilters, DatePreset } from "@/types/database";
// import { cn } from "@/lib/utils";

// interface DashboardFilterBarProps {
//   filters: DashboardFilters;
//   datePreset: DatePreset;
//   onDatePresetChange: (preset: DatePreset) => void;
//   onFiltersChange: (filters: Partial<DashboardFilters>) => void;
//   onRefresh: () => void;
//   loading?: boolean;
//   /** Lists for select dropdowns — populated from API or static */
//   facilities?: Array<{ code: string; name: string }>;
//   projects?: Array<{ id: string; name: string }>;
//   useCases?: Array<{ id: string; name: string }>;
// }

// const DATE_PRESETS: { value: DatePreset; label: string }[] = [
//   { value: "today", label: "Today" },
//   { value: "7d", label: "7 Days" },
//   { value: "30d", label: "30 Days" },
//   { value: "90d", label: "90 Days" },
//   { value: "1y", label: "1 Year" },
// ];

// export function DashboardFilterBar({
//   filters,
//   datePreset,
//   onDatePresetChange,
//   onFiltersChange,
//   onRefresh,
//   loading = false,
//   facilities = [],
//   projects = [],
//   useCases = [],
// }: DashboardFilterBarProps) {
//   const activeFilterCount = [
//     filters.facilityCode,
//     filters.projectId,
//     filters.useCaseId,
//   ].filter(Boolean).length;

//   return (
//     <div className="flex flex-wrap items-center gap-3">
//       {/* Date preset pills */}
//       <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-0.5">
//         <Calendar className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
//         {DATE_PRESETS.map((preset) => (
//           <button
//             key={preset.value}
//             onClick={() => onDatePresetChange(preset.value)}
//             className={cn(
//               "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
//               datePreset === preset.value
//                 ? "bg-primary text-primary-foreground shadow-sm"
//                 : "text-muted-foreground hover:text-foreground hover:bg-muted",
//             )}
//           >
//             {preset.label}
//           </button>
//         ))}
//       </div>

//       {/* Database selector */}
//       <Select
//         value={filters.database}
//         onValueChange={(val) =>
//           onFiltersChange({ database: val as DashboardFilters["database"] })
//         }
//       >
//         <SelectTrigger className="h-8 w-40 text-xs">
//           <SelectValue placeholder="Database" />
//         </SelectTrigger>
//         <SelectContent>
//           <SelectItem value="openldr">openldr</SelectItem>
//           <SelectItem value="openldr_external">openldr_external</SelectItem>
//         </SelectContent>
//       </Select>

//       {/* Facility filter */}
//       {facilities.length > 0 && (
//         <Select
//           value={filters.facilityCode || "__all__"}
//           onValueChange={(val) =>
//             onFiltersChange({
//               facilityCode: val === "__all__" ? undefined : val,
//             })
//           }
//         >
//           <SelectTrigger className="h-8 w-45 text-xs">
//             <SelectValue placeholder="All Facilities" />
//           </SelectTrigger>
//           <SelectContent>
//             <SelectItem value="__all__">All Facilities</SelectItem>
//             {facilities.map((f) => (
//               <SelectItem key={f.code} value={f.code}>
//                 {f.name}
//               </SelectItem>
//             ))}
//           </SelectContent>
//         </Select>
//       )}

//       {/* Project filter */}
//       {projects.length > 0 && (
//         <Select
//           value={filters.projectId || "__all__"}
//           onValueChange={(val) =>
//             onFiltersChange({
//               projectId: val === "__all__" ? undefined : val,
//             })
//           }
//         >
//           <SelectTrigger className="h-8 w-40 text-xs">
//             <SelectValue placeholder="All Projects" />
//           </SelectTrigger>
//           <SelectContent>
//             <SelectItem value="__all__">All Projects</SelectItem>
//             {projects.map((p) => (
//               <SelectItem key={p.id} value={p.id}>
//                 {p.name}
//               </SelectItem>
//             ))}
//           </SelectContent>
//         </Select>
//       )}

//       {/* Use case filter */}
//       {useCases.length > 0 && (
//         <Select
//           value={filters.useCaseId || "__all__"}
//           onValueChange={(val) =>
//             onFiltersChange({
//               useCaseId: val === "__all__" ? undefined : val,
//             })
//           }
//         >
//           <SelectTrigger className="h-8 w-40 text-xs">
//             <SelectValue placeholder="All Use Cases" />
//           </SelectTrigger>
//           <SelectContent>
//             <SelectItem value="__all__">All Use Cases</SelectItem>
//             {useCases.map((u) => (
//               <SelectItem key={u.id} value={u.id}>
//                 {u.name}
//               </SelectItem>
//             ))}
//           </SelectContent>
//         </Select>
//       )}

//       {/* Active filter badge */}
//       {activeFilterCount > 0 && (
//         <span className="flex items-center gap-1 text-xs text-muted-foreground">
//           <Filter className="h-3 w-3" />
//           {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
//           <button
//             className="ml-1 underline hover:text-foreground"
//             onClick={() =>
//               onFiltersChange({
//                 facilityCode: undefined,
//                 projectId: undefined,
//                 useCaseId: undefined,
//               })
//             }
//           >
//             Clear
//           </button>
//         </span>
//       )}

//       {/* Refresh */}
//       <div className="ml-auto">
//         <Button
//           variant="ghost"
//           size="sm"
//           onClick={onRefresh}
//           disabled={loading}
//           className="h-8 gap-1.5 text-xs"
//         >
//           <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
//           Refresh
//         </Button>
//       </div>
//     </div>
//   );
// }
