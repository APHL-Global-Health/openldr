import { useState } from "react";

import type { /*ReportFilters,*/ ReportConfig } from "../types";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import PDFViewer from "@/components/pdf-viewer";
// import {
//   generatePDFReport,
//   type HeaderFooterConfig,
// } from "@/lib/reportGenerator";

// import { generateReport } from "@/lib/reportTestGenerator";
import { useKeycloakClient } from "@/components/react-keycloak-provider";
import { LoadingSpinner } from "@/components/loading-spinner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { /*addDays,*/ format } from "date-fns";
import { CalendarIcon, Loader2, Search } from "lucide-react";
import { type DateRange } from "react-day-picker";
import jsPDF from "jspdf";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const ENV = import.meta.env;
const apiUrl = ENV.VITE_API_BASE_URL || "";

const reportTypes: ReportConfig[] = [
  {
    id: "overview",
    title: "Resistance Overview",
    description: "Overall AMR statistics and summary",
    icon: "Activity",
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/20",
  },
  {
    id: "susceptibility",
    title: "Antibiotic Susceptibility",
    description: "Susceptibility patterns by antibiotic class",
    icon: "Pill",
    color: "text-green-600",
    bg: "bg-green-50 dark:bg-green-950/20",
  },
  {
    id: "organisms",
    title: "Organism Distribution",
    description: "Top organisms and resistance patterns",
    icon: "Bug",
    color: "text-purple-600",
    bg: "bg-purple-50 dark:bg-purple-950/20",
  },
  {
    id: "trends",
    title: "Trend Analysis",
    description: "Resistance trends over time",
    icon: "TrendingUp",
    color: "text-orange-600",
    bg: "bg-orange-50 dark:bg-orange-950/20",
  },
  {
    id: "geographic",
    title: "Geographic Distribution",
    description: "AMR patterns by location",
    icon: "MapPin",
    color: "text-red-600",
    bg: "bg-red-50 dark:bg-red-950/20",
  },
  {
    id: "specimen",
    title: "Specimen Type Analysis",
    description: "Resistance by specimen source",
    icon: "BarChart3",
    color: "text-cyan-600",
    bg: "bg-cyan-50 dark:bg-cyan-950/20",
  },
  {
    id: "amr-for-r",
    title: "AMR For R",
    description: "AMR For R",
    icon: "BarChart3",
    color: "text-cyan-600",
    bg: "bg-cyan-50 dark:bg-cyan-950/20",
  },
];

const fetchReportData = async (
  reportType: string,
  dateRange: DateRange | undefined,
  // filters: ReportFilters,
) => {
  try {
    const params = new URLSearchParams({
      ...(dateRange &&
        dateRange.from && { dateFrom: format(dateRange.from, "yyyy-MM-dd") }),
      ...(dateRange &&
        dateRange.to && { dateTo: format(dateRange.to, "yyyy-MM-dd") }),
      // ...Object.fromEntries(
      //   Object.entries(filters).filter(([_, v]) => v !== "" && v != null),
      // ),
      reportType,
    });

    const response = await fetch(
      `${apiUrl}/api/v1/reports/${reportType}?${params}`,
    );
    const result = await response.json();
    if (result.success) {
      return result.data;
    }
  } catch (err) {
    console.error("Failed to fetch report", err);
  }

  return null;
};

function generateTestPDF(): string {
  const doc = new jsPDF();

  // Page 1 - Header with logo area
  doc.setFillColor(41, 128, 185);
  doc.rect(0, 0, 210, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.text("OpenLDR Laboratory Report", 105, 25, { align: "center" });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.text("Patient ID: PAT-2024-001", 20, 60);
  doc.text("Sample ID: SMPL-789456", 20, 70);
  doc.text("Test Date: 2024-02-04", 20, 80);

  // Add a table-like structure
  doc.setFontSize(14);
  doc.setFont("", undefined, "bold");
  doc.text("Test Results", 20, 100);
  doc.setFont("", undefined, "normal");
  doc.setFontSize(11);

  const results = [
    ["Test Name", "Result", "Reference Range", "Unit"],
    ["Hemoglobin", "14.2", "13.0-17.0", "g/dL"],
    ["WBC Count", "7.5", "4.0-11.0", "x10³/μL"],
    ["Platelet Count", "250", "150-400", "x10³/μL"],
  ];

  let yPos = 110;
  results.forEach((row, i) => {
    if (i === 0) doc.setFont("", undefined, "bold");
    doc.text(row[0], 20, yPos);
    doc.text(row[1], 80, yPos);
    doc.text(row[2], 120, yPos);
    doc.text(row[3], 170, yPos);
    if (i === 0) doc.setFont("", undefined, "normal");
    yPos += 10;
  });

  // Page 2 - Resistance profile
  doc.addPage();
  doc.setFillColor(231, 76, 60);
  doc.rect(0, 0, 210, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text("Antimicrobial Resistance Profile", 105, 18, { align: "center" });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.text("Organism: Escherichia coli", 20, 50);
  doc.text("Isolation Date: 2024-02-02", 20, 60);

  // Add some vector graphics (circles for susceptibility)
  const antibiotics = [
    { name: "Ampicillin", status: "R" },
    { name: "Ciprofloxacin", status: "S" },
    { name: "Gentamicin", status: "I" },
    { name: "Ceftriaxone", status: "S" },
  ];

  yPos = 80;
  antibiotics.forEach(({ name, status }) => {
    doc.text(name, 20, yPos);
    const color =
      status === "R"
        ? [231, 76, 60]
        : status === "I"
          ? [241, 196, 15]
          : [46, 204, 113];
    doc.setFillColor(...(color as [number, number, number]));
    doc.circle(150, yPos - 3, 5, "F");
    doc.text(status, 170, yPos);
    yPos += 15;
  });

  // Page 3 - Footer with QR placeholder
  doc.addPage();
  doc.setFontSize(10);
  doc.text("Report generated by OpenLDR System", 20, 20);
  doc.text("Laboratory Information System", 20, 30);
  doc.text("This is an electronically generated report.", 20, 40);

  // Add a rectangle as QR placeholder
  doc.setDrawColor(0);
  doc.rect(20, 50, 50, 50, "S");
  doc.text("QR Code", 30, 80);

  doc.setFontSize(8);
  doc.text("© 2024 OpenLDR - All rights reserved", 105, 280, {
    align: "center",
  });

  return doc.output("datauristring"); //.split(",")[1];
}

function ReportsPage() {
  const client = useKeycloakClient();
  const token = client.kc?.tokenParsed;
  const user = token?.preferred_username || token?.email || "Guest";

  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [pdfReport, setPdfReport] = useState<ReportConfig | undefined>(
    undefined,
  );
  const [generating, setGenerating] = useState(false);
  const [date, setDate] = useState<DateRange | undefined>(
    undefined,
    //   {
    //   from: new Date(new Date().getFullYear(), 0, 20),
    //   to: addDays(new Date(new Date().getFullYear(), 0, 20), 20),
    // }
  );
  // const [filters, setFilters] = useState<ReportFilters>({
  //   organism: "",
  //   specimenType: "",
  //   institution: "",
  //   wardType: "",
  // });

  const handleGeneratePDF = async () => {
    if (!pdfReport /*|| !client.lab*/) {
      return;
    }

    try {
      // setGenerating(true);

      // const labName = client.lab.lab_name;
      // const labCode = client.lab.lab_code;
      // const generatedBy = user;

      // // Prepare config
      // const config: HeaderFooterConfig = {
      //   organizationName: `${pdfReport.title} Report`,
      //   reportDate: new Date().toLocaleDateString("en-US", {
      //     year: "numeric",
      //     month: "long",
      //     day: "numeric",
      //   }),
      //   labName,
      //   labCode,
      //   generatedBy,
      // };

      // // Generate PDF
      // const data = await fetchReportData(pdfReport.id, date /*, filters*/);
      // if (data !== null) {
      //   let reportBase64 = await generatePDFReport(
      //     pdfReport.id,
      //     pdfReport.title,
      //     data || {},
      //     config,
      //   );
      //   // reportBase64 = generateReport(user, "Resistance Overview Report", data);

      //   setPdfDataUrl(reportBase64);
      // }
      setPdfDataUrl(generateTestPDF());
    } catch (error: any) {
      console.error("PDF generation error:", error);
    } finally {
      setGenerating(false);
    }
  };

  const navComponents = () => {
    return (
      <div className="flex min-h-13 max-h-13 w-full items-center pr-2 py-2">
        <div className="flex flex-row items-center min-w-50 max-w-50">
          <Select
            // defaultValue={reportTypes[0].id}
            onValueChange={(value) => {
              const report = reportTypes.find((r: any) => r.id === value);
              setPdfReport(report);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Reports" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {reportTypes.map((report) => (
                  <SelectItem key={report.id} value={report.id}>
                    {report.title}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Separator orientation="vertical" className=" h-6" />
        </div>

        <Separator orientation="vertical" className="mx-2 min-h-6" />

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              id="date-picker-range"
              className="justify-start px-2.5 font-normal min-w-50 max-w-50"
            >
              <CalendarIcon />
              {date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, "LLL dd, y")} -{" "}
                    {format(date.to, "LLL dd, y")}
                  </>
                ) : (
                  format(date.from, "LLL dd, y")
                )
              ) : (
                <span>Reporting period</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={setDate}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        <div className="flex flex-1"></div>

        <div className="flex h-full items-center">
          <Separator orientation="vertical" className="mx-2 min-h-6" />
          <div className="flex">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  disabled={generating || !pdfReport}
                  variant="ghost"
                  size="icon"
                  onClick={handleGeneratePDF}
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  <span className="sr-only">Search</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <span className="ml-auto text-sm">Search</span>
              </TooltipContent>
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
          "flex flex-col min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)]  w-full h-full mx-auto",
        )}
      >
        <div className="container">
          {generating ? (
            <div className="flex flex-col min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)] items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : pdfDataUrl ? (
            <PDFViewer
              className="flex flex-col min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)] w-full"
              base64Data={pdfDataUrl}
            />
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)] w-full relative">
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

              <div className="w-75 cursor-default border border-gray-700 rounded-xs  bg-background absolute">
                <div className="py-2 px-4 border-b border-gray-700">
                  <div className="text-lg p-0 m-0">Reports</div>
                </div>
                <div className="text-sm py-4 px-4">
                  Select a report type from the options above to view its data
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ContentLayout>
  );
}

export default ReportsPage;
