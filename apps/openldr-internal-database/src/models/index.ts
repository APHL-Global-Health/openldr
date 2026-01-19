// modelAssociations.ts
import FacilityModel from "./facilityModel";
import PluginModel from "./pluginModel";
import UserModel from "./userModel";
import DataFeedModel from "./dataFeedModel";
import NotificationModel from "./notificationModel";
import ProjectModel from "./projectModel";
import UseCaseModel from "./useCaseModel";
import ExtensionModel from "./extensionModel";
import ExtensionVersionModel from "./extensionVersionModel";
import ExtensionUserModel from "./extensionUserModel";
import ExtensionPermissionModel from "./extensionPermissionModel";
import ExtensionReviewModel from "./extensionReviewModel";
import FormSchemaModel from "./formSchemaModel";
// import FormSubmissionModel from "./formSubmissionModel";

// Function to setup all associations
function setupAssociations(verbose: Boolean = true) {
  // Verify all models are loaded
  const models = {
    FacilityModel,
    PluginModel,
    UserModel,
    DataFeedModel,
    NotificationModel,
    ProjectModel,
    UseCaseModel,
    ExtensionModel,
    ExtensionVersionModel,
    ExtensionUserModel,
    ExtensionPermissionModel,
    ExtensionReviewModel,
    FormSchemaModel,
    // FormSubmissionModel,
  };

  for (const [name, model] of Object.entries(models)) {
    if (!model) {
      console.error(`Model ${name} is not loaded!`);
      continue;
    }
    if (verbose) console.log("");

    // model.table returns TableOrUndefined which could be a string or an object
    const table = model.table;
    const tableName =
      typeof table === "string" ? table : table?.tableName || "unknown";

    if (!tableName || tableName === "undefined" || tableName === "unknown") {
      console.error(`Model ${name} has invalid table name: ${tableName}`);
    } else {
      if (verbose)
        console.log(`✓ Model ${name} loaded with table: ${tableName}`);
    }
  }

  // ============================================================================
  // DataFeed Associations (commented out - to be removed)
  // ============================================================================

  // Facility <-> DataFeed
  try {
    if (!FacilityModel.associations.dataFeeds) {
      FacilityModel.hasMany(DataFeedModel, {
        foreignKey: "facilityId",
        as: "dataFeeds",
      });
    }
  } catch (_e) {
    if (verbose) console.error("Could not setup Facility -> DataFeed:", _e);
  }

  try {
    if (!DataFeedModel.associations.facility) {
      DataFeedModel.belongsTo(FacilityModel, {
        foreignKey: "facilityId",
        as: "facility",
      });
    }
  } catch (_e) {
    if (verbose) console.error("Could not setup DataFeed -> Facility:", _e);
  }

  // Plugin <-> DataFeed (schema) - with inverse alias
  try {
    if (!PluginModel.associations.schemaDataFeeds) {
      PluginModel.hasMany(DataFeedModel, {
        foreignKey: "schemaPluginId",
        as: "schemaDataFeeds",
        inverse: {
          as: "schemaPlugin",
        },
      });
    }
  } catch (_e) {
    console.error("Could not setup Plugin -> schemaDataFeeds:", _e);
  }

  try {
    if (!DataFeedModel.associations.schemaPlugin) {
      DataFeedModel.belongsTo(PluginModel, {
        foreignKey: "schemaPluginId",
        as: "schemaPlugin",
      });
    }
  } catch (_e) {
    console.error("Could not setup DataFeed -> schemaPlugin:", _e);
  }

  // Plugin <-> DataFeed (mapper) - with inverse alias
  try {
    if (!PluginModel.associations.mapperDataFeeds) {
      PluginModel.hasMany(DataFeedModel, {
        foreignKey: "mapperPluginId",
        as: "mapperDataFeeds",
        inverse: {
          as: "mapperPlugin",
        },
      });
    }
  } catch (_e) {
    console.error("Could not setup Plugin -> mapperDataFeeds:", _e);
  }

  try {
    if (!DataFeedModel.associations.mapperPlugin) {
      DataFeedModel.belongsTo(PluginModel, {
        foreignKey: "mapperPluginId",
        as: "mapperPlugin",
      });
    }
  } catch (_e) {
    console.error("Could not setup DataFeed -> mapperPlugin:", _e);
  }

  // Plugin <-> DataFeed (recipient) - with inverse alias
  try {
    if (!PluginModel.associations.recipientDataFeeds) {
      PluginModel.hasMany(DataFeedModel, {
        foreignKey: "recipientPluginId",
        as: "recipientDataFeeds",
        inverse: {
          as: "recipientPlugin",
        },
      });
    }
  } catch (_e) {
    console.error("Could not setup Plugin -> recipientDataFeeds:", _e);
  }

  try {
    if (!DataFeedModel.associations.recipientPlugin) {
      DataFeedModel.belongsTo(PluginModel, {
        foreignKey: "recipientPluginId",
        as: "recipientPlugin",
      });
    }
  } catch (_e) {
    console.error("Could not setup DataFeed -> recipientPlugin:", _e);
  }

  // Project <-> DataFeed
  try {
    if (!ProjectModel.associations.dataFeeds) {
      ProjectModel.hasMany(DataFeedModel, {
        foreignKey: "projectId",
        as: "dataFeeds",
      });
    }
  } catch (_e) {
    console.error("Could not setup Project -> DataFeed:", _e);
  }

  try {
    if (!DataFeedModel.associations.project) {
      DataFeedModel.belongsTo(ProjectModel, {
        foreignKey: "projectId",
        as: "project",
      });
    }
  } catch (_e) {
    console.error("Could not setup DataFeed -> Project:", _e);
  }

  // UseCase <-> DataFeed
  try {
    if (!UseCaseModel.associations.dataFeeds) {
      UseCaseModel.hasMany(DataFeedModel, {
        foreignKey: "useCaseId",
        as: "dataFeeds",
      });
    }
  } catch (_e) {
    console.error("Could not setup UseCase -> DataFeed:", _e);
  }

  try {
    if (!DataFeedModel.associations.useCase) {
      DataFeedModel.belongsTo(UseCaseModel, {
        foreignKey: "useCaseId",
        as: "useCase",
      });
    }
  } catch (_e) {
    console.error("Could not setup DataFeed -> UseCase:", _e);
  }

  // ============================================================================
  // Extension Associations
  // ============================================================================

  // Extension <-> ExtensionVersion
  try {
    if (!ExtensionModel.associations.versions) {
      ExtensionModel.hasMany(ExtensionVersionModel, {
        foreignKey: "extensionId",
        as: "versions",
      });
    }
  } catch (_e) {
    if (verbose)
      console.error("Could not setup Extension -> ExtensionVersion:", _e);
  }

  try {
    if (!ExtensionVersionModel.associations.extension) {
      ExtensionVersionModel.belongsTo(ExtensionModel, {
        foreignKey: "extensionId",
        as: "extension",
      });
    }
  } catch (_e) {
    if (verbose)
      console.error("Could not setup ExtensionVersion -> Extension:", _e);
  }

  // ExtensionVersion <-> ExtensionPermission
  try {
    if (!ExtensionVersionModel.associations.permissions) {
      ExtensionVersionModel.hasMany(ExtensionPermissionModel, {
        foreignKey: "versionId",
        as: "permissions",
      });
    }
  } catch (_e) {
    if (verbose)
      console.error(
        "Could not setup ExtensionVersion -> ExtensionPermission:",
        _e
      );
  }

  try {
    if (!ExtensionPermissionModel.associations.version) {
      ExtensionPermissionModel.belongsTo(ExtensionVersionModel, {
        foreignKey: "versionId",
        as: "version",
      });
    }
  } catch (_e) {
    if (verbose)
      console.error(
        "Could not setup ExtensionPermission -> ExtensionVersion:",
        _e
      );
  }

  // Extension <-> ExtensionUser
  try {
    if (!ExtensionModel.associations.users) {
      ExtensionModel.hasMany(ExtensionUserModel, {
        foreignKey: "extensionId",
        as: "users",
      });
    }
  } catch (_e) {
    if (verbose)
      console.error("Could not setup Extension -> ExtensionUser:", _e);
  }

  try {
    if (!ExtensionUserModel.associations.extension) {
      ExtensionUserModel.belongsTo(ExtensionModel, {
        foreignKey: "extensionId",
        as: "extension",
      });
    }
  } catch (_e) {
    if (verbose)
      console.error("Could not setup ExtensionUser -> Extension:", _e);
  }

  // ExtensionVersion <-> ExtensionUser
  try {
    if (!ExtensionVersionModel.associations.users) {
      ExtensionVersionModel.hasMany(ExtensionUserModel, {
        foreignKey: "versionId",
        as: "users",
      });
    }
  } catch (_e) {
    if (verbose)
      console.error("Could not setup ExtensionVersion -> ExtensionUser:", _e);
  }

  try {
    if (!ExtensionUserModel.associations.version) {
      ExtensionUserModel.belongsTo(ExtensionVersionModel, {
        foreignKey: "versionId",
        as: "version",
      });
    }
  } catch (_e) {
    if (verbose)
      console.error("Could not setup ExtensionUser -> ExtensionVersion:", _e);
  }

  // Extension <-> ExtensionReview
  try {
    if (!ExtensionModel.associations.reviews) {
      ExtensionModel.hasMany(ExtensionReviewModel, {
        foreignKey: "extensionId",
        as: "reviews",
      });
    }
  } catch (_e) {
    if (verbose)
      console.error("Could not setup Extension -> ExtensionReview:", _e);
  }

  try {
    if (!ExtensionReviewModel.associations.extension) {
      ExtensionReviewModel.belongsTo(ExtensionModel, {
        foreignKey: "extensionId",
        as: "extension",
      });
    }
  } catch (_e) {
    if (verbose)
      console.error("Could not setup ExtensionReview -> Extension:", _e);
  }

  /*// ============================================================================
  // FormSchema & FormSubmission Associations
  // ============================================================================

  // FormSchema <-> FormSubmission
  try {
    if (!FormSchemaModel.associations.submissions) {
      FormSchemaModel.hasMany(FormSubmissionModel, {
        foreignKey: "schemaId",
        as: "submissions",
      });
    }
  } catch (_e) {
    if (verbose)
      console.error("Could not setup FormSchema -> FormSubmission:", _e);
  }

  try {
    if (!FormSubmissionModel.associations.schema) {
      FormSubmissionModel.belongsTo(FormSchemaModel, {
        foreignKey: "schemaId",
        as: "schema",
      });
    }
  } catch (_e) {
    if (verbose)
      console.error("Could not setup FormSubmission -> FormSchema:", _e);
  }

  // Facility <-> FormSubmission
  try {
    if (!FacilityModel.associations.formSubmissions) {
      FacilityModel.hasMany(FormSubmissionModel, {
        foreignKey: "facilityId",
        as: "formSubmissions",
      });
    }
  } catch (_e) {
    if (verbose)
      console.error("Could not setup Facility -> FormSubmission:", _e);
  }

  try {
    if (!FormSubmissionModel.associations.facility) {
      FormSubmissionModel.belongsTo(FacilityModel, {
        foreignKey: "facilityId",
        as: "facility",
      });
    }
  } catch (_e) {
    if (verbose)
      console.error("Could not setup FormSubmission -> Facility:", _e);
  }

  // Plugin <-> FormSubmission (schema) - with inverse alias
  try {
    if (!PluginModel.associations.schemaFormSubmissions) {
      PluginModel.hasMany(FormSubmissionModel, {
        foreignKey: "schemaPluginId",
        as: "schemaFormSubmissions",
        inverse: {
          as: "schemaPlugin",
        },
      });
    }
  } catch (_e) {
    if (verbose)
      console.error("Could not setup Plugin -> schemaFormSubmissions:", _e);
  }

  try {
    if (!FormSubmissionModel.associations.schemaPlugin) {
      FormSubmissionModel.belongsTo(PluginModel, {
        foreignKey: "schemaPluginId",
        as: "schemaPlugin",
      });
    }
  } catch (_e) {
    if (verbose)
      console.error("Could not setup FormSubmission -> schemaPlugin:", _e);
  }

  // Plugin <-> FormSubmission (mapper) - with inverse alias
  try {
    if (!PluginModel.associations.mapperFormSubmissions) {
      PluginModel.hasMany(FormSubmissionModel, {
        foreignKey: "mapperPluginId",
        as: "mapperFormSubmissions",
        inverse: {
          as: "mapperPlugin",
        },
      });
    }
  } catch (_e) {
    if (verbose)
      console.error("Could not setup Plugin -> mapperFormSubmissions:", _e);
  }

  try {
    if (!FormSubmissionModel.associations.mapperPlugin) {
      FormSubmissionModel.belongsTo(PluginModel, {
        foreignKey: "mapperPluginId",
        as: "mapperPlugin",
      });
    }
  } catch (_e) {
    if (verbose)
      console.error("Could not setup FormSubmission -> mapperPlugin:", _e);
  }

  // Plugin <-> FormSubmission (recipient) - with inverse alias
  try {
    if (!PluginModel.associations.recipientFormSubmissions) {
      PluginModel.hasMany(FormSubmissionModel, {
        foreignKey: "recipientPluginId",
        as: "recipientFormSubmissions",
        inverse: {
          as: "recipientPlugin",
        },
      });
    }
  } catch (_e) {
    if (verbose)
      console.error("Could not setup Plugin -> recipientFormSubmissions:", _e);
  }

  try {
    if (!FormSubmissionModel.associations.recipientPlugin) {
      FormSubmissionModel.belongsTo(PluginModel, {
        foreignKey: "recipientPluginId",
        as: "recipientPlugin",
      });
    }
  } catch (_e) {
    if (verbose)
      console.error("Could not setup FormSubmission -> recipientPlugin:", _e);
  }

  // Project <-> FormSubmission
  try {
    if (!ProjectModel.associations.formSubmissions) {
      ProjectModel.hasMany(FormSubmissionModel, {
        foreignKey: "projectId",
        as: "formSubmissions",
      });
    }
  } catch (_e) {
    if (verbose)
      console.error("Could not setup Project -> FormSubmission:", _e);
  }

  try {
    if (!FormSubmissionModel.associations.project) {
      FormSubmissionModel.belongsTo(ProjectModel, {
        foreignKey: "projectId",
        as: "project",
      });
    }
  } catch (_e) {
    if (verbose)
      console.error("Could not setup FormSubmission -> Project:", _e);
  }

  // UseCase <-> FormSubmission
  try {
    if (!UseCaseModel.associations.formSubmissions) {
      UseCaseModel.hasMany(FormSubmissionModel, {
        foreignKey: "useCaseId",
        as: "formSubmissions",
      });
    }
  } catch (_e) {
    if (verbose)
      console.error("Could not setup UseCase -> FormSubmission:", _e);
  }

  try {
    if (!FormSubmissionModel.associations.useCase) {
      FormSubmissionModel.belongsTo(UseCaseModel, {
        foreignKey: "useCaseId",
        as: "useCase",
      });
    }
  } catch (_e) {
    if (verbose)
      console.error("Could not setup FormSubmission -> UseCase:", _e);
  }*/

  if (verbose) console.log("All model associations setup complete");
}

export {
  FacilityModel,
  PluginModel,
  UserModel,
  DataFeedModel,
  NotificationModel,
  ProjectModel,
  UseCaseModel,
  ExtensionModel,
  ExtensionVersionModel,
  ExtensionUserModel,
  ExtensionPermissionModel,
  ExtensionReviewModel,
  setupAssociations,
  FormSchemaModel,
  // FormSubmissionModel,
};
