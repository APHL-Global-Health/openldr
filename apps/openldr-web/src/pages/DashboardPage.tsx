import LogoutOptions from "@/components/logout-options";
import { Separator } from "@/components/ui/separator";
import { useKeycloakClient } from "@/components/react-keycloak-provider";

import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  getIndexDocumentCounts,
  getIntervalMessageCounts,
  getLatestMessages,
  getUniqueDataFeedsProjectsUseCases,
} from "@/lib/restClients/opensearchRestClient";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import React, { useEffect, useState } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
// import { jwtDecode } from "jwt-decode";

interface DashboardSectionCardProps {
  title: string;
  count?: number;
  children: React.ReactNode;
  onToggle?: () => void;
}

interface DataState {
  dataFeeds: any[] | null;
  projects: any[] | null;
  useCases: any[] | null;
  indexDocumentCounts: {
    "raw-inbound": number;
    "validated-inbound": number;
    "mapped-inbound": number;
    "processed-inbound": number;
  };
  chartData: any[];
  latestMessages: any[];
}

const now = new Date();
const startOfDay = new Date(
  now.getFullYear(),
  now.getMonth(),
  now.getDate(),
  0,
  0,
  0,
  0
).getTime();
const startOfNextDay = new Date(
  now.getFullYear(),
  now.getMonth(),
  now.getDate() + 1,
  0,
  0,
  0,
  0
).getTime();

const chartConfig = {
  count: {
    label: "Count",
    color: "#3b82f6",
  },
};

const currentDateLabel = now.toLocaleDateString("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

const ticks: any[] = [];
for (let hour = 0; hour <= 24; hour += 4) {
  ticks.push(startOfDay + hour * 60 * 60 * 1000);
}

function DashboardSectionCard({
  title,
  count,
  children,
  onToggle,
}: DashboardSectionCardProps) {
  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex justify-between items-center px-2">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium">{title}</h3>
          {count !== undefined && (
            <span className="text-sm text-gray-500">{count}</span>
          )}
        </div>
        {onToggle && <Switch onCheckedChange={onToggle} />}
      </div>
      <Card className="p-4 h-full rounded-sm">{children}</Card>
    </div>
  );
}

function DashboardPage() {
  const client = useKeycloakClient();
  const keycloak = client.kc;

  const [currentTime, setCurrentTime] = useState(now.getTime());
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DataState>({
    dataFeeds: null,
    projects: null,
    useCases: null,
    indexDocumentCounts: {
      "raw-inbound": 0,
      "validated-inbound": 0,
      "mapped-inbound": 0,
      "processed-inbound": 0,
    },
    chartData: [],
    latestMessages: [],
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date().getTime());
    }, 600000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (keycloak.authenticated && keycloak.token) {
      (async () => {
        try {
          setLoading(true);

          // Default to current day data
          const startDateTime =
            new Date().toISOString().split("T")[0] + "T00:00:00Z";
          const endDateTime = new Date().toISOString();

          const [
            uniqueData,
            indexDocumentCounts,
            intervalMessageCounts,
            latestMessages,
          ] = await Promise.all([
            getUniqueDataFeedsProjectsUseCases(
              "processed-inbound",
              keycloak.token,
              startDateTime,
              endDateTime
            ),
            getIndexDocumentCounts(keycloak.token, startDateTime, endDateTime),
            getIntervalMessageCounts(
              keycloak.token,
              startDateTime,
              endDateTime
            ),
            getLatestMessages(keycloak.token, startDateTime, endDateTime),
          ]);

          setData({
            dataFeeds: uniqueData.dataFeeds,
            projects: uniqueData.projects,
            useCases: uniqueData.useCases,
            indexDocumentCounts,
            chartData: intervalMessageCounts,
            latestMessages,
          });
        } catch (error) {
          console.error("Dashboard data load error:", error);
          // Optionally refresh token and retry
          try {
            await keycloak.updateToken(30);
            // Could retry the API calls here if needed
          } catch (refreshError) {
            console.error("Token refresh failed:", refreshError);
            keycloak.login(); // Force re-login if token refresh fails
          }
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [keycloak, keycloak.authenticated, keycloak.token]);

  function truncateNumber(num: number) {
    if (Math.abs(num) >= 1000000) {
      return (num / 1000000).toFixed(2).replace(/\.?0+$/, "") + "M";
    } else if (Math.abs(num) >= 1000) {
      return (num / 1000).toFixed(2).replace(/\.?0+$/, "") + "K";
    }
    return num.toString();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading dashboard...</div>
      </div>
    );
  }

  const filteredData = data.chartData.filter((item: any) => {
    const itemTime = new Date(item.time).getTime();
    return (
      itemTime >= startOfDay && itemTime < startOfNextDay && !isNaN(itemTime)
    );
  });

  const formattedData = filteredData.map((item: any) => ({
    time: new Date(item.time).getTime(),
    count: item.count || 0,
  }));

  // const token = keycloak.token!;
  // const decoded = jwtDecode(token);

  return (
    <div className="flex w-full h-full flex-col">
      <div className="flex min-h-13 max-h-13 w-full items-center px-2 py-2">
        <div className="flex flex-1"></div>
        <Separator orientation="vertical" className="mx-2 h-6" />
        <LanguageSwitcher />
        <Separator orientation="vertical" className="mx-2 h-6" />
        <LogoutOptions />
      </div>
      <Separator />
      <div className="flex w-full h-full mx-auto flex-col overflow-y-auto">
        <div className="flex flex-row w-full justify-end my-6 px-6">
          <div className="grid max-w-3xl grid-cols-4 gap-10 mb-6 text-right h-full">
            <div className="gap-6">
              <p className="text-sm text-gray-500">Raw</p>
              <p className="text-4xl font-light">
                {truncateNumber(data.indexDocumentCounts["raw-inbound"])}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Validated</p>
              <p className="text-4xl font-light">
                {truncateNumber(data.indexDocumentCounts["validated-inbound"])}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Mapped</p>
              <p className="text-4xl font-light">
                {truncateNumber(data.indexDocumentCounts["mapped-inbound"])}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Processed</p>
              <p className="text-4xl font-light">
                {truncateNumber(data.indexDocumentCounts["processed-inbound"])}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 px-6">
          <DashboardSectionCard
            title="Senders"
            count={data.dataFeeds?.length || 0}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.dataFeeds ? (
                  data.dataFeeds.map((dataFeed: any) => {
                    return (
                      <TableRow key={dataFeed.key}>
                        <TableCell className="flex items-center">
                          {dataFeed.key}
                        </TableCell>
                        <TableCell className="text-right">
                          {dataFeed.doc_count}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell className="flex items-center">
                      No data feeds
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DashboardSectionCard>

          <DashboardSectionCard
            title="Projects"
            count={data.projects?.length || 0}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.projects ? (
                  data.projects.map((project: any) => {
                    return (
                      <TableRow key={project.key}>
                        <TableCell className="flex items-center">
                          {project.key}
                        </TableCell>
                        <TableCell className="text-right">
                          {project.doc_count}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell className="flex items-center">
                      No projects
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DashboardSectionCard>

          <DashboardSectionCard
            title="Use Cases"
            count={data.useCases?.length || 0}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.useCases ? (
                  data.useCases.map((useCase: any) => {
                    return (
                      <TableRow key={useCase.key}>
                        <TableCell className="flex items-center">
                          {useCase.key}
                        </TableCell>
                        <TableCell className="text-right">
                          {useCase.doc_count}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell className="flex items-center">
                      No use cases
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DashboardSectionCard>
        </div>

        <div className="mb-6 px-6">
          <DashboardSectionCard title="Messages">
            <div className={"h-fit"}>
              <ChartContainer config={chartConfig} className="h-75 w-full">
                <LineChart
                  data={formattedData}
                  width={600}
                  height={300}
                  margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                >
                  <CartesianGrid stroke="#e5e7eb" />
                  <XAxis
                    dataKey="time"
                    type="number"
                    domain={[startOfDay, startOfNextDay]}
                    ticks={ticks}
                    tickFormatter={(value) =>
                      new Date(value).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })
                    }
                    label={{
                      value: `Time (${currentDateLabel})`,
                      position: "bottom",
                      offset: 0,
                      fill: "#1f2937",
                    }}
                  />
                  <YAxis
                    dataKey="count"
                    domain={[0, "auto"]}
                    label={{
                      value: "Count",
                      angle: -90,
                      position: "insideLeft",
                      fill: "#1f2937",
                    }}
                  />
                  <ChartTooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const time = new Date(label!);
                        const formattedTime =
                          time.getHours() === 0 && time.getMinutes() === 0
                            ? "00:00"
                            : time.toLocaleTimeString("en-US", {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false,
                              });
                        const count = payload[0].value;
                        return (
                          <div className="bg-white text-black border border-gray-200 p-2 rounded-md">
                            <p className="text-black">{`${count} messages @ ${formattedTime}`}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.2}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6, fill: "#1d4ed8" }}
                    connectNulls={false}
                  />
                  {currentTime >= startOfDay &&
                    currentTime < startOfNextDay && (
                      <ReferenceLine
                        x={currentTime}
                        stroke="red"
                        strokeDasharray="3 3"
                        strokeWidth={1}
                        label={{
                          value: new Date().toTimeString().substring(0, 5),
                          position: "top",
                          fill: "red",
                          fontSize: 12,
                        }}
                      />
                    )}
                </LineChart>
              </ChartContainer>
            </div>
          </DashboardSectionCard>
        </div>

        <div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead>
                  <div className="flex items-center">Date EDT</div>
                </TableHead>
                <TableHead>Filename</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Use Case</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sender</TableHead>
                <TableHead>Recipient</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.latestMessages.map((message: any) => (
                <TableRow key={message["X-Amz-Meta-Messageid"]}>
                  <TableCell>
                    {/*<ChevronRight className="w-4 h-4"/>*/}
                  </TableCell>
                  <TableCell>{message["X-Amz-Meta-Messagedatetime"]}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {message["X-Amz-Meta-Filename"].split("/").pop()}
                  </TableCell>
                  <TableCell className="flex items-center">
                    {message["X-Amz-Meta-Project"]}
                  </TableCell>
                  <TableCell>{message["X-Amz-Meta-Usecase"]}</TableCell>
                  <TableCell>{message["X-Amz-Meta-Size"]}</TableCell>
                  <TableCell>{message["X-Amz-Meta-Status"]}</TableCell>
                  <TableCell>{message["X-Amz-Meta-Senders"]}</TableCell>
                  <TableCell>{message["X-Amz-Meta-Recipients"]}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
