import { models } from "@openldr/internal-database";
import { FacilityParams } from "../lib/types";
const { FacilityModel, DataFeedModel } = models;

async function createFacility({
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
}: FacilityParams) {
  try {
    return await FacilityModel.create({
      facilityId,
      facilityCode,
      facilityName,
      facilityType,
      description: description!,
      countryCode,
      provinceCode,
      regionCode,
      districtCode,
      subDistrictCode,
      lattLong: lattLong!,
    });
  } catch (error) {
    console.error("Error creating facility:", error);
    throw error;
  }
}

async function getFacilityById(facilityId: string) {
  try {
    return await FacilityModel.findByPk(facilityId, {
      include: [
        {
          model: DataFeedModel,
          as: "dataFeeds",
          attributes: ["dataFeedId"],
        },
      ],
    });
  } catch (error) {
    console.error("Error getting facility by ID:", error);
    throw error;
  }
}

async function getAllFacilities() {
  try {
    return await FacilityModel.findAll({
      include: [
        {
          model: DataFeedModel,
          as: "dataFeeds",
          attributes: ["dataFeedId"],
        },
      ],
    });
  } catch (error) {
    console.error("Error getting all facilities:", error);
    throw error;
  }
}

async function updateFacility({
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
}: FacilityParams) {
  try {
    return await FacilityModel.update(
      {
        facilityCode,
        facilityName,
        facilityType,
        description: description!,
        countryCode,
        provinceCode,
        regionCode,
        districtCode,
        subDistrictCode,
        lattLong: lattLong!,
      },
      {
        where: { facilityId },
      }
    );
  } catch (error) {
    console.error("Error updating facility:", error);
    throw error;
  }
}

async function deleteFacility(facilityId: string) {
  try {
    return await FacilityModel.destroy({
      where: { facilityId },
    });
  } catch (error) {
    console.error("Error deleting facility:", error);
    throw error;
  }
}

export {
  createFacility,
  getFacilityById,
  getAllFacilities,
  updateFacility,
  deleteFacility,
};
