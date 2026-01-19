import { DynamicModelManager } from "@openldr/internal-database";
import express from "express";
import * as facilityService from "../services/facilityService";
import * as minioUtil from "../utils/minioUtil";
import { v4 as uuidv4 } from "uuid";
import * as dataFeedService from "../services/dataFeedService";
import * as keycloakUtil from "../utils/keycloakUtil";

export const router = (modelManager: DynamicModelManager) => {
  const _router = express.Router();

  _router.post("/create-dataFeed", async (req, res) => {
    const {
      dataFeedName,
      facilityId,
      schemaPluginId,
      mapperPluginId,
      recipientPluginId,
      projectId,
      useCaseId,
      isEnabled,
      isProtected,
    } = req.body;

    const facility = await facilityService.getFacilityById(facilityId);
    if (!facility) {
      res.status(500).send(`No facility with id ${facilityId} found.`);
      return;
    }

    // TODO: Review to verify if this is needed as with more common standards we can have the same schema and mapper plugin for multiple data feeds like HL7 FHIR then different use cases can have different data feeds for the data feed name...
    // const dataFeeds = await dataFeedService.getDataFeedByPluginIds({facilityId, schemaPluginId, mapperPluginId});
    // if (dataFeeds.length >= 1) {
    //   res.status(500).send(`Data Feed already exists for schema plugin ID: ${schemaPluginId} and mapper plugin ID: ${mapperPluginId}.`);
    //   return;
    // }

    // Generate a unique ID for the data feed
    const dataFeedId = await uuidv4();

    // Convert empty strings to null for plugin IDs
    const cleanPluginIds = {
      schemaPluginId:
        schemaPluginId === "" || schemaPluginId === undefined
          ? null
          : schemaPluginId,
      mapperPluginId:
        mapperPluginId === "" || mapperPluginId === undefined
          ? null
          : mapperPluginId,
      recipientPluginId:
        recipientPluginId === "" || recipientPluginId === undefined
          ? null
          : recipientPluginId,
    };

    // Create Keycloak client for this data feed
    await keycloakUtil
      .createClient({
        id: `${dataFeedId}`,
        name: dataFeedName,
        description: `Data feed ${dataFeedName} for facility ${facilityId}`,
        serviceAccountsEnabled: true,
        authorizationServicesEnabled: true,
      })
      .then(async (keycloakClient) => {
        // Get the client secret
        const clientSecret = await keycloakUtil.getClientSecret(
          keycloakClient.id
        );

        // Create the data feed with the Keycloak client ID and secret
        const dataFeed = await dataFeedService.createDataFeed({
          dataFeedId,
          dataFeedName,
          facilityId,
          ...cleanPluginIds,
          projectId,
          useCaseId,
          isEnabled,
          isProtected,
        });

        res.status(200).json({
          message: "Data feed created successfully",
          dataFeed,
          keycloakClient: {
            clientId: keycloakClient.clientId,
            clientSecret: clientSecret,
          },
        });
      })
      .catch((error) => {
        // TODO: delete client if db entry fails
        console.error("Error creating data feed:", error);
        res
          .status(500)
          .send(
            `Failed to create data feed: ${error.response ? JSON.stringify(error.response.data, null, 2) : error.message}`
          );
      });
  });

  _router.get("", async (req, res) => {
    const isEnabled = req.query.isEnabled;
    const dataFeeds = await dataFeedService.getAllDataFeeds(isEnabled);

    res.status(200).send(dataFeeds);
  });

  _router.put("/update-dataFeed/:id", async (req, res) => {
    const { id } = req.params;
    const {
      dataFeedName,
      facilityId,
      schemaPluginId,
      mapperPluginId,
      recipientPluginId,
      projectId,
      useCaseId,
      isEnabled,
      isProtected,
    } = req.body;

    try {
      // Convert empty strings to null for plugin IDs
      const cleanPluginIds = {
        schemaPluginId:
          schemaPluginId === "" || schemaPluginId === undefined
            ? null
            : schemaPluginId,
        mapperPluginId:
          mapperPluginId === "" || mapperPluginId === undefined
            ? null
            : mapperPluginId,
        recipientPluginId:
          recipientPluginId === "" || recipientPluginId === undefined
            ? null
            : recipientPluginId,
      };

      await dataFeedService.updateDataFeed({
        dataFeedId: id,
        dataFeedName,
        facilityId,
        ...cleanPluginIds,
        projectId,
        useCaseId,
        isEnabled,
        isProtected,
      });

      res.status(200).send(`Data feed updated successfully.`);
    } catch (error: any) {
      console.error(error);

      res
        .status(500)
        .send(
          `Failed to update data feed (${JSON.stringify(error.response ? error.response.data : error.message, null, 2)})`
        );
    }
  });

  _router.delete("/delete-dataFeed/:id", async (req, res) => {
    const { id } = req.params;

    try {
      await dataFeedService.deleteDataFeed(id);
      await keycloakUtil.deleteClient(id);

      res.status(200).send(`Data feed deleted successfully.`);
    } catch (error: any) {
      console.error(error);

      res
        .status(500)
        .send(
          `Failed to delete data feed (${JSON.stringify(error.response ? error.response.data : error.message, null, 2)})`
        );
    }
  });

  _router.get("/get-client-details", async (req, res) => {
    const clientId = req.query.clientId;

    try {
      const clientDetails = await keycloakUtil.getClientSecret(clientId);

      res.status(200).json({
        clientId: clientId,
        clientSecret: clientDetails.value,
      });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .send(
          `Failed to get client secret. (${JSON.stringify(error, null, 2)})`
        );
    }
  });

  _router.get("/reset-client-details", async (req, res) => {
    const clientId = req.query.clientId;

    try {
      const newClientDetails = await keycloakUtil.resetClientSecret(clientId);

      res.status(200).json({
        clientId: clientId,
        clientSecret: newClientDetails.value,
      });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .send(
          `Failed to reset client secret. (${JSON.stringify(error, null, 2)})`
        );
    }
  });

  return _router;
};
