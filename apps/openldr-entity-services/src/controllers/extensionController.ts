// routes/extensions.routes.ts
import express from "express";
import multer from "multer";
import unzipper from "unzipper";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs-extra";
import { Op } from "@sequelize/core";
import semver from "semver";
import { DynamicModelManager } from "@openldr/internal-database";
import { extractClientIdFromToken } from "../lib/jwt";

// Configure multer for file uploads
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname) === ".zip") {
      cb(null, true);
    } else {
      cb(new Error("Only .zip files are allowed"));
    }
  },
});

// Model names
const MODELS = {
  EXTENSIONS: "extensions",
  EXTENSION_VERSIONS: "extensionVersions",
  EXTENSION_USERS: "extensionUsers",
  EXTENSION_PERMISSIONS: "extensionPermissions",
  EXTENSION_REVIEWS: "extensionReviews",
};

// Helper to get userId from token
const getUserId = (req: any): string => {
  const clientId = extractClientIdFromToken(req);
  if (!clientId) {
    throw new Error("No client_id found in authorization token");
  }
  return clientId;
};

// Helper to setup associations
const setupAssociations = async (modelManager: DynamicModelManager) => {
  const Extension = await modelManager.getModel(MODELS.EXTENSIONS);
  const ExtensionVersion = await modelManager.getModel(
    MODELS.EXTENSION_VERSIONS
  );
  const ExtensionUser = await modelManager.getModel(MODELS.EXTENSION_USERS);
  const ExtensionPermission = await modelManager.getModel(
    MODELS.EXTENSION_PERMISSIONS
  );

  // Extension -> ExtensionVersion (one-to-many)
  if (!Extension.associations.versions) {
    Extension.hasMany(ExtensionVersion, {
      foreignKey: "extensionId",
      as: "versions",
    });
  }

  // ExtensionVersion -> Extension (many-to-one)
  if (!ExtensionVersion.associations.extension) {
    ExtensionVersion.belongsTo(Extension, {
      foreignKey: "extensionId",
      as: "extension",
    });
  }

  // ExtensionVersion -> ExtensionPermission (one-to-many)
  if (!ExtensionVersion.associations.permissions) {
    ExtensionVersion.hasMany(ExtensionPermission, {
      foreignKey: "versionId",
      as: "permissions",
    });
  }

  // ExtensionUser -> Extension
  if (!ExtensionUser.associations.extension) {
    ExtensionUser.belongsTo(Extension, {
      foreignKey: "extensionId",
      as: "extension",
    });
  }

  // ExtensionUser -> ExtensionVersion
  if (!ExtensionUser.associations.version) {
    ExtensionUser.belongsTo(ExtensionVersion, {
      foreignKey: "versionId",
      as: "version",
    });
  }
};

export const router = (modelManager: DynamicModelManager) => {
  const _router = express.Router();

  // Initialize associations
  setupAssociations(modelManager);

  // ==================== PUBLIC EXTENSION ROUTES ====================

  /**
   * GET /extensions
   * Get all published extensions for the marketplace hub
   * Query params: search, category, tag, sort (downloads|rating|recent|name)
   */
  _router.get("/", async (req, res) => {
    try {
      const { search, category, tag, sort = "downloads" } = req.query;

      const where: any = { isActive: true };

      // Search by name or description
      if (search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } },
        ];
      }

      // Filter by category
      if (category) {
        where.categories = { [Op.contains]: [category] };
      }

      // Filter by tag
      if (tag) {
        where.tags = { [Op.contains]: [tag] };
      }

      const orderMap: Record<string, any> = {
        downloads: [["totalDownloads", "DESC"]],
        rating: [["averageRating", "DESC"]],
        recent: [["lastUpdated", "DESC"]],
        name: [["name", "ASC"]],
      };

      const Extension = await modelManager.getModel(MODELS.EXTENSIONS);
      const ExtensionVersion = await modelManager.getModel(
        MODELS.EXTENSION_VERSIONS
      );

      const extensions = await Extension.findAll({
        where,
        include: [
          {
            model: ExtensionVersion,
            as: "versions",
            where: { isPublished: true, isLatest: true },
            required: true,
            attributes: ["versionId", "version", "publishedAt"],
          },
        ],
        order: orderMap[sort as string] || orderMap.downloads,
      });

      // Return only manifest-relevant data for the hub
      const response = extensions.map((ext: any) => ({
        extensionId: ext.extensionId,
        packageId: ext.packageId,
        name: ext.name,
        description: ext.description,
        author: ext.author,
        authorDomain: ext.authorDomain,
        iconUrl: ext.iconUrl,
        categories: ext.categories,
        tags: ext.tags,
        totalDownloads: ext.totalDownloads,
        averageRating: ext.averageRating,
        ratingCount: ext.ratingCount,
        license: ext.license,
        lastUpdated: ext.lastUpdated,
        latestVersion: ext.versions[0]?.version,
      }));

      res.json(response);
    } catch (error: any) {
      console.error("Failed to fetch extensions:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch extensions", details: error.message });
    }
  });

  /**
   * GET /extensions/:packageId/info
   * Get detailed information about a specific extension
   */
  _router.get("/:packageId/info", async (req, res) => {
    try {
      const Extension = await modelManager.getModel(MODELS.EXTENSIONS);
      const ExtensionVersion = await modelManager.getModel(
        MODELS.EXTENSION_VERSIONS
      );

      const extension = await Extension.findOne({
        where: { packageId: req.params.packageId, isActive: true },
        include: [
          {
            model: ExtensionVersion,
            as: "versions",
            where: { isPublished: true },
            required: false,
            order: [["publishedAt", "DESC"]],
          },
        ],
      });

      if (!extension) {
        return res.status(404).json({ error: "Extension not found" });
      }

      res.json(extension);
    } catch (error: any) {
      console.error("Failed to fetch extension:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch extension", details: error.message });
    }
  });

  // ==================== VERSION ROUTES ====================

  /**
   * GET /extensions/:packageId/versions
   * Get all published versions for an extension
   */
  _router.get("/:packageId/versions", async (req, res) => {
    try {
      const Extension = await modelManager.getModel(MODELS.EXTENSIONS);
      const extension = await Extension.findOne({
        where: { packageId: req.params.packageId },
      });

      if (!extension) {
        return res.status(404).json({ error: "Extension not found" });
      }

      const ExtensionVersion = await modelManager.getModel(
        MODELS.EXTENSION_VERSIONS
      );
      const versions = await ExtensionVersion.findAll({
        where: {
          extensionId: extension.extensionId,
          isPublished: true,
        },
        order: [["publishedAt", "DESC"]],
      });

      res.json(versions);
    } catch (error: any) {
      console.error("Failed to fetch versions:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch versions", details: error.message });
    }
  });

  /**
   * GET /extensions/:packageId/versions/:version
   * Get specific version details
   */
  _router.get("/:packageId/versions/:version", async (req, res) => {
    try {
      const Extension = await modelManager.getModel(MODELS.EXTENSIONS);
      const extension = await Extension.findOne({
        where: { packageId: req.params.packageId },
      });

      if (!extension) {
        return res.status(404).json({ error: "Extension not found" });
      }

      const ExtensionVersion = await modelManager.getModel(
        MODELS.EXTENSION_VERSIONS
      );
      const ExtensionPermission = await modelManager.getModel(
        MODELS.EXTENSION_PERMISSIONS
      );

      const version = await ExtensionVersion.findOne({
        where: {
          extensionId: extension.extensionId,
          version: req.params.version,
        },
        include: [
          {
            model: ExtensionPermission,
            as: "permissions",
            required: false,
          },
        ],
      });

      if (!version) {
        return res.status(404).json({ error: "Version not found" });
      }

      res.json(version);
    } catch (error: any) {
      console.error("Failed to fetch version:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch version", details: error.message });
    }
  });

  /**
   * POST /extensions/:packageId/versions
   * Publish a new version of an extension
   */
  _router.post(
    "/:packageId/versions",
    upload.single("package"),
    async (req, res) => {
      try {
        const packageId = req.params.packageId;
        const file = req.file;

        if (!packageId) {
          return res.status(400).json({ error: "Package id required" });
        }

        if (!file) {
          return res.status(400).json({ error: "No package file uploaded" });
        }

        // Parse manifest from uploaded file or request body
        let manifest;
        try {
          manifest = JSON.parse(req.body.manifest);
        } catch (error) {
          await fs.remove(file.path);
          return res.status(400).json({ error: "Invalid manifest JSON" });
        }

        // Validate semver
        if (!semver.valid(manifest.version)) {
          await fs.remove(file.path);
          return res.status(400).json({ error: "Invalid semantic version" });
        }

        // Validate manifest structure
        if (!manifest.id || manifest.id !== packageId) {
          await fs.remove(file.path);
          return res
            .status(400)
            .json({ error: "Manifest ID doesn't match packageId" });
        }

        const Extension = await modelManager.getModel(MODELS.EXTENSIONS);
        const ExtensionVersion = await modelManager.getModel(
          MODELS.EXTENSION_VERSIONS
        );

        // Check if extension exists, create if not
        let extension = await Extension.findOne({
          where: { packageId },
        });

        if (!extension) {
          extension = await Extension.create({
            extensionId: uuidv4(),
            packageId,
            name: manifest.name,
            description: manifest.description || "",
            author: manifest.author || "Unknown",
            authorDomain: manifest.publisher?.domain || null,
            iconUrl: manifest.icon?.package || null,
            license: manifest.license || null,
            repositoryUrl: manifest.repository || null,
            categories: manifest.categories || [],
            tags: manifest.tags || [],
            readme: manifest.readme || "",
            features: manifest.features || "",
            lastUpdated: new Date(),
            isActive: true,
          });
        }

        // Check if version already exists
        const existingVersion = await ExtensionVersion.findOne({
          where: {
            extensionId: extension.extensionId,
            version: manifest.version,
          },
        });

        if (existingVersion) {
          await fs.remove(file.path);
          return res.status(409).json({ error: "Version already exists" });
        }

        // Extract and validate the zip file
        const extractPath = path.resolve(
          "uploads",
          "extracted",
          packageId,
          manifest.version
        );
        await fs.ensureDir(extractPath);

        try {
          await fs
            .createReadStream(file.path)
            .pipe(unzipper.Extract({ path: extractPath }))
            .promise();
        } catch (error) {
          await fs.remove(file.path);
          await fs.remove(extractPath);
          return res.status(400).json({ error: "Failed to extract zip file" });
        }

        // Verify required files exist
        const manifestPath = path.resolve(extractPath, "manifest.json");
        const indexPath = path.resolve(
          extractPath,
          manifest.main || "index.js"
        );

        if (!(await fs.pathExists(manifestPath))) {
          await fs.remove(file.path);
          await fs.remove(extractPath);
          return res
            .status(400)
            .json({ error: "manifest.json not found in package" });
        }

        if (!(await fs.pathExists(indexPath))) {
          await fs.remove(file.path);
          await fs.remove(extractPath);
          return res.status(400).json({
            error: `${manifest.main || "index.js"} not found in package`,
          });
        }

        // Move to permanent storage
        const storageDir = path.resolve(
          "storage",
          "extensions",
          packageId,
          manifest.version
        );
        await fs.ensureDir(storageDir);
        await fs.move(extractPath, storageDir, { overwrite: true });

        // Store the package file
        const packageStoragePath = path.resolve(
          storageDir,
          `${packageId}-${manifest.version}.zip`
        );
        await fs.move(file.path, packageStoragePath);

        const codeUrl = `/storage/extensions/${packageId}/${manifest.version}/${manifest.main || "index.js"}`;

        // Unmark previous "latest" version
        await ExtensionVersion.update(
          { isLatest: false },
          {
            where: {
              extensionId: extension.extensionId,
              isLatest: true,
            },
          }
        );

        // Create version record
        const newVersion = await ExtensionVersion.create({
          versionId: uuidv4(),
          extensionId: extension.extensionId,
          version: manifest.version,
          changelog: req.body.changelog || manifest.changelog || "",
          codeUrl,
          mainFile: manifest.main || "index.js",
          isBreaking: req.body.breaking === "true" || false,
          minAppVersion:
            req.body.minAppVersion || manifest.minAppVersion || null,
          maxAppVersion:
            req.body.maxAppVersion || manifest.maxAppVersion || null,
          manifest,
          activationEvents: manifest.activationEvents || [],
          isPublished: true,
          isLatest: true,
          publishedAt: new Date(),
        });

        // Create permission records
        if (manifest.permissions && manifest.permissions.length > 0) {
          const ExtensionPermission = await modelManager.getModel(
            MODELS.EXTENSION_PERMISSIONS
          );
          const permissions = manifest.permissions.map((perm: string) => ({
            id: uuidv4(),
            versionId: newVersion.versionId,
            permission: perm,
            description: null, // Could extract from manifest if available
            isDangerous:
              perm.includes("network") || perm.includes("filesystem"),
          }));

          await ExtensionPermission.bulkCreate(permissions);
        }

        // Update extension's lastUpdated
        await extension.update({ lastUpdated: new Date() });

        res.status(201).json(newVersion);
      } catch (error: any) {
        console.error("Publish error:", error);

        // Cleanup on error
        if (req.file) {
          await fs.remove(req.file.path).catch(() => {});
        }

        res.status(500).json({
          error: "Failed to publish version",
          details: error.message,
        });
      }
    }
  );

  /**
   * GET /extensions/:packageId/check-updates
   * Check if updates are available for current version
   */
  _router.get("/:packageId/check-updates", async (req, res) => {
    try {
      const { currentVersion, appVersion } = req.query;

      if (!currentVersion || !appVersion) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      const Extension = await modelManager.getModel(MODELS.EXTENSIONS);
      const extension = await Extension.findOne({
        where: { packageId: req.params.packageId },
      });

      if (!extension) {
        return res.status(404).json({ error: "Extension not found" });
      }

      const ExtensionVersion = await modelManager.getModel(
        MODELS.EXTENSION_VERSIONS
      );
      const versions = await ExtensionVersion.findAll({
        where: {
          extensionId: extension.extensionId,
          isPublished: true,
        },
      });

      // Find newer compatible versions
      const compatibleUpdates = versions.filter((v: any) => {
        const isNewer = semver.gt(v.version, currentVersion as string);
        const minOk =
          !v.minAppVersion || semver.gte(appVersion as string, v.minAppVersion);
        const maxOk =
          !v.maxAppVersion || semver.lte(appVersion as string, v.maxAppVersion);
        return isNewer && minOk && maxOk;
      });

      if (compatibleUpdates.length === 0) {
        return res.json({ updateAvailable: false });
      }

      // Get latest update
      const latestUpdate = compatibleUpdates.sort((a: any, b: any) =>
        semver.compare(b.version, a.version)
      )[0];

      res.json({
        updateAvailable: true,
        latestVersion: latestUpdate,
        hasBreakingChanges: latestUpdate.isBreaking,
      });
    } catch (error: any) {
      console.error("Failed to check for updates:", error);
      res
        .status(500)
        .json({ error: "Failed to check for updates", details: error.message });
    }
  });

  /**
   * GET /extensions/version/:versionId/download
   * Download extension code for a specific version
   */
  _router.get("/version/:versionId/download", async (req, res) => {
    try {
      const ExtensionVersion = await modelManager.getModel(
        MODELS.EXTENSION_VERSIONS
      );
      const version = await ExtensionVersion.findByPk(req.params.versionId);

      if (!version) {
        return res.status(404).json({ error: "Version not found" });
      }

      const Extension = await modelManager.getModel(MODELS.EXTENSIONS);
      const extension = await Extension.findByPk(version.extensionId);

      if (!extension) {
        return res.status(404).json({ error: "Extension not found" });
      }

      // Increment download counts
      await version.increment("downloads");
      await extension.increment("totalDownloads");

      // Read code from storage
      const codePath = path.join(process.cwd(), version.codeUrl);

      if (!(await fs.pathExists(codePath))) {
        return res.status(404).json({ error: "Extension code not found" });
      }

      const code = await fs.readFile(codePath, "utf-8");

      res.json({
        manifest: version.manifest,
        code,
        version: version.version,
      });
    } catch (error: any) {
      console.error("Failed to download extension:", error);
      res.status(500).json({
        error: "Failed to download extension",
        details: error.message,
      });
    }
  });

  // ==================== USER EXTENSION ROUTES (REQUIRE AUTH) ====================

  /**
   * GET /extensions/user/installed
   * Get all extensions installed by the current user
   */
  _router.get("/user/installed", async (req, res) => {
    try {
      const userId = getUserId(req);
      const { status } = req.query;

      const where: any = { userId };
      if (status && status !== "all") {
        where.status = status;
      } else {
        // Exclude uninstalled by default
        where.status = { [Op.ne]: "uninstalled" };
      }

      const ExtensionUser = await modelManager.getModel(MODELS.EXTENSION_USERS);
      const Extension = await modelManager.getModel(MODELS.EXTENSIONS);
      const ExtensionVersion = await modelManager.getModel(
        MODELS.EXTENSION_VERSIONS
      );

      const userExtensions = await ExtensionUser.findAll({
        where,
        include: [
          {
            model: Extension,
            as: "extension",
            required: true,
          },
          {
            model: ExtensionVersion,
            as: "version",
            required: true,
          },
        ],
        order: [["installedAt", "DESC"]],
      });

      res.json(userExtensions);
    } catch (error: any) {
      console.error("Failed to fetch user extensions:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch extensions", details: error.message });
    }
  });

  /**
   * POST /extensions/:extensionId/install
   * Install an extension for the current user
   */
  _router.post("/:extensionId/install", async (req, res) => {
    try {
      const userId = getUserId(req);
      const { extensionId } = req.params;
      const { versionId } = req.body;

      const ExtensionUser = await modelManager.getModel(MODELS.EXTENSION_USERS);

      // Check if already installed
      const existing = await ExtensionUser.findOne({
        where: { userId, extensionId },
      });

      if (existing && existing.status !== "uninstalled") {
        return res.status(409).json({
          error: "Extension already installed",
          userExtension: existing,
        });
      }

      // Verify version exists
      const ExtensionVersion = await modelManager.getModel(
        MODELS.EXTENSION_VERSIONS
      );
      const ExtensionPermission = await modelManager.getModel(
        MODELS.EXTENSION_PERMISSIONS
      );

      const version = await ExtensionVersion.findOne({
        where: { versionId },
        include: [
          {
            model: ExtensionPermission,
            as: "permissions",
            required: false,
          },
        ],
      });

      if (!version) {
        return res.status(404).json({ error: "Version not found" });
      }

      // If previously uninstalled, update instead of create
      if (existing) {
        await existing.update({
          versionId,
          status: "enabled",
          installedAt: new Date(),
          enabledAt: new Date(),
          uninstalledAt: null,
        });

        res.json({
          userExtension: existing,
          permissions: version.permissions || [],
        });
      } else {
        // Create new user extension record
        const userExtension = await ExtensionUser.create({
          id: uuidv4(),
          userId,
          extensionId,
          versionId,
          status: "enabled",
          installedAt: new Date(),
          enabledAt: new Date(),
          autoUpdate: true,
        });

        res.status(201).json({
          userExtension,
          permissions: version.permissions || [],
        });
      }

      // Increment download count
      await version.increment("downloads");
    } catch (error: any) {
      console.error("Failed to install extension:", error);
      res
        .status(500)
        .json({ error: "Failed to install extension", details: error.message });
    }
  });

  /**
   * PUT /extensions/:extensionId/update
   * Update extension to a new version
   */
  _router.put("/:extensionId/update", async (req, res) => {
    try {
      const userId = getUserId(req);
      const { extensionId } = req.params;
      const { versionId } = req.body;

      const ExtensionUser = await modelManager.getModel(MODELS.EXTENSION_USERS);
      const userExtension = await ExtensionUser.findOne({
        where: { userId, extensionId, status: { [Op.ne]: "uninstalled" } },
      });

      if (!userExtension) {
        return res.status(404).json({ error: "Extension not installed" });
      }

      // Verify new version exists
      const ExtensionVersion = await modelManager.getModel(
        MODELS.EXTENSION_VERSIONS
      );
      const version = await ExtensionVersion.findByPk(versionId);

      if (!version) {
        return res.status(404).json({ error: "Version not found" });
      }

      // Update version
      await userExtension.update({
        versionId,
        lastUsedAt: new Date(),
      });

      res.json(userExtension);
    } catch (error: any) {
      console.error("Failed to update extension:", error);
      res
        .status(500)
        .json({ error: "Failed to update extension", details: error.message });
    }
  });

  /**
   * POST /extensions/:extensionId/enable
   * Enable an installed extension
   */
  _router.post("/:extensionId/enable", async (req, res) => {
    try {
      const userId = getUserId(req);
      const { extensionId } = req.params;

      const ExtensionUser = await modelManager.getModel(MODELS.EXTENSION_USERS);
      const userExtension = await ExtensionUser.findOne({
        where: { userId, extensionId, status: { [Op.ne]: "uninstalled" } },
      });

      if (!userExtension) {
        return res.status(404).json({ error: "Extension not installed" });
      }

      await userExtension.update({
        status: "enabled",
        enabledAt: new Date(),
        lastUsedAt: new Date(),
      });

      res.json(userExtension);
    } catch (error: any) {
      console.error("Failed to enable extension:", error);
      res
        .status(500)
        .json({ error: "Failed to enable extension", details: error.message });
    }
  });

  /**
   * POST /extensions/:extensionId/disable
   * Disable an installed extension
   */
  _router.post("/:extensionId/disable", async (req, res) => {
    try {
      const userId = getUserId(req);
      const { extensionId } = req.params;

      const ExtensionUser = await modelManager.getModel(MODELS.EXTENSION_USERS);
      const userExtension = await ExtensionUser.findOne({
        where: { userId, extensionId, status: { [Op.ne]: "uninstalled" } },
      });

      if (!userExtension) {
        return res.status(404).json({ error: "Extension not installed" });
      }

      await userExtension.update({
        status: "disabled",
        disabledAt: new Date(),
      });

      res.json(userExtension);
    } catch (error: any) {
      console.error("Failed to disable extension:", error);
      res
        .status(500)
        .json({ error: "Failed to disable extension", details: error.message });
    }
  });

  /**
   * DELETE /extensions/:extensionId/uninstall
   * Uninstall an extension (soft delete)
   */
  _router.delete("/:extensionId/uninstall", async (req, res) => {
    try {
      const userId = getUserId(req);
      const { extensionId } = req.params;

      const ExtensionUser = await modelManager.getModel(MODELS.EXTENSION_USERS);
      const userExtension = await ExtensionUser.findOne({
        where: { userId, extensionId, status: { [Op.ne]: "uninstalled" } },
      });

      if (!userExtension) {
        return res.status(404).json({ error: "Extension not installed" });
      }

      // Soft delete - mark as uninstalled
      await userExtension.update({
        status: "uninstalled",
        uninstalledAt: new Date(),
      });

      res.json({ message: "Extension uninstalled successfully" });
    } catch (error: any) {
      console.error("Failed to uninstall extension:", error);
      res.status(500).json({
        error: "Failed to uninstall extension",
        details: error.message,
      });
    }
  });

  /**
   * PATCH /extensions/:extensionId/settings
   * Update extension settings for the current user
   */
  _router.patch("/:extensionId/settings", async (req, res) => {
    try {
      const userId = getUserId(req);
      const { extensionId } = req.params;
      const { settings } = req.body;

      const ExtensionUser = await modelManager.getModel(MODELS.EXTENSION_USERS);
      const userExtension = await ExtensionUser.findOne({
        where: { userId, extensionId, status: { [Op.ne]: "uninstalled" } },
      });

      if (!userExtension) {
        return res.status(404).json({ error: "Extension not installed" });
      }

      await userExtension.update({
        settings,
        lastUsedAt: new Date(),
      });

      res.json(userExtension);
    } catch (error: any) {
      console.error("Failed to update settings:", error);
      res
        .status(500)
        .json({ error: "Failed to update settings", details: error.message });
    }
  });

  /**
   * PATCH /extensions/:extensionId/auto-update
   * Toggle auto-update for an extension
   */
  _router.patch("/:extensionId/auto-update", async (req, res) => {
    try {
      const userId = getUserId(req);
      const { extensionId } = req.params;
      const { autoUpdate } = req.body;

      const ExtensionUser = await modelManager.getModel(MODELS.EXTENSION_USERS);
      const userExtension = await ExtensionUser.findOne({
        where: { userId, extensionId, status: { [Op.ne]: "uninstalled" } },
      });

      if (!userExtension) {
        return res.status(404).json({ error: "Extension not installed" });
      }

      await userExtension.update({ autoUpdate });

      res.json(userExtension);
    } catch (error: any) {
      console.error("Failed to update auto-update setting:", error);
      res.status(500).json({
        error: "Failed to update auto-update setting",
        details: error.message,
      });
    }
  });

  // ==================== PERMISSION ROUTES ====================

  /**
   * GET /extensions/version/:versionId/permissions
   * Get all permissions required by a specific version
   */
  _router.get("/version/:versionId/permissions", async (req, res) => {
    try {
      const ExtensionPermission = await modelManager.getModel(
        MODELS.EXTENSION_PERMISSIONS
      );
      const permissions = await ExtensionPermission.findAll({
        where: { versionId: req.params.versionId },
      });

      res.json(permissions);
    } catch (error: any) {
      console.error("Failed to fetch permissions:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch permissions", details: error.message });
    }
  });

  // ==================== REVIEW ROUTES (OPTIONAL) ====================

  /**
   * POST /extensions/:extensionId/review
   * Submit a review for an extension
   */
  _router.post("/:extensionId/review", async (req, res) => {
    try {
      const userId = getUserId(req);
      const { extensionId } = req.params;
      const { rating, comment } = req.body;

      if (!rating || rating < 1 || rating > 5) {
        return res
          .status(400)
          .json({ error: "Rating must be between 1 and 5" });
      }

      const ExtensionReview = await modelManager.getModel(
        MODELS.EXTENSION_REVIEWS
      );

      // Check if user already reviewed
      const existing = await ExtensionReview.findOne({
        where: { userId, extensionId },
      });

      if (existing) {
        // Update existing review
        await existing.update({
          rating,
          comment,
          isEdited: true,
        });

        // Recalculate average rating
        await recalculateRating(modelManager, extensionId);

        return res.json(existing);
      }

      // Create new review
      const review = await ExtensionReview.create({
        id: uuidv4(),
        userId,
        extensionId,
        rating,
        comment,
      });

      // Recalculate average rating
      await recalculateRating(modelManager, extensionId);

      res.status(201).json(review);
    } catch (error: any) {
      console.error("Failed to submit review:", error);
      res
        .status(500)
        .json({ error: "Failed to submit review", details: error.message });
    }
  });

  /**
   * GET /extensions/:extensionId/reviews
   * Get all reviews for an extension
   */
  _router.get("/:extensionId/reviews", async (req, res) => {
    try {
      const { limit = 10, offset = 0, sort = "recent" } = req.query;

      const orderMap: Record<string, any> = {
        recent: [["createdAt", "DESC"]],
        rating: [["rating", "DESC"]],
      };

      const ExtensionReview = await modelManager.getModel(
        MODELS.EXTENSION_REVIEWS
      );
      const reviews = await ExtensionReview.findAll({
        where: { extensionId: req.params.extensionId },
        limit: Number(limit),
        offset: Number(offset),
        order: orderMap[sort as string] || orderMap.recent,
      });

      res.json(reviews);
    } catch (error: any) {
      console.error("Failed to fetch reviews:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch reviews", details: error.message });
    }
  });

  return _router;
};

// Helper function to recalculate extension rating
async function recalculateRating(
  modelManager: DynamicModelManager,
  extensionId: string
) {
  const ExtensionReview = await modelManager.getModel(MODELS.EXTENSION_REVIEWS);
  const Extension = await modelManager.getModel(MODELS.EXTENSIONS);

  const reviews = await ExtensionReview.findAll({
    where: { extensionId },
    attributes: ["rating"],
  });

  const totalRatings = reviews.length;
  const sumRatings = reviews.reduce(
    (sum: number, review: any) => sum + review.rating,
    0
  );
  const averageRating = totalRatings > 0 ? sumRatings / totalRatings : 0;

  await Extension.update(
    {
      averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      ratingCount: totalRatings,
    },
    { where: { extensionId } }
  );
}
