import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
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
} from "@sequelize/core/decorators-legacy";

// Schema Storage Table
@Table({ tableName: "formSchemas" })
class FormSchema extends Model<
  InferAttributes<FormSchema>,
  InferCreationAttributes<FormSchema>
> {
  @Attribute(DataTypes.UUID)
  @PrimaryKey
  @Default(sql.uuidV4)
  declare schemaId: CreationOptional<string>;

  @Attribute(DataTypes.STRING)
  @NotNull
  declare schemaName: string;

  @Attribute(DataTypes.ENUM("form", "archive"))
  @NotNull
  @Default("form")
  @ValidateAttribute({
    isValidType(value: any) {
      if (value !== "form" && value !== "archive") {
        throw new Error('Invalid schema type. Must be "form" or "archive".');
      }
    },
  })
  declare schemaType: string;

  @Attribute(DataTypes.STRING)
  @NotNull
  @Default("1.0.0")
  declare version: string;

  @Attribute(DataTypes.JSON)
  @NotNull
  declare schema: string; // Your JSON Schema

  @Attribute(DataTypes.UUID)
  declare dataFeedId: any;

  @Attribute(DataTypes.BOOLEAN)
  @NotNull
  @Default(true)
  declare isActive: boolean;

  // Association declaration
  declare submissions?: any;
}

export default FormSchema;
