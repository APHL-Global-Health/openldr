import { ContentLayout } from "@/components/admin-panel/content-layout";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/loading-spinner";
import {
  KPIGrid,
  LabActivityChart,
  SpecimenDonutChart,
  TestPanelBarChart,
  ResultFlagChart,
  DataPipeline,
  ServiceHealthGrid,
  StorageOverviewCard,
  DatabaseStatsCard,
  FacilityActivityCard,
} from "@/components/dashboard";
import { useDashboard } from "@/hooks/misc/useDashboard";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

function DashboardPage() {
  const {
    filters,
    setFilters,
    activeTab,
    loading,
    error,
    data,
    setActiveTab,
    refresh,
  } = useDashboard();

  const navComponents = () => {
    return (
      <div className="flex min-h-13 max-h-13 w-full items-center pr-2 py-2">
        <div className="flex flex-row items-center">
          <Select
            defaultValue={activeTab}
            onValueChange={(val: any) => {
              // setSelectedPage(val);
              setActiveTab(val as "laboratory" | "infrastructure");
            }}
          >
            <SelectTrigger className="focus:ring-0 w-40 h-8 justify-between ">
              <SelectValue placeholder="Dashboards" />
            </SelectTrigger>
            <SelectContent className="flex bg-background">
              <SelectItem value="laboratory">Laboratory</SelectItem>
              <SelectItem value="infrastructure">Infrastructure</SelectItem>
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
              className="justify-start px-2.5 font-normal"
            >
              <CalendarIcon />
              {filters?.dateRange?.from ? (
                filters?.dateRange?.to ? (
                  <>
                    {format(new Date(filters.dateRange.from), "yyyy-MM-dd")} -{" "}
                    {format(new Date(filters.dateRange.to), "yyyy-MM-dd")}
                  </>
                ) : (
                  format(new Date(filters.dateRange.from), "yyyy-MM-dd")
                )
              ) : (
                <span>Pick a date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              defaultMonth={new Date(filters.dateRange.from)}
              selected={{
                from: new Date(filters.dateRange.from),
                to: new Date(filters.dateRange.to),
              }}
              onSelect={(val) => {
                if (val && val.from && val.to) {
                  setFilters({
                    dateRange: {
                      from: val.from.toISOString(),
                      to: val.to.toISOString(),
                    },
                  });
                }
              }}
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
                  disabled={loading}
                  variant="ghost"
                  size="icon"
                  onClick={refresh}
                >
                  <RefreshCw
                    className={cn("h-3.5 w-3.5", loading && "animate-spin")}
                  />
                  <span className="sr-only">Refresh</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <span className="ml-auto text-sm">Refresh</span>
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
          "flex flex-col min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)] w-full h-full",
        )}
      >
        <div className="flex w-full h-full flex-col">
          {/* Filters */}
          {/* <div className="sticky top-0 z-10 border-b px-6 py-3">
            <DashboardFilterBar
              filters={filters}
              datePreset={datePreset}
              onDatePresetChange={setDatePreset}
              onFiltersChange={setFilters}
              onRefresh={refresh}
              loading={loading}
            />
          </div> */}

          {/* Error state */}
          {error && (
            <div className="flex items-center justify-center min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)] w-full">
              <div className="mx-6 mt-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/20 ">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">
                    Failed to load dashboard data
                  </p>
                  <p className="text-xs text-red-600/70 dark:text-red-400/70">
                    {error}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={refresh}>
                  Retry
                </Button>
              </div>
            </div>
          )}

          {/* Loading overlay for refresh */}
          {loading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50">
              <LoadingSpinner />
            </div>
          )}

          {/* Dashboard content */}
          {data && activeTab === "laboratory" ? (
            <div className="space-y-6 p-6 min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)] overflow-y-auto">
              {/* KPI Cards */}
              <KPIGrid kpi={data?.kpi} />

              {/* Charts row 1: Activity + Specimen + Result Flags */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="lg:col-span-1">
                  <LabActivityChart data={data?.labActivity} />
                </div>
                <div className="border-border border bg-card rounded-sm shadow grid grid-cols-1 gap-0 sm:grid-cols-2 lg:grid-cols-2">
                  <div className="border-border border-r-0 border-b sm:border-r sm:border-b-0 md:border-r md:border-b-0 lg:border-r lg:border-b-0">
                    <SpecimenDonutChart data={data?.specimenDistribution} />
                  </div>
                  <ResultFlagChart data={data?.resultFlagDistribution} />
                </div>
              </div>

              {/* Charts row 2: Panels + Facilities */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <TestPanelBarChart data={data?.testPanelVolume} />
                <FacilityActivityCard data={data?.facilityActivity} />
              </div>

              {/* Recent Results */}
              {/* <RecentLabResults results={data.recentResults} /> */}
            </div>
          ) : data && activeTab === "infrastructure" ? (
            <div className="space-y-6 p-6 min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)] overflow-y-auto">
              <DataPipeline stages={data.pipeline || []} />

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ServiceHealthGrid services={data.services || []} />

                <StorageOverviewCard
                  storage={
                    data.storage || {
                      totalBuckets: 0,
                      totalObjects: 0,
                      totalSizeBytes: 0,
                      usedSizeBytes: 0,
                      buckets: [],
                    }
                  }
                />
              </div>

              {(data.databases || []).length > 0 && (
                <DatabaseStatsCard databases={data.databases || []} />
              )}
            </div>
          ) : loading ? (
            <div className="flex flex-col min-h-[calc(100vh-26px-56px)] max-h-[calc(100vh-26px-56px)] w-full h-full items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : (
            <></>
          )}
        </div>
      </div>
    </ContentLayout>
  );
}

export default DashboardPage;
