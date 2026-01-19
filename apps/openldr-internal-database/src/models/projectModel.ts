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
  HasMany,
  ValidateAttribute,
  BeforeSave,
} from "@sequelize/core/decorators-legacy";

import { createUUIDv7, validUUID } from "../utils/common";

// import DataFeedModel from "./dataFeedModel";

@Table({ tableName: "projects" })
class Project extends Model<
  InferAttributes<Project>,
  InferCreationAttributes<Project>
> {
  @Attribute(DataTypes.UUID)
  @PrimaryKey
  @Default(sql.uuidV4)
  declare projectId: CreationOptional<string>;

  @Attribute(DataTypes.STRING)
  @NotNull
  declare projectName: string;

  @Attribute(DataTypes.STRING)
  declare description: string;

  @Attribute(DataTypes.BOOLEAN)
  @Default(true)
  declare isEnabled: boolean;

  // @HasMany(() => DataFeedModel, "projectId")
  // declare dataFeeds?: NonAttribute<DataFeedModel[]>;
  declare dataFeeds?: any;
}

export default Project;
