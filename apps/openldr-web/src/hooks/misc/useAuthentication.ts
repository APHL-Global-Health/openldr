import { OpenLDRClient } from "@/components/openldr-client-provider";
import { useQuery } from "@tanstack/react-query";

export default function useAuthentication(client: OpenLDRClient) {
  return useQuery({
    queryKey: ["isAuthenticated"],
    queryFn: async () => {
      const response = await client.isAuthenticated();
      return response.data;
    },
    refetchInterval: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchIntervalInBackground: false,
  });
}
