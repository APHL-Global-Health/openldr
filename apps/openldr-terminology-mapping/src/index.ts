import express from "express";
import * as terminologyController from "./controllers/terminologyController";
const app = express();

app.use(express.json());
app.use("/terminology", terminologyController.router);

// Start the server
const port = process.env.TERMINOLOGY_MAPPING_PORT || 3007;
app.listen(port, () => {
  console.log(`OpenLDR Terminology Mapping service running on port ${port}`);
});
