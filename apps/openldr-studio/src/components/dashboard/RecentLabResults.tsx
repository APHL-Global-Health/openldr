// import { useState, useMemo } from "react";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "@/components/ui/table";
// import { Input } from "@/components/ui/input";
// import { Search } from "lucide-react";
// import { cn } from "@/lib/utils";
// import type { RecentLabResult } from "@/types/database";

// interface RecentLabResultsProps {
//   results: RecentLabResult[];
// }

// const FLAG_STYLES: Record<string, { bg: string; text: string; label: string }> =
//   {
//     N: {
//       bg: "bg-emerald-50 dark:bg-emerald-950/30",
//       text: "text-emerald-700 dark:text-emerald-400",
//       label: "Normal",
//     },
//     H: {
//       bg: "bg-red-50 dark:bg-red-950/30",
//       text: "text-red-700 dark:text-red-400",
//       label: "High",
//     },
//     L: {
//       bg: "bg-blue-50 dark:bg-blue-950/30",
//       text: "text-blue-700 dark:text-blue-400",
//       label: "Low",
//     },
//     A: {
//       bg: "bg-amber-50 dark:bg-amber-950/30",
//       text: "text-amber-700 dark:text-amber-400",
//       label: "Abnormal",
//     },
//     R: {
//       bg: "bg-red-50 dark:bg-red-950/30",
//       text: "text-red-700 dark:text-red-400",
//       label: "Resistant",
//     },
//     S: {
//       bg: "bg-emerald-50 dark:bg-emerald-950/30",
//       text: "text-emerald-700 dark:text-emerald-400",
//       label: "Susceptible",
//     },
//     I: {
//       bg: "bg-orange-50 dark:bg-orange-950/30",
//       text: "text-orange-700 dark:text-orange-400",
//       label: "Intermediate",
//     },
//   };

// function FlagBadge({ flag }: { flag: string }) {
//   const style = FLAG_STYLES[flag?.toUpperCase()] || {
//     bg: "bg-muted",
//     text: "text-muted-foreground",
//     label: flag || "—",
//   };

//   return (
//     <span
//       className={cn(
//         "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
//         style.bg,
//         style.text,
//       )}
//     >
//       {style.label}
//     </span>
//   );
// }

// function formatDateTime(iso: string): string {
//   try {
//     const d = new Date(iso);
//     return d.toLocaleDateString("en-US", {
//       month: "short",
//       day: "numeric",
//       hour: "2-digit",
//       minute: "2-digit",
//       hour12: false,
//     });
//   } catch {
//     return iso;
//   }
// }

// export function RecentLabResults({ results }: RecentLabResultsProps) {
//   const [search, setSearch] = useState("");

//   const filtered = useMemo(() => {
//     if (!search.trim()) return results;
//     const q = search.toLowerCase();
//     return results.filter(
//       (r) =>
//         r.facilityName?.toLowerCase().includes(q) ||
//         r.panelDesc?.toLowerCase().includes(q) ||
//         r.observationDesc?.toLowerCase().includes(q) ||
//         r.rptResult?.toLowerCase().includes(q) ||
//         r.patientId?.toLowerCase().includes(q),
//     );
//   }, [results, search]);

//   return (
//     <Card>
//       <CardHeader className="pb-2">
//         <div className="flex items-center justify-between gap-4">
//           <CardTitle className="text-sm font-medium">
//             Recent Lab Results
//           </CardTitle>
//           <div className="relative max-w-55">
//             <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
//             <Input
//               placeholder="Search results…"
//               value={search}
//               onChange={(e) => setSearch(e.target.value)}
//               className="h-8 pl-8 text-xs"
//             />
//           </div>
//         </div>
//       </CardHeader>
//       <CardContent className="p-0">
//         <div className="max-h-100 overflow-auto">
//           <Table>
//             <TableHeader>
//               <TableRow>
//                 <TableHead className="text-[10px] sticky top-0 bg-card">
//                   Time
//                 </TableHead>
//                 <TableHead className="text-[10px] sticky top-0 bg-card">
//                   Facility
//                 </TableHead>
//                 <TableHead className="text-[10px] sticky top-0 bg-card">
//                   Patient
//                 </TableHead>
//                 <TableHead className="text-[10px] sticky top-0 bg-card">
//                   Panel
//                 </TableHead>
//                 <TableHead className="text-[10px] sticky top-0 bg-card">
//                   Observation
//                 </TableHead>
//                 <TableHead className="text-[10px] sticky top-0 bg-card">
//                   Result
//                 </TableHead>
//                 <TableHead className="text-[10px] sticky top-0 bg-card">
//                   Units
//                 </TableHead>
//                 <TableHead className="text-[10px] sticky top-0 bg-card">
//                   Flag
//                 </TableHead>
//               </TableRow>
//             </TableHeader>
//             <TableBody>
//               {filtered.length > 0 ? (
//                 filtered.map((r) => (
//                   <TableRow key={r.labResultsId} className="group">
//                     <TableCell className="text-xs py-2 whitespace-nowrap text-muted-foreground">
//                       {formatDateTime(r.resultTimestamp)}
//                     </TableCell>
//                     <TableCell className="text-xs py-2 max-w-30 truncate">
//                       {r.facilityName}
//                     </TableCell>
//                     <TableCell className="text-xs py-2 font-mono text-muted-foreground">
//                       {r.patientId}
//                     </TableCell>
//                     <TableCell className="text-xs py-2 max-w-25 truncate">
//                       {r.panelDesc}
//                     </TableCell>
//                     <TableCell className="text-xs py-2 max-w-30 truncate">
//                       {r.observationDesc}
//                     </TableCell>
//                     <TableCell className="text-xs py-2 font-mono font-medium">
//                       {r.rptResult}
//                     </TableCell>
//                     <TableCell className="text-xs py-2 text-muted-foreground">
//                       {r.rptUnits}
//                     </TableCell>
//                     <TableCell className="text-xs py-2">
//                       <FlagBadge flag={r.rptFlag} />
//                     </TableCell>
//                   </TableRow>
//                 ))
//               ) : (
//                 <TableRow>
//                   <TableCell
//                     colSpan={8}
//                     className="text-center text-xs text-muted-foreground py-8"
//                   >
//                     {search ? "No matching results" : "No recent results"}
//                   </TableCell>
//                 </TableRow>
//               )}
//             </TableBody>
//           </Table>
//         </div>
//       </CardContent>
//     </Card>
//   );
// }
