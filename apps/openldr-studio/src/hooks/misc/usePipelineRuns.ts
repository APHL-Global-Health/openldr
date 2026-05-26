import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useKeycloakClient } from "@/components/react-keycloak-provider";
import * as api from "@/lib/restClients/pipelineRunsRestClient";
import { toast } from "sonner";

export function usePipelineRunsList(params: {
  page: number;
  limit: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  status?: string;
  autoRefresh?: boolean;
}) {
  const client = useKeycloakClient();
  const token = client.kc.token ?? "";

  const query = useQuery({
    queryKey: ["pipeline-runs", params],
    queryFn: ({ signal }) => api.listRuns(token, params, signal),
    refetchOnWindowFocus: false,
    refetchInterval: params.autoRefresh ? 5000 : false,
  });

  return query;
}

export function usePipelineRunDetail(messageId: string | null) {
  const client = useKeycloakClient();
  const token = client.kc.token ?? "";

  return useQuery({
    queryKey: ["pipeline-run-detail", messageId],
    queryFn: ({ signal }) => api.getRunDetail(token, messageId!, signal),
    enabled: !!messageId,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const status = query.state.data?.run?.currentStatus;
      return status === "processing" || status === "queued" ? 3000 : false;
    },
  });
}

export function useRetryRun() {
  const client = useKeycloakClient();
  const token = client.kc.token ?? "";
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: string) => api.retryRun(token, messageId),
    onSuccess: (_data, messageId) => {
      toast.success(`Retry initiated for ${messageId.slice(0, 8)}...`);
      queryClient.invalidateQueries({ queryKey: ["pipeline-runs"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline-run-detail", messageId] });
    },
    onError: (error: Error) => {
      toast.error(`Retry failed: ${error.message}`);
    },
  });
}

export function useDeleteRun() {
  const client = useKeycloakClient();
  const token = client.kc.token ?? "";
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: string) => api.deleteRun(token, messageId),
    onSuccess: (_data, messageId) => {
      toast.success(`Run ${messageId.slice(0, 8)}... deleted`);
      queryClient.invalidateQueries({ queryKey: ["pipeline-runs"] });
    },
    onError: (error: Error) => {
      toast.error(`Delete failed: ${error.message}`);
    },
  });
}

export function usePurgeObjects() {
  const client = useKeycloakClient();
  const token = client.kc.token ?? "";

  return useMutation({
    mutationFn: (params: { bucket: string; prefix: string }) =>
      api.purgeObjects(token, params.bucket, params.prefix),
    onSuccess: (data) => {
      toast.success(`Purged ${data.deletedCount} objects`);
    },
    onError: (error: Error) => {
      toast.error(`Purge failed: ${error.message}`);
    },
  });
}
