/*import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "@sequelize/core";

import {
  Table,
  Attribute,
  PrimaryKey,
  NotNull,
  Default,
  ValidateAttribute,
} from "@sequelize/core/decorators-legacy";

import PluginModel from "./pluginModel";

@Table({
  tableName: "formSubmissions",
  indexes: [
    { fields: ["schemaId"] },
    { fields: ["facilityId"] },
    { fields: ["schemaPluginId"] },
    { fields: ["mapperPluginId"] },
    { fields: ["recipientPluginId"] },
    { using: "gin", fields: ["formData"] }, // GIN index for JSONB
    // { using: "gin", fields: ["searchableFields"] }, // Removed searchableFields index - it's a VIRTUAL column
  ],
})
class FormSubmission extends Model<
  InferAttributes<FormSubmission>,
  InferCreationAttributes<FormSubmission>
> {
  @Attribute(DataTypes.UUID)
  @PrimaryKey
  @Default(sql.uuidV4)
  declare submissionId: CreationOptional<string>;

  @Attribute(DataTypes.UUID)
  @NotNull
  declare schemaId: string;

  @Attribute(DataTypes.INTEGER)
  @NotNull
  declare schemaVersion: number;

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

  @Attribute(DataTypes.JSONB)
  @NotNull
  declare formData: object; // All form data in JSON

  @Attribute(DataTypes.VIRTUAL(DataTypes.JSONB))
  declare searchableFields: object; // Generated column for common searches

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

  //   @BelongsTo(() => FormSchema, "schemaId")
  //   declare schema?: NonAttribute<FormSchema>;
  declare schema?: any;
}

export default FormSubmission;*/
