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
  HasOne,
  ValidateAttribute,
  BelongsTo,
} from "@sequelize/core/decorators-legacy";

// import FacilityModel from "./facilityModel";
import PluginModel from "./pluginModel";
// import ProjectModel from "./projectModel";
// import UseCaseModel from "./useCaseModel";

@Table({ tableName: "dataFeeds" })
class DataFeed extends Model<
  InferAttributes<DataFeed>,
  InferCreationAttributes<DataFeed>
> {
  @Attribute(DataTypes.UUID)
  @PrimaryKey
  @Default(sql.uuidV4)
  declare dataFeedId: CreationOptional<string>;

  @Attribute(DataTypes.STRING)
  @NotNull
  declare dataFeedName: string;

  @Attribute(DataTypes.UUID)
  @NotNull
  @Default(sql.uuidV4)
  declare facilityId: string;

  @Attribute(DataTypes.UUID)
  @ValidateAttribute({
    async isSchemaPlugin(value: any) {
      if (value === null || value === undefined || value === "") {
        return;
      }
      const plugin = await PluginModel.findByPk(value);
      if (!plugin || plugin.pluginType !== "schema") {
        throw new Error(
          'schemaPluginId must reference a plugin of type "schema"'
        );
      }
    },
  })
  declare schemaPluginId: string;

  @Attribute(DataTypes.UUID)
  @ValidateAttribute({
    async isMapperPlugin(value: any) {
      if (value === null || value === undefined || value === "") {
        return;
      }
      const plugin = await PluginModel.findByPk(value);
      if (!plugin || plugin.pluginType !== "mapper") {
        throw new Error(
          'mapperPluginId must reference a plugin of type "mapper"'
        );
      }
    },
  })
  declare mapperPluginId: string;

  @Attribute(DataTypes.UUID)
  @ValidateAttribute({
    async isRecipientPlugin(value: any) {
      if (value === null || value === undefined || value === "") {
        return;
      }
      const plugin = await PluginModel.findByPk(value);
      if (!plugin || plugin.pluginType !== "recipient") {
        throw new Error(
          'recipientPluginId must reference a plugin of type "recipient"'
        );
      }
    },
  })
  declare recipientPluginId: string;

  @Attribute(DataTypes.UUID)
  @NotNull
  declare projectId: any;

  @Attribute(DataTypes.UUID)
  @NotNull
  declare useCaseId: any;

  @Attribute(DataTypes.BOOLEAN)
  @NotNull
  @Default(true)
  declare isEnabled: boolean;

  @Attribute(DataTypes.BOOLEAN)
  @NotNull
  @Default(false)
  declare isProtected: boolean;

  // @BelongsTo(() => FacilityModel, "facilityId")
  // declare facility?: NonAttribute<FacilityModel>;
  declare facility?: any;

  // @BelongsTo(() => PluginModel, "schemaPluginId")
  // declare schemaPlugin?: NonAttribute<PluginModel>;
  declare schemaPlugin?: any;

  // @BelongsTo(() => PluginModel, "mapperPluginId")
  // declare mapperPlugin?: NonAttribute<PluginModel>;
  declare mapperPlugin?: any;

  // @BelongsTo(() => PluginModel, "recipientPluginId")
  // declare recipientPlugin?: NonAttribute<PluginModel>;
  declare recipientPlugin?: any;

  // @BelongsTo(() => ProjectModel, "projectId")
  // declare project?: NonAttribute<ProjectModel>;
  declare project?: any;

  // @BelongsTo(() => UseCaseModel, "useCaseId")
  // declare useCase?: NonAttribute<UseCaseModel>;
  declare useCase?: any;
}

export default DataFeed;
