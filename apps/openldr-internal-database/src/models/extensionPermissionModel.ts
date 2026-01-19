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
  BelongsTo,
} from "@sequelize/core/decorators-legacy";

// import ExtensionVersion from "./extensionVersionModel";

@Table({
  tableName: "extensionPermissions",
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ["versionId", "permission"],
      name: "unique_version_permission",
    },
  ],
})
class ExtensionPermission extends Model<
  InferAttributes<ExtensionPermission>,
  InferCreationAttributes<ExtensionPermission>
> {
  @Attribute(DataTypes.UUID)
  @PrimaryKey
  @Default(sql.uuidV4)
  declare id: CreationOptional<string>;

  @Attribute({
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      table: "extensionVersions",
      key: "versionId",
    },
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  })
  declare versionId: string;

  @Attribute(DataTypes.STRING(255))
  @NotNull
  declare permission: string; // e.g., "network.http", "storage.read", "ui.notifications"

  @Attribute(DataTypes.TEXT)
  declare description: string; // Human-readable description of what this permission does

  @Attribute(DataTypes.BOOLEAN)
  @Default(false)
  declare isDangerous: CreationOptional<boolean>; // Flag for permissions requiring extra user consent

  // Relationship
  //   @BelongsTo(() => ExtensionVersion, "versionId")
  //   declare version?: ExtensionVersion;
  declare version?: any;
}

export default ExtensionPermission;
