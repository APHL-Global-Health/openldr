import express from "express";
import { OCLService } from "../services/ocl.service";

const oclService = new OCLService(process.env.OCL_BASE_URL!);

const router = express.Router();

export const generate = async (body: any, res: express.Response | null) => {
  const {
    oclUrl, // Optional: defaults to online OCL
    orgId, // Required: OCL organization ID
    sourceId, // Required: OCL source ID
    auth = { type: "none" }, // Optional: authentication
    limit = 1000, // Optional: number of concepts to fetch
  } = body;

  // Validate required parameters
  if (!orgId || !sourceId) {
    if (res) {
      return res.status(400).json({
        error: "Missing required parameters",
        required: ["orgId", "sourceId"],
        optional: ["oclUrl", "auth", "limit"],
      });
    } else {
      throw new Error(
        JSON.stringify({
          error: "Missing required parameters",
          required: ["orgId", "sourceId"],
          optional: ["oclUrl", "auth", "limit"],
        }),
      );
    }
  }

  // Validate optional parameters
  if (limit && (typeof limit !== "number" || limit <= 0 || limit > 10000)) {
    if (res) {
      return res.status(400).json({
        error: "Invalid limit parameter",
        message: "Limit must be a positive number between 1 and 10000",
      });
    } else {
      throw new Error(
        JSON.stringify({
          error: "Invalid limit parameter",
          message: "Limit must be a positive number between 1 and 10000",
        }),
      );
    }
  }

  if (auth && typeof auth !== "object") {
    if (res) {
      return res.status(400).json({
        error: "Invalid auth parameter",
        message:
          "Auth must be an object with type, and optional username/password or token",
      });
    } else {
      throw new Error(
        JSON.stringify({
          error: "Invalid auth parameter",
          message:
            "Auth must be an object with type, and optional username/password or token",
        }),
      );
    }
  }

  console.log(`Generating terminology mapping for ${orgId}/${sourceId}`);
  console.log(`OCL URL: ${oclUrl || "default (online)"}`);

  // Fetch concepts from OCL
  const concepts = await oclService.fetchConcepts(
    oclUrl,
    orgId,
    sourceId,
    auth,
    limit,
  );
  console.log(`Fetched ${concepts.length} concepts`);

  // Fetch mappings
  let mappings = [];
  try {
    mappings = await oclService.fetchMappings(
      oclUrl,
      orgId,
      sourceId,
      auth,
      limit,
    );
    console.log(`Fetched ${mappings.length} mappings`);
  } catch (mappingError: any) {
    console.log(`Warning: Could not fetch mappings: ${mappingError.message}`);
    // Continue without mappings
  }

  // Transform concepts into mapping format
  const pluginFile: any = transformConceptsToMapping(concepts, mappings, {
    oclUrl: oclUrl || oclService.defaultOclUrl,
    orgId,
    sourceId,
    auth,
  });

  if (res) {
    res.json({
      success: true,
      message: `Generated terminology mapping with ${Object.keys(pluginFile.concepts).length} concepts and ${mappings.length} mappings`,
      pluginFile: pluginFile,
    });
  } else {
    return {
      success: true,
      message: `Generated terminology mapping with ${Object.keys(pluginFile.concepts).length} concepts and ${mappings.length} mappings`,
      pluginFile: pluginFile,
    };
  }
};

// Generate terminology-mapping.json from OCL
router.post("/generate", async (req, res) => {
  try {
    generate(req.body, res);
  } catch (error: any) {
    console.error("Error generating terminology mapping:", error);

    // Check if it's a URL validation error and return appropriate status code
    if (
      error.message.includes("OCL URL") ||
      error.message.includes("Invalid OCL URL") ||
      error.message.includes("protocol")
    ) {
      return res.status(400).json({
        error: "Invalid OCL URL configuration",
        message: error.message,
        hint: "Ensure the OCL URL is properly formatted (e.g., https://api.openconceptlab.org or http://internal-ocl-server:8080)",
      });
    }

    res.status(500).json({
      error: "Failed to generate terminology mapping",
      message: error.message,
    });
  }
});

function transformConceptsToMapping(concepts: any, mappings = [], config: any) {
  // Create pluginFile with explicit property order
  const pluginFile: any = {};
  pluginFile.lastSync = new Date().toISOString();
  pluginFile.oclAPIUrl = config.oclUrl;
  pluginFile.organization = config.orgId;
  pluginFile.source = config.sourceId;
  pluginFile.auth = {
    type: config.auth.type,
    ...(config.auth.username && { username: config.auth.username }),
    ...(config.auth.password && { password: config.auth.password }),
    ...(config.auth.token && { token: config.auth.token }),
  };
  pluginFile.concepts = {};

  // Create a lookup map for mappings by concept code
  const mappingsByCode: any = {};
  if (mappings.length > 0) {
    mappings.forEach((mapping: any) => {
      const fromCode = mapping.from_concept_code || mapping.fromConceptCode;
      if (fromCode) {
        if (!mappingsByCode[fromCode]) {
          mappingsByCode[fromCode] = [];
        }
        mappingsByCode[fromCode].push(mapping);
      }
    });
  }

  concepts.forEach((concept: any) => {
    // Get mappings for this concept
    const conceptMappings = mappingsByCode[concept.id] || [];

    // Transform mappings to array format
    const transformedMappings: any = [];
    conceptMappings.forEach((mapping: any) => {
      const mappingObj = {
        relationship: mapping.map_type || mapping.relationship || "SAME_AS",
        externalId: mapping.external_id || mapping.externalId,
        toConceptCode: mapping.to_concept_code || mapping.toConceptCode,
        toConceptName: mapping.to_concept_name || mapping.toConceptName,
        toSourceName: mapping.to_source_name || mapping.toSourceName,
        toSourceOwner: mapping.to_source_owner || mapping.toSourceOwner,
        toSourceUrl: mapping.to_source_url || mapping.toSourceUrl,
      };

      // Only add mapping if we have the essential fields
      if (mappingObj.toConceptCode && mappingObj.externalId) {
        transformedMappings.push(mappingObj);
      }
    });

    // Get concept name from various possible fields
    const conceptName =
      concept.display_name ||
      concept.name ||
      (concept.names && concept.names[0] && concept.names[0].name) ||
      concept.id;

    // Build concept URL in OCL format
    const conceptUrl = `/orgs/${config.orgId}/sources/${config.sourceId}/concepts/${concept.id}/`;

    // Add concept to mapping using concept code as key
    pluginFile.concepts[concept.id] = {
      concept: {
        code: concept.id,
        name: conceptName,
        sourceUrl: conceptUrl,
      },
      mappings: transformedMappings,
    };
  });

  return pluginFile;
}

export default router;
