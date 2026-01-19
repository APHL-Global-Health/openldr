import { models } from "@openldr/internal-database";
const { FacilityModel } = models;

// get the facility by id
async function getFacilityById(facilityId: string) {
  const facility = await FacilityModel.findByPk(facilityId);
  return facility;
}

export { getFacilityById };
