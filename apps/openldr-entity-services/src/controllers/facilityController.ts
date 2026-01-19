import { DynamicModelManager } from "@openldr/internal-database";
import express from "express";
import * as facilityService from "../services/facilityService";
import * as minioUtil from "../utils/minioUtil";
import { v4 as uuidv4 } from "uuid";
import * as dataFeedService from "../services/dataFeedService";
import * as keycloakUtil from "../utils/keycloakUtil";

export const router = (modelManager: DynamicModelManager) => {
  const _router = express.Router();

  _router.post("/create-facility", async (req, res) => {
    const {
      facilityCode,
      facilityName,
      facilityType,
      description,
      countryCode,
      provinceCode,
      regionCode,
      districtCode,
      subDistrictCode,
      lattLong,
    } = req.body;

    try {
      // Generate a unique ID for the facility
      const facilityId = await uuidv4();

      // Create the facility record
      const facility = await facilityService.createFacility({
        facilityId,
        facilityCode,
        facilityName,
        facilityType,
        description,
        countryCode,
        provinceCode,
        regionCode,
        districtCode,
        subDistrictCode,
        lattLong,
      });

      // Create MinIO bucket for the facility
      await minioUtil.createBucket(facilityId);

      await minioUtil.setBucketKafkaNotifications(facilityId);

      const dataFeedId = await uuidv4();

      await dataFeedService.createDataFeed({
        dataFeedId,
        dataFeedName: `Manual Data Entry for facility: ${facilityName}`,
        facilityId,
        schemaPluginId: null,
        mapperPluginId: null,
        recipientPluginId: null,
        projectId: process.env.OPENLDR_PROJECT_ID!,
        useCaseId: process.env.MANUAL_ENTRY_USE_CASE_ID!,
        isEnabled: true,
        isProtected: true,
      });

      res.status(200).json(facility);
    } catch (error: any) {
      console.error("Error creating facility:", error);
      res.status(500).send(`Failed to create facility: ${error.message}`);
    }
  });

  _router.get("", async (req, res) => {
    const facilities = await facilityService.getAllFacilities();

    res.status(200).json(facilities);
  });

  _router.get("/get-facility/:facilityId", async (req, res) => {
    try {
      const facility = await facilityService.getFacilityById(
        req.params.facilityId
      );
      res.status(200).json(facility);
    } catch (error) {
      res.status(500).send(`Failed to get facility: ${error}`);
    }
  });

  _router.put("/update-facility/:id", async (req, res) => {
    const { id } = req.params;
    const {
      facilityCode,
      facilityName,
      facilityType,
      description,
      countryCode,
      provinceCode,
      regionCode,
      districtCode,
      subDistrictCode,
      lattLong,
    } = req.body;

    try {
      await facilityService.updateFacility({
        facilityId: id,
        facilityCode: facilityCode,
        facilityName: facilityName,
        facilityType: facilityType,
        description: description,
        countryCode: countryCode,
        provinceCode: provinceCode,
        regionCode: regionCode,
        districtCode: districtCode,
        subDistrictCode: subDistrictCode,
        lattLong: lattLong,
      });

      res.status(200).send(`Facility updated successfully.`);
    } catch (error: any) {
      console.error(error);

      res
        .status(500)
        .send(
          `Failed to update facility (${JSON.stringify(error.response ? error.response.data : error.message, null, 2)})`
        );
    }
  });

  _router.delete("/delete-facility/:id", async (req, res) => {
    const { id } = req.params;

    try {
      const facility = await facilityService.getFacilityById(id);

      if (!facility) {
        return res.status(404).json({
          error: `Facility with ID ${id} not found.`,
        });
      }

      if (facility.dataFeeds && facility.dataFeeds.length > 0) {
        return res.status(500).json({
          error_message: `Cannot delete facility as there are associated data feeds. Please delete data feeds.`,
        });
      }

      await facilityService.deleteFacility(id);
      await minioUtil.deleteBucket(id);

      res.status(200).send(`Facility deleted successfully.`);
    } catch (error: any) {
      console.error(error);

      res
        .status(500)
        .send(
          `Failed to delete facility (${JSON.stringify(error.response ? error.response.data : error.message, null, 2)})`
        );
    }
  });

  return _router;
};
