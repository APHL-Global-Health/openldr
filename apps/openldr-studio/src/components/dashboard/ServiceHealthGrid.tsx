import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  CircleDashed,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ServiceHealth, ServiceStatus } from "@/types/database";

interface ServiceHealthGridProps {
  services: ServiceHealth[];
}

const STATUS_CONFIG: Record<
  ServiceStatus,
  { icon: typeof CheckCircle2; color: string; bg: string; label: string }
> = {
  healthy: {
    icon: CheckCircle2,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500",
    label: "Healthy",
  },
  degraded: {
    icon: AlertTriangle,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500",
    label: "Degraded",
  },
  down: {
    icon: XCircle,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-500",
    label: "Down",
  },
  unknown: {
    icon: CircleDashed,
    color: "text-muted-foreground",
    bg: "bg-muted-foreground",
    label: "Unknown",
  },
};

function ServiceCard({ service }: { service: ServiceHealth }) {
  const config = STATUS_CONFIG[service.status];
  const Icon = config.icon;

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "group relative flex flex-col gap-2 rounded-sm border p-3 transition-all hover:shadow-sm",
            service.status === "down" &&
              "border-red-200 dark:border-red-900/40",
            service.status === "degraded" &&
              "border-amber-200 dark:border-amber-900/40",
          )}
        >
          {/* Status dot */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={cn("h-2 w-2 rounded-full", config.bg)}
                style={{
                  boxShadow:
                    service.status === "healthy"
                      ? "0 0 6px rgba(34,197,94,0.4)"
                      : service.status === "down"
                        ? "0 0 6px rgba(239,68,68,0.4)"
                        : "none",
                }}
              />
              <span className="text-xs font-medium truncate">
                {service.displayName}
              </span>
            </div>
            {/* <Icon className={cn("h-3.5 w-3.5", config.color)} /> */}
          </div>

          {/* Response time */}
          {service.responseTimeMs !== undefined && (
            <div className="flex items-center gap-1 text-[10px]">
              <Activity className="h-2.5 w-2.5" />
              {service.responseTimeMs}ms
            </div>
          )}

          {/* Version badge */}
          {/* {service.version && (
            <span className="text-[10px] text-muted-foreground/60">
              v{service.version}
            </span>
          )} */}
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        className="max-w-xs bg-background text-foreground border border-border"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <div className={cn("h-2 w-2 rounded-full", config.bg)} />
            <span className="font-medium text-xs">{service.displayName}</span>
            <span>({config.label})</span>
          </div>
          {service.uptime && (
            <p className="text-xs">Uptime: {service.uptime}</p>
          )}
          {service.responseTimeMs !== undefined && (
            <p className="text-xs">Response: {service.responseTimeMs}ms</p>
          )}
          {service.details &&
            Object.entries(service.details).map(([key, val]) => (
              <p key={key} className="text-xs">
                {key}: {val}
              </p>
            ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function ServiceHealthGrid({ services }: ServiceHealthGridProps) {
  const healthyCount = services.filter((s) => s.status === "healthy").length;
  const total = services.length;

  return (
    <div className="h-full ">
      <div className="cursor-default border-border border bg-card rounded-sm shadow h-full">
        <div className="flex items-center min-h-10 max-h-10 text-xs py-2 px-4 border-border border-b">
          SERVICE HEALTH
        </div>
        <div className="w-full min-h-[calc(100%-40px)] max-h-[calc(100%-40px)] p-2 h-full">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 h-full auto-rows-fr">
            {services.map((service) => (
              <ServiceCard key={service.name} service={service} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
