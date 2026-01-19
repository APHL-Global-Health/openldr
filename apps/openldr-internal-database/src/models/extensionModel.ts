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
  Unique,
  HasMany,
} from "@sequelize/core/decorators-legacy";

// import ExtensionVersion from "./extensionVersionModel";
// import ExtensionUser from "./extensionUserModel";

@Table({
  tableName: "extensions",
  timestamps: true,
})
class Extension extends Model<
  InferAttributes<Extension>,
  InferCreationAttributes<Extension>
> {
  @Attribute(DataTypes.UUID)
  @PrimaryKey
  @Default(sql.uuidV4)
  declare extensionId: CreationOptional<string>;

  @Attribute(DataTypes.STRING(255))
  @NotNull
  @Unique
  declare packageId: string; // e.g., "org.openldr.extension.example"

  @Attribute(DataTypes.STRING(255))
  @NotNull
  declare name: string; // Display name

  @Attribute(DataTypes.TEXT)
  declare description: string;

  @Attribute(DataTypes.STRING(255))
  @NotNull
  declare author: string;

  @Attribute(DataTypes.STRING(255))
  declare authorDomain: string; // Publisher domain from manifest

  @Attribute(DataTypes.TEXT)
  declare iconUrl: string; // Base64 or URL for package icon

  @Attribute(DataTypes.STRING(100))
  declare license: string;

  @Attribute(DataTypes.STRING(500))
  declare repositoryUrl: string;

  @Attribute(DataTypes.JSON)
  declare categories: CreationOptional<string[]>; // ["Debuggers", "Other"]

  @Attribute(DataTypes.JSON)
  declare tags: CreationOptional<string[]>; // ["react", "debugging"]

  @Attribute(DataTypes.TEXT)
  declare readme: string;

  @Attribute(DataTypes.TEXT)
  declare features: string;

  @Attribute(DataTypes.INTEGER)
  @Default(0)
  declare totalDownloads: CreationOptional<number>;

  @Attribute(DataTypes.FLOAT)
  @Default(0)
  declare averageRating: CreationOptional<number>;

  @Attribute(DataTypes.INTEGER)
  @Default(0)
  declare ratingCount: CreationOptional<number>;

  @Attribute(DataTypes.BOOLEAN)
  @Default(true)
  declare isActive: CreationOptional<boolean>; // For soft deletion/deprecation

  @Attribute(DataTypes.DATE)
  declare lastUpdated: Date;

  // Relationships
  // @HasMany(() => ExtensionVersion, "extensionId")
  // declare versions?: ExtensionVersion[];
  declare versions?: any[];

  // @HasMany(() => ExtensionUser, "extensionId")
  // declare users?: ExtensionUser[];
  declare users?: any[];
}

export default Extension;
