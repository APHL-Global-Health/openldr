import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
// import { useEffect } from "react";

type ServiceType = {
  name: string;
  source: string;
  status: "starting" | "running" | "stopped";
  url: string;
};

// const ENV = process.env;
const ENV = import.meta.env;
const baseUrl = ENV.VITE_BASE_URL || "/";

export function ServicesDatabase() {
  const services: ServiceType[] = [];

  if (ENV.VITE_APISIX_DASHBOARD_URL) {
    services.push({
      name: "apisix",
      source: `${baseUrl}assets/apisix_svg_logo.svg`,
      status: "running",
      url: ENV.VITE_APISIX_DASHBOARD_URL,
    });
  }

  if (ENV.VITE_KEYCLOAK_DASHBOARD_URL) {
    services.push({
      name: "keycloak",
      source: `${baseUrl}assets/keycloak_logo.svg`,
      status: "running",
      url: ENV.VITE_KEYCLOAK_DASHBOARD_URL,
    });
  }

  if (ENV.VITE_MINIO_DASHBOARD_URL) {
    services.push({
      name: "minio",
      source: document.documentElement.classList.contains("dark")
        ? `${baseUrl}assets/minio_logo_light.svg`
        : `${baseUrl}assets/minio_logo_dark.svg`,
      status: "running",
      url: ENV.VITE_MINIO_DASHBOARD_URL,
    });
  }

  if (ENV.VITE_OPENSEARCH_DASHBOARD_URL) {
    services.push({
      name: "opensearch",
      source: `${baseUrl}assets/opensearch_mark_default.svg`,
      status: "running",
      url: ENV.VITE_OPENSEARCH_DASHBOARD_URL,
    });
  }

  if (ENV.VITE_REDIS_DASHBOARD_URL) {
    services.push({
      name: "redis",
      source: `${baseUrl}assets/redis_logo.svg`,
      status: "running",
      url: ENV.VITE_REDIS_DASHBOARD_URL,
    });
  }

  if (ENV.VITE_KAFKA_DASHBOARD_URL) {
    services.push({
      name: "kafka",
      source: document.documentElement.classList.contains("dark")
        ? `${baseUrl}assets/apache_kafka_logo_dark.svg`
        : `${baseUrl}assets/apache_kafka_logo_light.svg`,
      status: "running",
      url: ENV.VITE_KAFKA_DASHBOARD_URL,
    });
  }

  const getStatusColor = (status: string) => {
    if (status === "running") return "bg-green-500";
    else if (status === "starting") return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <div className="flex w-full h-full justify-center overflow-y-auto p-4">
      <div className="flex flex-1 flex-row  space-x-4">
        <div className="flex">
          <div className="grid sm:grid-cols-1 lg:grid-cols-4  sm:gap-1 grid-rows-[repeat(auto-fit,240px)]">
            {services.map((service) => {
              return (
                <div className="flex flex-col min-w-45 bg-gray-500/5 border border-gray-200 shadow-2xs rounded-sm dark:bg-neutral-900 dark:border-neutral-800 relative">
                  <Tooltip key={service.name} delayDuration={0}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "rounded-full w-2 h-2 m-3",
                          getStatusColor(service.status)
                        )}
                      ></div>
                    </TooltipTrigger>
                    <TooltipContent className="flex items-center gap-4 rounded-xs">
                      <span className="ml-auto ">{service.status}</span>
                    </TooltipContent>
                  </Tooltip>

                  <div className="p-4  flex flex-1 flex-col justify-between gap-y-1">
                    <div className="flex flex-1 items-center justify-center gap-x-2  px-6">
                      <div className=" flex items-center justify-center overflow-hidden">
                        <img
                          src={service.source}
                          className="max-w-24 max-h-24 object-contains"
                          alt={service.name}
                        />
                      </div>
                    </div>
                    <div className="text-xs w-full uppercase text-center text-gray-500 dark:text-neutral-500">
                      {service.name}
                    </div>
                  </div>

                  <a
                    className="py-3 border-t px-4 md:px-5 inline-flex justify-between items-center text-sm text-gray-600 border-gray-200 hover:bg-primary hover:text-white focus:outline-hidden focus:bg-gray-50 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:focus:bg-neutral-800"
                    href={service.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Console
                    <ChevronRight height={24} width={24} />
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
