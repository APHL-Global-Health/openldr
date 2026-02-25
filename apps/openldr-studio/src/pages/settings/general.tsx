"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";

import { Separator } from "@/components/ui/separator";
import { useKeycloakClient } from "@/components/react-keycloak-provider";

import { useCopyToClipboard } from "@/hooks/misc/useCopyToClipboard";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { CheckIcon, CopyIcon, ExternalLinkIcon } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const ENV = import.meta.env;
const baseUrl = ENV.VITE_BASE_URL || "/";

export function SettingsGeneral() {
  const client = useKeycloakClient();
  const keycloak = client.kc;
  const hasPriviledges = keycloak.hasRealmRole(
    import.meta.env.VITE_PRIVILEDGED_ROLE || "user",
  );

  const { copyToClipboard, isCopied } = useCopyToClipboard();

  return (
    <div className="flex w-full h-full justify-center items-start overflow-y-auto py-4">
      <div className="flex flex-col space-y-10">
        <Card className="w-3xl h-auto rounded-sm">
          <CardHeader>
            <CardTitle>General</CardTitle>
            <CardDescription></CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="flex flex-col py-2">
            <div className="grid grid-cols-2 py-2 space-y-2 w-full">
              <div className="flex items-center text-sm">Entity API URL</div>
              <InputGroup className="rounded-xs">
                <InputGroupInput value={ENV.VITE_API_BASE_URL} readOnly />
                <InputGroupAddon align="inline-end">
                  <NavLink
                    to={ENV.VITE_API_BASE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({
                        variant: "ghost",
                        size: "icon",
                      }),
                      "h-9 w-9",
                    )}
                  >
                    <ExternalLinkIcon />
                  </NavLink>
                  <InputGroupButton
                    aria-label="Copy"
                    title="Copy"
                    size="icon-xs"
                    onClick={() => {
                      copyToClipboard(ENV.VITE_API_BASE_URL);
                    }}
                  >
                    {isCopied ? <CheckIcon /> : <CopyIcon />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </div>
            <div className="grid grid-cols-2 py-2 space-y-2 w-full">
              <div className="flex items-center text-sm">Processor API URL</div>
              <InputGroup className="rounded-xs">
                <InputGroupInput value={ENV.VITE_PROCESSOR_BASE_URL} readOnly />
                <InputGroupAddon align="inline-end">
                  <NavLink
                    to={ENV.VITE_PROCESSOR_BASE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({
                        variant: "ghost",
                        size: "icon",
                      }),
                      "h-9 w-9",
                    )}
                  >
                    <ExternalLinkIcon />
                  </NavLink>
                  <InputGroupButton
                    aria-label="Copy"
                    title="Copy"
                    size="icon-xs"
                    onClick={() => {
                      copyToClipboard(ENV.VITE_PROCESSOR_BASE_URL);
                    }}
                  >
                    {isCopied ? <CheckIcon /> : <CopyIcon />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </div>
            <div className="grid grid-cols-2 py-2 space-y-2 w-full">
              <div className="flex items-center text-sm">Relative Path</div>
              <InputGroup className="rounded-xs">
                <InputGroupInput value={ENV.VITE_BASE_URL} readOnly />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    aria-label="Copy"
                    title="Copy"
                    size="icon-xs"
                    onClick={() => {
                      copyToClipboard(ENV.VITE_BASE_URL);
                    }}
                  >
                    {isCopied ? <CheckIcon /> : <CopyIcon />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </div>
            <div className="grid grid-cols-2 py-2 space-y-2 w-full">
              <div className="flex items-center text-sm">Internal Port</div>
              <InputGroup className="rounded-xs">
                <InputGroupInput value={ENV.VITE_BASE_PORT} readOnly />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    aria-label="Copy"
                    title="Copy"
                    size="icon-xs"
                    onClick={() => {
                      copyToClipboard(ENV.VITE_BASE_PORT);
                    }}
                  >
                    {isCopied ? <CheckIcon /> : <CopyIcon />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </div>
          </CardContent>
        </Card>

        <Card className="w-3xl h-auto rounded-sm">
          <CardHeader>
            <CardTitle>Web Consoles</CardTitle>
            <CardDescription></CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="flex flex-col py-2">
            <div className="grid grid-cols-2 py-2 space-y-2 w-full">
              <div className="flex items-center text-sm">Kafka URL</div>
              <InputGroup className="rounded-xs">
                <InputGroupInput
                  value={ENV.VITE_KAFKA_DASHBOARD_URL}
                  readOnly
                />
                <InputGroupAddon align="inline-end">
                  <NavLink
                    to={ENV.VITE_KAFKA_DASHBOARD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({
                        variant: "ghost",
                        size: "icon",
                      }),
                      "h-9 w-9",
                    )}
                  >
                    <ExternalLinkIcon />
                  </NavLink>
                  <InputGroupButton
                    aria-label="Copy"
                    title="Copy"
                    size="icon-xs"
                    onClick={() => {
                      copyToClipboard(ENV.VITE_KAFKA_DASHBOARD_URL);
                    }}
                  >
                    {isCopied ? <CheckIcon /> : <CopyIcon />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </div>
            <div className="grid grid-cols-2 py-2 space-y-2 w-full">
              <div className="flex items-center text-sm">Keycloak URL</div>
              <InputGroup className="rounded-xs">
                <InputGroupInput
                  value={ENV.VITE_KEYCLOAK_DASHBOARD_URL}
                  readOnly
                />
                <InputGroupAddon align="inline-end">
                  <NavLink
                    to={ENV.VITE_KEYCLOAK_DASHBOARD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({
                        variant: "ghost",
                        size: "icon",
                      }),
                      "h-9 w-9",
                    )}
                  >
                    <ExternalLinkIcon />
                  </NavLink>
                  <InputGroupButton
                    aria-label="Copy"
                    title="Copy"
                    size="icon-xs"
                    onClick={() => {
                      copyToClipboard(ENV.VITE_KEYCLOAK_DASHBOARD_URL);
                    }}
                  >
                    {isCopied ? <CheckIcon /> : <CopyIcon />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </div>
            <div className="grid grid-cols-2 py-2 space-y-2 w-full">
              <div className="flex items-center text-sm">Minio URL</div>
              <InputGroup className="rounded-xs">
                <InputGroupInput
                  value={ENV.VITE_MINIO_DASHBOARD_URL}
                  readOnly
                />
                <InputGroupAddon align="inline-end">
                  <NavLink
                    to={ENV.VITE_MINIO_DASHBOARD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({
                        variant: "ghost",
                        size: "icon",
                      }),
                      "h-9 w-9",
                    )}
                  >
                    <ExternalLinkIcon />
                  </NavLink>
                  <InputGroupButton
                    aria-label="Copy"
                    title="Copy"
                    size="icon-xs"
                    onClick={() => {
                      copyToClipboard(ENV.VITE_MINIO_DASHBOARD_URL);
                    }}
                  >
                    {isCopied ? <CheckIcon /> : <CopyIcon />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </div>
            <div className="grid grid-cols-2 py-2 space-y-2 w-full">
              <div className="flex items-center text-sm">Nginx URL</div>
              <InputGroup className="rounded-xs">
                <InputGroupInput
                  value={ENV.VITE_NGINX_DASHBOARD_URL}
                  readOnly
                />
                <InputGroupAddon align="inline-end">
                  <NavLink
                    to={ENV.VITE_NGINX_DASHBOARD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({
                        variant: "ghost",
                        size: "icon",
                      }),
                      "h-9 w-9",
                    )}
                  >
                    <ExternalLinkIcon />
                  </NavLink>
                  <InputGroupButton
                    aria-label="Copy"
                    title="Copy"
                    size="icon-xs"
                    onClick={() => {
                      copyToClipboard(ENV.VITE_NGINX_DASHBOARD_URL);
                    }}
                  >
                    {isCopied ? <CheckIcon /> : <CopyIcon />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </div>
            <div className="grid grid-cols-2 py-2 space-y-2 w-full">
              <div className="flex items-center text-sm">OpenSearch URL</div>
              <InputGroup className="rounded-xs">
                <InputGroupInput
                  value={ENV.VITE_OPENSEARCH_DASHBOARD_URL}
                  readOnly
                />
                <InputGroupAddon align="inline-end">
                  <NavLink
                    to={ENV.VITE_OPENSEARCH_DASHBOARD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({
                        variant: "ghost",
                        size: "icon",
                      }),
                      "h-9 w-9",
                    )}
                  >
                    <ExternalLinkIcon />
                  </NavLink>
                  <InputGroupButton
                    aria-label="Copy"
                    title="Copy"
                    size="icon-xs"
                    onClick={() => {
                      copyToClipboard(ENV.VITE_OPENSEARCH_DASHBOARD_URL);
                    }}
                  >
                    {isCopied ? <CheckIcon /> : <CopyIcon />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </div>

            <div className="grid grid-cols-2 py-2 space-y-2 w-full">
              <div className="flex items-center text-sm">Postgres URL</div>
              <InputGroup className="rounded-xs">
                <InputGroupInput
                  value={ENV.VITE_POSTGRES_CONSOLE_URL}
                  readOnly
                />
                <InputGroupAddon align="inline-end">
                  <NavLink
                    to={ENV.VITE_POSTGRES_CONSOLE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({
                        variant: "ghost",
                        size: "icon",
                      }),
                      "h-9 w-9",
                    )}
                  >
                    <ExternalLinkIcon />
                  </NavLink>
                  <InputGroupButton
                    aria-label="Copy"
                    title="Copy"
                    size="icon-xs"
                    onClick={() => {
                      copyToClipboard(ENV.VITE_POSTGRES_CONSOLE_URL);
                    }}
                  >
                    {isCopied ? <CheckIcon /> : <CopyIcon />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </div>
          </CardContent>
          {/* <Separator />
          <CardFooter className="flex flex-row py-2">
            <div className="flex flex-1"></div>
            <div className="flex flex-row space-x-4">
              <Button
                disabled={!hasPriviledges}
                variant="outline"
                className="btn btn-secondary"
              >
                Cancel
              </Button>
              <Button
                disabled={!hasPriviledges}
                variant="outline"
                className="btn btn-primary"
              >
                Save
              </Button>
            </div>
          </CardFooter> */}
        </Card>
      </div>
    </div>
  );
}
