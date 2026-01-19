import { DynamicModelManager } from "@openldr/internal-database";
import { buildSequelizeWhere } from "../lib/utils";
import { validator } from "../lib/validator";
import { getEnryForm } from "../services/dataEntryService";
import express from "express";
import { v4 as uuidv4 } from "uuid";
import * as minioUtil from "../utils/minioUtil";
import * as keycloakUtil from "../utils/keycloakUtil";
import axios from "axios";

const authentication = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  let token = null;
  const authHeader = String(req.headers["authorization"] || "");

  if (authHeader.startsWith("Bearer "))
    token = authHeader.substring(7, authHeader.length);
  else if (authHeader.startsWith("token "))
    token = authHeader.substring(6, authHeader.length);
  else
    token = req.body.token || req.query.token || req.headers["x-access-token"];

  if (token) {
    try {
      // TODO this is handled by APISIX
      // req.user = await verifyUser(token);
      return next();
    } catch (err: any) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid or expired token",
        details: err.message,
      });
    }
  } else {
    return res.status(403).json({
      error: "Unauthorized",
      message: "Invalid or expired token",
      details: "A token is required for authentication",
    });
  }
};

const isPlainObject = (variable: any) => {
  return (
    typeof variable === "object" &&
    variable !== null &&
    !(variable instanceof String)
  );
};

export const router = (modelManager: DynamicModelManager) => {
  const _router = express.Router();

  _router.post(
    "/data/:name",
    authentication,
    async (req: express.Request, res: express.Response) => {
      try {
        const table = req.params.name as string;
        const { where, ...rest } = req.body;

        let options: any = {};
        if (rest) {
          options = { ...rest };
        }

        if (where) {
          options["where"] = buildSequelizeWhere(where);
        }

        const data = await modelManager.getData(table, options);

        // return result based on return type format
        res.status(200).json({ status: "successful", data });
      } catch (e: any) {
        // return result based on return type format
        res.status(502).json({ status: "failed", data: e.message });
      }
    }
  );

  _router.get(
    "/table/:name",
    authentication,
    async (req: express.Request, res: express.Response) => {
      const name = req.params.name as string;

      const cols = await modelManager.getColums(name);

      // return result based on return type format
      res.status(200).json({ status: "successful", data: cols });
    }
  );

  _router.get(
    "/tables",
    authentication,
    async (req: express.Request, res: express.Response) => {
      const tables = (await modelManager.getAllTables()).sort();
      res.status(200).json({ status: "successful", data: tables });
    }
  );

  _router.post(
    "/table/:version/:name/:type",
    authentication,
    async (req: express.Request, res: express.Response) => {
      const name = req.params.name as string;
      const version = req.params.version as string;
      const type = req.params.type as string;
      const data = req.body;

      const schema = await getEnryForm(modelManager, name, version, type);
      if (name === "plugins") {
        if (data.pluginType.toLowerCase() === "mapper") {
          schema.required = schema.required.filter(
            (r: any) => r !== "pluginMinioObjectPath"
          );
        }
      }

      var val = validator.validate(data, schema);
      if (!val.valid) {
        res.status(200).json({ status: "Failed", data: val });
      } else {
        try {
          const cols = await modelManager.getColums(name!);

          const primaryKeys = Object.fromEntries(
            (cols || [])
              .filter((col: any) => col.PrimaryKey && col.Type === "uuid")
              .map((col: any) => [col.Name, uuidv4()])
          );

          let content = {
            ...data,
            ...primaryKeys,
          };

          if (name === "plugins") {
            let fileContent = null;
            let minioObjectPath = null;
            const pluginId = primaryKeys["pluginId"];

            if (content.pluginType.toLowerCase() !== "mapper") {
              if (
                content.pluginMinioObjectPath &&
                !isPlainObject(content.pluginMinioObjectPath)
              ) {
                return res
                  .status(404)
                  .json({ status: "Failed", data: "No file to upload." });
              }

              fileContent = content.pluginMinioObjectPath.content;
              minioObjectPath = `${pluginId}/${content.pluginType.toLowerCase()}_${content.pluginVersion}.js`;
            } else if (content.pluginType.toLowerCase() === "mapper") {
              const config = content.config;
              if (config && typeof config === "string") {
                const _config = JSON.parse(config);
                const response = await axios.post(
                  "http://openldr-terminology-mapping:3007/terminology/generate",
                  {
                    oclUrl: _config.oclUrl,
                    orgId: _config.orgId,
                    sourceId: _config.sourceId,
                    auth: _config.auth,
                  }
                );

                fileContent = JSON.stringify(response.data.pluginFile, null, 2);
                minioObjectPath = `${pluginId}/terminology-mapping_${_config.orgId}_${_config.sourceId}_${content.pluginVersion}.json`;
              }
            }

            if (fileContent === null || minioObjectPath === null) {
              return res
                .status(404)
                .json({ status: "Failed", data: "No file to upload." });
            }

            // Upload to MinIO first
            await minioUtil.putObject({
              bucketName: "plugins",
              objectName: minioObjectPath,
              data: fileContent,
            });

            content = {
              ...data,
              ...primaryKeys,
              pluginMinioObjectPath: minioObjectPath,
            };
          } else if (name === "users") {
            if (!content.temporaryPassword) content.temporaryPassword = 12345;

            const keycloakUser = await keycloakUtil.createUser({
              email: content.email,
              firstName: content.firstName,
              lastName: content.lastName,
              phoneNumber: content.phoneNumber,
              temporaryPassword: content.temporaryPassword,
            });

            content = {
              ...data,
              userId: keycloakUser["id"],
            };
          } else if (name === "facilities") {
            const facilityId = primaryKeys["facilityId"];

            // Create MinIO bucket for the facility
            await minioUtil.createBucket(facilityId);

            await minioUtil.setBucketKafkaNotifications(facilityId);
          }

          const model = await modelManager.getModel(name!);
          const resp = await model.create(content);

          res.status(200).json({
            status: "successful",
            data: resp,
            primaryKeys,
            cols,
          });
        } catch (error: any) {
          res.status(200).json({ status: "Failed", data: error });
        }
      }
    }
  );

  _router.delete(
    "/table/:version/:name/:type",
    authentication,
    async (req: express.Request, res: express.Response) => {
      const name = req.params.name as string;
      const version = req.params.version as string;
      const type = req.params.type as string;
      const data = req.body;

      try {
        const cols = await modelManager.getColums(name!);
        const primaryKey = (cols || []).find(
          (col: any) => col.PrimaryKey && col.Type === "uuid"
        );

        const whereClause: any = {
          where: {
            [primaryKey.Name]: data,
          },
        };

        if (name === "plugins") {
          let _data = data;
          if (!Array.isArray(data)) {
            _data = [data];
          }

          for (let x = 0; x < _data.length; x++) {
            const pluginId = _data[x];
            // Delete from MinIO
            await minioUtil.deleteObject({
              bucketName: "plugins",
              objectName: `${pluginId}`,
            });
          }
        } else if (name === "users") {
          let _data = data;
          if (!Array.isArray(data)) {
            _data = [data];
          }

          for (let x = 0; x < _data.length; x++) {
            // Delete from Keycloak
            await keycloakUtil.deleteUser(data[x]);
          }
        } else if (name === "facilities") {
          let _data = data;
          if (!Array.isArray(data)) {
            _data = [data];
          }

          for (let x = 0; x < _data.length; x++) {
            const facilityId = _data[x];
            // Delete from MinIO
            await minioUtil.deleteBucket(facilityId);
          }
        }

        const model = await modelManager.getModel(name!);
        const resp = await model.destroy(whereClause);

        res.status(200).json({
          status: "successful",
          data: resp,
          keys: data,
        });
      } catch (error: any) {
        res.status(200).json({ status: "Failed", data: error });
      }
    }
  );

  _router.put(
    "/table/:version/:name/:type",
    authentication,
    async (req: express.Request, res: express.Response) => {
      const name = req.params.name as string;
      const version = req.params.version as string;
      const type = req.params.type as string;
      const data = req.body;
      // Remove all null/undefined properties
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value != null)
      );

      const schema = await getEnryForm(modelManager, name, version, type, true);
      if (name === "plugins") {
        if (data.pluginType.toLowerCase() === "mapper") {
          schema.required = schema.required.filter(
            (r: any) => r !== "pluginMinioObjectPath"
          );
        }
      }

      var val = validator.validate(cleanData, schema);
      if (!val.valid) {
        res.status(200).json({ status: "Failed", data: val });
      } else {
        try {
          const cols = await modelManager.getColums(name!);
          const primaryKey = (cols || []).find(
            (col: any) => col.PrimaryKey && col.Type === "uuid"
          );
          const whereClause: any = {
            where: {
              [primaryKey.Name]: cleanData[primaryKey.Name],
            },
          };

          const updateData = { ...cleanData };
          delete updateData[primaryKey.Name];

          let content: any = updateData;

          if (name === "plugins") {
            let fileContent = null;
            let minioObjectPath = null;
            const pluginId = data["pluginId"];
            if (content.pluginType.toLowerCase() !== "mapper") {
              if (
                content.pluginMinioObjectPath &&
                isPlainObject(content.pluginMinioObjectPath)
              ) {
                fileContent = content.pluginMinioObjectPath.content;
                minioObjectPath = `${pluginId}/${req.body.pluginType.toLowerCase()}_${req.body.pluginVersion}.js`;
              }
            } else if (content.pluginType.toLowerCase() === "mapper") {
              const _model = await modelManager.getModel(name!);
              const existingPlugin = await _model.findByPk(pluginId);
              if (!existingPlugin) {
                return res
                  .status(404)
                  .json({ status: "Failed", data: "Plugin not found" });
              }

              const config = content.config;
              if (config && typeof config === "string") {
                const _config = JSON.parse(config);
                const { oclUrl, orgId, sourceId, auth } = _config;
                const existingConfig: any = existingPlugin.config || {};

                const configChanged =
                  oclUrl !== (existingConfig.oclUrl || "") ||
                  orgId !== (existingConfig.orgId || "") ||
                  sourceId !== (existingConfig.sourceId || "") ||
                  auth !== (existingConfig.auth || "");

                if (
                  configChanged &&
                  content.pluginVersion === existingPlugin.pluginVersion
                ) {
                  return res.status(200).json({
                    status: "Failed",
                    data: "Plugin version must be updated when config values are changed.",
                  });
                }

                minioObjectPath = existingPlugin.pluginMinioObjectPath;
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

                  fileContent = JSON.stringify(
                    response.data.pluginFile,
                    null,
                    2
                  );
                  // Create new MinIO object path
                  minioObjectPath = `${pluginId}/terminology-mapping_${orgId}_${sourceId}_${req.body.pluginVersion}.json`;

                  // Upload to MinIO
                  await minioUtil.putObject({
                    bucketName: "plugins",
                    objectName: minioObjectPath,
                    data: fileContent,
                  });
                }
              }
            }

            if (fileContent === null || minioObjectPath === null) {
              return res
                .status(404)
                .json({ status: "Failed", data: "No file to upload." });
            }

            // Upload to MinIO first
            await minioUtil.putObject({
              bucketName: "plugins",
              objectName: minioObjectPath,
              data: fileContent,
            });

            content = {
              ...updateData,
              pluginMinioObjectPath: minioObjectPath,
            };
          } else if (name === "users") {
            await keycloakUtil.updateUser({
              userId: data["userId"],
              email: content.email,
              firstName: content.firstName,
              lastName: content.lastName,
              phoneNumber: content.phoneNumber,
            });
          }

          const model = await modelManager.getModel(name!);
          const resp = await model.update(content, whereClause);

          res.status(200).json({
            status: "successful",
            data: resp,
            updateData,
            whereClause,
            cols,
          });
        } catch (error: any) {
          res.status(200).json({ status: "Failed", data: error });
        }
      }
    }
  );

  return _router;
};
