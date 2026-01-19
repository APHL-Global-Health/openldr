import express from "express";
import { DynamicModelManager } from "@openldr/internal-database";
import dataProcessingController from "./controllers/dataProcessingController";
const app = express();

app.use(express.json());
app.use("/data-processing", dataProcessingController);

// Initialize database and start app
(async () => {
  try {
    const modelManager = await DynamicModelManager.create(
      process.env.INTERNAL_DB_PREFERRED_DIALET
    );

    // Start the server
    const port = process.env.DATA_PROCESSING_PORT || 3001;
    app.listen(port, () => {
      console.log(`OpenLDR Data Processing service running on port ${port}`);
    });
  } catch (error) {
    console.error("Service initialization failed:", error);
    process.exit(1);
  }
})();
