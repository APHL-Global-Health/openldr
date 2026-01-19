import express from "express";
import { DynamicModelManager } from "@openldr/internal-database";
import * as pluginController from "./controllers/pluginController";
const app = express();

app.use(express.json());
app.use("/plugin", pluginController.router);

// Initialize database and start app
(async () => {
  try {
    const modelManager = await DynamicModelManager.create(
      process.env.INTERNAL_DB_PREFERRED_DIALET
    );

    // Start the server
    const port = process.env.PLUGIN_PORT || 3006;
    app.listen(port, () => {
      console.log(`OpenLDR Plugins service running on port ${port}`);
    });
  } catch (error) {
    console.error("Service initialization failed:", error);
    process.exit(1);
  }
})();
