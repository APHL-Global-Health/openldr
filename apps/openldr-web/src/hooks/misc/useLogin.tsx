import { OpenLDRClient } from "@/components/openldr-client-provider";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";

export default function useLogin() {
  async function login({
    client,
    username,
    password,
  }: {
    client: OpenLDRClient;
    username: string;
    password: string;
  }): Promise<string | undefined> {
    try {
      return await client.login(username, password);
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        const response = error.response?.data;
        if (response) {
          throw new Error(
            response.data === "Failed to get token"
              ? "Invalid credentials"
              : response.data
          );
        }
      } else {
        throw new Error(error.message);
      }
    }
  }
  return useMutation<
    string | undefined,
    Error,
    { client: OpenLDRClient; username: string; password: string }
  >({
    mutationFn: login,
  });
}
