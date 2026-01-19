import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  NonAttribute,
  CreationOptional,
  sql,
} from "@sequelize/core";

import {
  Table,
  Attribute,
  PrimaryKey,
  NotNull,
  Default,
  ValidateAttribute,
  Comment,
  HasMany,
} from "@sequelize/core/decorators-legacy";

import { createUUIDv7, validUUID } from "../utils/common";

// import DataFeedModel from "./dataFeedModel";

@Table({ tableName: "plugins" })
class Plugin extends Model<
  InferAttributes<Plugin>,
  InferCreationAttributes<Plugin>
> {
  @Attribute(DataTypes.UUID)
  @PrimaryKey
  @Default(sql.uuidV4)
  declare pluginId: CreationOptional<string>;

  @Attribute(DataTypes.ENUM("schema", "mapper", "recipient"))
  @NotNull
  @ValidateAttribute({
    isValidType(value: any) {
      if (value !== "schema" && value !== "mapper" && value !== "recipient") {
        throw new Error(
          'Invalid plugin type. Must be "schema", "mapper", or "recipient".'
        );
      }
    },
  })
  declare pluginType: string;

  @Attribute(DataTypes.STRING)
  @NotNull
  declare pluginName: string;

  @Attribute(DataTypes.STRING)
  @NotNull
  declare pluginVersion: string;

  @Attribute(DataTypes.STRING)
  @NotNull
  @Comment("Path to the plugin file in MinIO storage")
  declare pluginMinioObjectPath: string;

  @Attribute(DataTypes.ENUM("low", "medium", "high"))
  @NotNull
  @Default("high")
  @ValidateAttribute({
    isValidType(value: any) {
      if (value !== "low" && value !== "medium" && value !== "high") {
        throw new Error(
          'Invalid security level. Must be "low", "medium", or "high".'
        );
      }
    },
  })
  declare securityLevel: string;

  @Attribute(DataTypes.JSON)
  declare config: string;

  @Attribute(DataTypes.STRING(2000))
  declare notes: string;

  // @HasMany(() => DataFeedModel, "schemaPluginId")
  // declare schemaDataFeeds?: NonAttribute<DataFeedModel[]>;
  declare schemaDataFeeds?: any;

  // @HasMany(() => DataFeedModel, "mapperPluginId")
  // declare mapperDataFeeds?: NonAttribute<DataFeedModel[]>;
  declare mapperDataFeeds?: any;

  // @HasMany(() => DataFeedModel, "recipientPluginId")
  // declare recipientDataFeeds?: NonAttribute<DataFeedModel[]>;
  declare recipientDataFeeds?: any;
}

export default Plugin;
