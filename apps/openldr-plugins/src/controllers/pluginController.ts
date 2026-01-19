import express from "express";
import * as pluginService from "../services/pluginService";
import * as minioUtil from "../utils/minioUtil";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
const router = express.Router();
const upload = multer({ dest: path.join(__dirname, "../Uploads") });

router.post("/create-plugin", upload.single("pluginData"), async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).send("No file uploaded.");
  }

  // if (req.body.securityLevel !== 'low') {
  //   return res.status(400).send('Security level must be low for schema and recipient plugins');
  // }

  const fileContent = fs.readFileSync(file.path, "utf-8");

  // Generate a unique ID for the plugin
  const pluginId = await uuidv4();

  // Create MinIO object path
  // const minioObjectPath = `${pluginId}/${file.originalname}`;
  const minioObjectPath = `${pluginId}/${req.body.pluginType.toLowerCase()}_${req.body.pluginVersion}.js`;

  try {
    // Upload to MinIO first
    await minioUtil.putObject({
      bucketName: "plugins",
      objectName: minioObjectPath,
      data: fileContent,
    });

    const response = await pluginService.createPlugin({
      pluginId: pluginId,
      pluginType: req.body.pluginType,
      pluginName: req.body.pluginName,
      pluginVersion: req.body.pluginVersion,
      pluginMinioObjectPath: minioObjectPath,
      securityLevel: req.body.securityLevel,
      config: req.body.config,
      notes: req.body.notes,
    });

    fs.unlinkSync(file.path);
    res
      .status(200)
      .send(
        `Plugin created successfully. ${JSON.stringify(response, null, 2)}`
      );
  } catch (error: any) {
    fs.unlinkSync(file.path);
    res.status(500).send(`Failed to create plugin (${error.message})`);
  }
});

router.post("/create-mapper-plugin", async (req, res) => {
  const oclUrl = req.body.config.oclUrl;
  const orgId = req.body.config.orgId;
  const sourceId = req.body.config.sourceId;
  const auth = req.body.config.auth;

  const response = await axios.post(
    "http://openldr-terminology-mapping:3007/terminology/generate",
    {
      oclUrl: oclUrl,
      orgId: orgId,
      sourceId: sourceId,
      auth: auth,
    }
  );

  // Generate a unique ID for the plugin
  const pluginId = await uuidv4();

  // Create MinIO object path
  const minioObjectPath = `${pluginId}/terminology-mapping_${orgId}_${sourceId}_${req.body.pluginVersion}.json`;

  try {
    // Upload to MinIO first
    await minioUtil.putObject({
      bucketName: "plugins",
      objectName: minioObjectPath,
      data: JSON.stringify(response.data.pluginFile, null, 2),
    });

    const pluginCreateResponse = await pluginService.createPlugin({
      pluginId: pluginId,
      pluginType: "mapper",
      pluginName: req.body.pluginName,
      pluginVersion: req.body.pluginVersion,
      pluginMinioObjectPath: minioObjectPath,
      securityLevel: req.body.securityLevel,
      config: req.body.config,
      notes: req.body.notes,
    });

    res
      .status(200)
      .send(
        `Plugin created successfully. ${JSON.stringify(pluginCreateResponse, null, 2)}`
      );
  } catch (error: any) {
    console.log(error);
    res.status(500).send(`Failed to create plugin (${error.message})`);
  }
});

router.get("/get-plugin/:id", async (req, res) => {
  if (!req.params.id) {
    return res.status(404).send("No plugin ID found.");
  }

  try {
    // Get plugin metadata from database
    const plugin = await pluginService.getPluginById(req.params.id);
    if (!plugin) {
      throw new Error("Plugin not found");
    }

    // Get plugin file content from MinIO
    const pluginStream = await minioUtil.getObject({
      bucketName: "plugins",
      objectName: plugin.pluginMinioObjectPath,
    });

    // Read the plugin file content
    let pluginFile = "";
    await new Promise((resolve, reject) => {
      pluginStream.on("data", (chunk) => {
        pluginFile += chunk.toString();
      });
      pluginStream.on("end", resolve);
      pluginStream.on("error", (err) =>
        reject(new Error(`Failed to read plugin file: ${err.message}`))
      );
    });

    // Combine metadata and content
    const response = {
      ...plugin,
      pluginFile: pluginFile,
    };

    res.status(200).json(response);
  } catch (error: any) {
    res
      .status(404)
      .send(`No plugin found for ID: ${req.params.id} (${error.message})`);
  }
});

router.get("/get-plugins", async (req, res) => {
  const pluginType = req.query.pluginType;

  try {
    const plugins = await pluginService.getPluginsByType(pluginType);

    res.status(200).json(plugins);
  } catch (error: any) {
    res.status(404).send(error.message);
  }
});

router.get("/plugins", async (req, res) => {
  const plugins = await pluginService.getAllPlugins();

  res.status(200).json(plugins);
});

router.put(
  "/update-plugin/:id",
  upload.single("pluginData"),
  async (req, res) => {
    const file = req.file;
    let fileContent = null;
    if (file) {
      fileContent = fs.readFileSync(file.path, "utf-8");
    }

    const pluginId = req.params.id!;

    try {
      // generate new minio object path
      const minioObjectPath = `${pluginId}/${req.body.pluginType.toLowerCase()}_${req.body.pluginVersion}.js`;

      // Add new plugin version as MinIO object
      if (file) {
        await minioUtil.putObject({
          bucketName: "plugins",
          objectName: minioObjectPath,
          data: fileContent,
        });
      }

      const response = await pluginService.updatePlugin({
        pluginId: pluginId,
        pluginType: req.body.pluginType,
        pluginName: req.body.pluginName,
        pluginVersion: req.body.pluginVersion,
        pluginMinioObjectPath: minioObjectPath,
        securityLevel: req.body.securityLevel,
        config: req.body.config ? JSON.stringify(req.body.config) : null,
        notes: req.body.notes,
      });

      file && fs.unlinkSync(file.path);
      res.status(200).send(`Plugin updated successfully.`);
    } catch (error: any) {
      file && fs.unlinkSync(file.path);
      res.status(500).send(`Failed to update plugin (${error.message})`);
    }
  }
);

router.put("/update-mapper-plugin/:id", async (req, res) => {
  const pluginId = req.params.id;
  const config = req.body.config || {};
  const { oclUrl, orgId, sourceId, auth } = config;

  try {
    // Get existing plugin to check version and config
    const existingPlugin = await pluginService.getPluginById(pluginId);
    if (!existingPlugin) {
      throw new Error("Plugin not found");
    }

    // Use existing config directly (already a JavaScript object from JSON type)
    const existingConfig: any = existingPlugin.config || {};
    const configChanged =
      oclUrl !== (existingConfig.oclUrl || "") ||
      orgId !== (existingConfig.orgId || "") ||
      sourceId !== (existingConfig.sourceId || "") ||
      auth !== (existingConfig.auth || "");

    if (
      configChanged &&
      req.body.pluginVersion === existingPlugin.pluginVersion
    ) {
      throw new Error(
        "Plugin version must be updated when config values are changed."
      );
    }

    let pluginMinioObjectPath = req.body.pluginMinioObjectPath;

    if (configChanged) {
      // Call terminology mapping service
      const response = await axios.post(
        "http://openldr-terminology-mapping:3007/terminology/generate",
        {
          oclUrl: oclUrl,
          orgId: orgId,
          sourceId: sourceId,
          auth: auth,
        }
      );

      // Create new MinIO object path
      const minioObjectPath = `${pluginId}/terminology-mapping_${orgId}_${sourceId}_${req.body.pluginVersion}.json`;

      // Upload to MinIO
      await minioUtil.putObject({
        bucketName: "plugins",
        objectName: minioObjectPath,
        data: JSON.stringify(response.data.pluginFile, null, 2),
      });

      pluginMinioObjectPath = minioObjectPath;
    }

    // Update plugin metadata
    const pluginUpdateResponse = await pluginService.updatePlugin({
      pluginId: pluginId,
      pluginType: "mapper",
      pluginName: req.body.pluginName,
      pluginVersion: req.body.pluginVersion,
      pluginMinioObjectPath: pluginMinioObjectPath,
      securityLevel: req.body.securityLevel,
      config: config, // Pass config directly without JSON.stringify
      notes: req.body.notes,
    });

    res
      .status(200)
      .send(
        `Plugin updated successfully. ${JSON.stringify(pluginUpdateResponse, null, 2)}`
      );
  } catch (error: any) {
    console.error(error);
    res.status(500).send(`Failed to update mapper plugin (${error.message})`);
  }
});

router.delete("/delete-plugin/:id", async (req, res) => {
  if (!req.params.id) {
    return res.status(404).send("No plugin ID found.");
  }

  try {
    // Get plugin to get MinIO path before deletion
    const plugin = await pluginService.getPluginById(req.params.id);
    if (!plugin) {
      throw new Error("Plugin not found");
    }

    // Delete from MinIO
    await minioUtil.deleteObject({
      bucketName: "plugins",
      objectName: `${plugin.pluginId}`,
    });

    const response = await pluginService.deletePlugin(req.params.id);
    res
      .status(200)
      .send(
        `Plugin deleted successfully. ${JSON.stringify(response, null, 2)}`
      );
  } catch (error: any) {
    res
      .status(404)
      .send(
        `Failed to delete plugin with ID: ${req.params.id} (${error.message})`
      );
  }
});

router.post("/regenerate-mapper-plugin/:id", async (req, res) => {
  const pluginId = req.params.id;
  const config = req.body.config || {};
  const { oclUrl, orgId, sourceId, auth } = config;

  try {
    const existingPlugin = await pluginService.getPluginById(pluginId);
    if (!existingPlugin) {
      throw new Error("Plugin not found");
    }

    if (req.body.pluginVersion === existingPlugin.pluginVersion) {
      throw new Error(
        "Plugin version must be updated to regenerate the plugin."
      );
    }

    const response = await axios.post(
      "http://openldr-terminology-mapping:3007/terminology/generate",
      {
        oclUrl: oclUrl,
        orgId: orgId,
        sourceId: sourceId,
        auth: auth,
      }
    );

    const minioObjectPath = `${pluginId}/terminology-mapping_${orgId}_${sourceId}_${req.body.pluginVersion}.json`;

    await minioUtil.putObject({
      bucketName: "plugins",
      objectName: minioObjectPath,
      data: JSON.stringify(response.data.pluginFile, null, 2),
    });

    const pluginUpdateResponse = await pluginService.updatePlugin({
      pluginId: pluginId,
      pluginType: existingPlugin.pluginType,
      pluginName: existingPlugin.pluginName,
      pluginVersion: req.body.pluginVersion,
      pluginMinioObjectPath: minioObjectPath,
      securityLevel: existingPlugin.securityLevel,
      config: existingPlugin.config,
      notes: existingPlugin.notes,
    });

    res
      .status(200)
      .send(
        `Successfully regenerated mapper plugin. ${JSON.stringify(pluginUpdateResponse, null, 2)}`
      );
  } catch (error: any) {
    console.error(error);
    res
      .status(500)
      .send(`Failed to regenerate mapper plugin (${error.message})`);
  }
});

export { router };
