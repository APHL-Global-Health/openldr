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
} from "@sequelize/core/decorators-legacy";

import { createUUIDv7, validUUID } from "../utils/common";

// import DataFeedModel from "./dataFeedModel";

@Table({ tableName: "useCases" })
class UseCase extends Model<
  InferAttributes<UseCase>,
  InferCreationAttributes<UseCase>
> {
  @Attribute(DataTypes.UUID)
  @PrimaryKey
  @Default(sql.uuidV4)
  declare useCaseId: CreationOptional<string>;

  @Attribute(DataTypes.STRING)
  @NotNull
  declare useCaseName: string;

  @Attribute(DataTypes.STRING)
  declare description: string;

  @Attribute(DataTypes.BOOLEAN)
  @Default(true)
  declare isEnabled: boolean;

  // @HasMany(() => DataFeedModel, "useCaseId")
  // declare dataFeeds?: NonAttribute<DataFeedModel[]>;
  declare dataFeeds?: any;
}

export default UseCase;
