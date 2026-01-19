import "dotenv/config";
import * as models from "./models";
import { DynamicModelManager } from "./utils/manager";
import { generateMessageMetadata } from "./schemas/messageMetadataSchema";

const schemas = {
  messageMetadata: {
    generateMessageMetadata,
  },
};

export { DynamicModelManager, models, schemas };
