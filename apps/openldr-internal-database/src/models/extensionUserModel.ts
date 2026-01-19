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

// import Extension from "./extensionModel";
// import ExtensionVersion from "./extensionVersionModel";

@Table({
  tableName: "extensionUsers",
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ["userId", "extensionId"],
      name: "unique_user_extension",
    },
  ],
})
class ExtensionUser extends Model<
  InferAttributes<ExtensionUser>,
  InferCreationAttributes<ExtensionUser>
> {
  @Attribute(DataTypes.UUID)
  @PrimaryKey
  @Default(sql.uuidV4)
  declare id: CreationOptional<string>;

  @Attribute(DataTypes.STRING)
  @NotNull
  declare userId: string;

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

  @Attribute({
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      table: "extensionVersions",
      key: "versionId",
    },
    onDelete: "RESTRICT", // Don't allow deleting version if users have it installed
    onUpdate: "CASCADE",
  })
  declare versionId: string;

  @Attribute(DataTypes.ENUM("installed", "enabled", "disabled", "uninstalled"))
  @NotNull
  @Default("installed")
  declare status: CreationOptional<
    "installed" | "enabled" | "disabled" | "uninstalled"
  >;

  @Attribute(DataTypes.DATE)
  @Default(DataTypes.NOW)
  declare installedAt: CreationOptional<Date>;

  @Attribute(DataTypes.DATE)
  declare enabledAt: Date;

  @Attribute(DataTypes.DATE)
  declare disabledAt: Date;

  @Attribute(DataTypes.DATE)
  declare lastUsedAt: Date;

  @Attribute(DataTypes.DATE)
  declare uninstalledAt: Date;

  @Attribute(DataTypes.JSON)
  @Default({})
  declare settings: CreationOptional<Record<string, any>>;

  @Attribute(DataTypes.BOOLEAN)
  @Default(true)
  declare autoUpdate: CreationOptional<boolean>;

  // Relationships
  // @BelongsTo(() => Extension, "extensionId")
  // declare extension?: Extension;
  declare extension?: any;

  // @BelongsTo(() => ExtensionVersion, "versionId")
  // declare version?: ExtensionVersion;
  declare version?: any;
}

export default ExtensionUser;
