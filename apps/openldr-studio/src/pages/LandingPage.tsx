"use client";
// import { useState } from "react";
// import MainPage from "@/pages/MainPage";
import { UserAuthPage } from "@/components/authentication/user-auth-page";
import { useKeycloakClient } from "@/components/react-keycloak-provider";
import MainPage from "@/pages/MainPage";
import { cn } from "@/lib/utils";

function LandingPage() {
  const client = useKeycloakClient();

  // Wait for BOTH ready AND authenticated to be defined (not undefined)
  const isLoading =
    !client || !client.ready || client.authenticated === undefined;
  const isAuthenticated = client?.authenticated ?? false;

  return (
    <div
      className={cn(
        "flex  flex-col min-h-[calc(100vh)] max-h-[calc(100vh)] w-full",
      )}
    >
      {isLoading ? (
        <div className="flex justify-center w-full min-h-[calc(100vh)] max-h-[calc(100vh)] flex-col">
          <div className="flex w-full h-full items-center justify-center flex-col">
            <div className="flex h-4 w-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-spin"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            </div>
            <div className="flex mt-4">Loading</div>
          </div>
        </div>
      ) : isAuthenticated ? (
        <MainPage />
      ) : (
        <UserAuthPage />
      )}
    </div>
  );
}

export default LandingPage;
