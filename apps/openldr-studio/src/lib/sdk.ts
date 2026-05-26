import * as DataEntryRestClient from "@/lib/restClients/dataEntryRestClient";
import { toJsonSchema, toZodSchema } from "@/lib/schemaUtils";
import { ZodProvider } from "@/lib/autoform/zod";
import * as exts from "@openldr/extensions";
import React from "react";
import { processFeedEntry } from "@/lib/restClients/dataProcessingRestClient";

import * as SchemaRestClient from "@/lib/restClients/schemaRestClient";

import { KeycloakClient } from "@/components/react-keycloak-provider";

type DataFeedsFilterOptions = {
  offset: number;
  limit: number;
  order: [string, "DESC" | "ASC"][];
  attributes: string[];
};

export const sdk = (client: KeycloakClient) => {
  return {
    extensions: exts,
    react: {
      createElement: React.createElement,
    },
    schema: {
      get: async (name: string, version: string, type: string) => {
        try {
          const json = await DataEntryRestClient.getForm(
            name,
            version,
            type,
            client.kc.token
          );

          const _schema = toZodSchema(json);

          const schemaProvider = new ZodProvider(_schema as any);

          return {
            title: json.title,
            description: json.description,
            schema: schemaProvider,
            code: toJsonSchema(_schema),
          };
        } catch (e: any) {
          return null;
        }
      },
    },
    api: {
      data: {
        feeds: {
          getAll: async (filter?: DataFeedsFilterOptions) => {
            const options = {
              ...(filter || {}),
              where: [
                {
                  column: "isEnabled",
                  operator: "eq",
                  value: true,
                  combineWith: "and",
                },
              ],
            };

            const msg = await SchemaRestClient.getTableData(
              "dataFeeds",
              options,
              client.kc.token
            );

            const { count, rows } = msg.data;
            return {
              count,
              rows,
            };
          },
        },
        processing: {
          feedEntry: async (
            body: any,
            dataFeedId: string,
            signal?: AbortSignal
          ) => {
            if (client.kc.token)
              return processFeedEntry(
                body,
                dataFeedId,
                client.kc.token,
                signal
              );

            return null;
          },
        },
      },
    },
  };
};
