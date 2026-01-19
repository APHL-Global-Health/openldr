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
  HasMany,
} from "@sequelize/core/decorators-legacy";

// import Extension from "./extensionModel";
// import ExtensionPermission from "./extensionPermissionModel";
// import ExtensionUser from "./extensionUserModel";

@Table({
  tableName: "extensionVersions",
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ["extensionId", "version"],
      name: "unique_extension_version",
    },
  ],
})
class ExtensionVersion extends Model<
  InferAttributes<ExtensionVersion>,
  InferCreationAttributes<ExtensionVersion>
> {
  @Attribute(DataTypes.UUID)
  @PrimaryKey
  @Default(sql.uuidV4)
  declare versionId: CreationOptional<string>;

  @Attribute({
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      table: "extensions",
      key: "extensionId",
    },
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  })
  declare extensionId: string;

  @Attribute(DataTypes.STRING(50))
  @NotNull
  declare version: string; // e.g., "1.0.0", "4.28.5"

  @Attribute(DataTypes.TEXT)
  declare changelog: string;

  @Attribute(DataTypes.STRING(500))
  @NotNull
  declare codeUrl: string; // URL to the actual extension code bundle

  @Attribute(DataTypes.STRING(255))
  declare mainFile: string; // Entry point file from manifest

  @Attribute(DataTypes.BOOLEAN)
  @Default(false)
  declare isBreaking: CreationOptional<boolean>;

  @Attribute(DataTypes.STRING(50))
  declare minAppVersion: string;

  @Attribute(DataTypes.STRING)
  declare maxAppVersion: string;

  @Attribute(DataTypes.BOOLEAN)
  @Default(false)
  declare isPublished: CreationOptional<boolean>;

  @Attribute(DataTypes.BOOLEAN)
  @Default(false)
  declare isLatest: CreationOptional<boolean>; // Flag for latest stable version

  @Attribute(DataTypes.INTEGER)
  @Default(0)
  declare downloads: CreationOptional<number>;

  @Attribute(DataTypes.JSON)
  declare manifest: any; // Store full manifest JSON

  @Attribute(DataTypes.JSON)
  declare activationEvents: CreationOptional<string[]>; // ["onStartup"]

  @Attribute(DataTypes.DATE)
  declare publishedAt: Date;

  // Relationships
  // @BelongsTo(() => Extension, "extensionId")
  // declare extension?: Extension;
  declare extension?: any;

  // @HasMany(() => ExtensionUser, "versionId")
  // declare users?: ExtensionUser[];
  declare users?: any[];

  // @HasMany(() => ExtensionPermission, "versionId")
  // declare permissions?: ExtensionPermission[];
  declare permissions?: any[];
}

export default ExtensionVersion;
