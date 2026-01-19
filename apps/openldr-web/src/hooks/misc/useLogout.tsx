import { OpenLDRClient } from "@/components/openldr-client-provider";
import axios from "axios";

export default function useLogout(client: OpenLDRClient) {
  async function logout() {
    try {
      await client.logout();
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        const response = error.response?.data;
        if (response) {
          throw new Error(response.data);
        }
      } else {
        throw new Error(error.message);
      }
    }
  }
  return logout;
}
