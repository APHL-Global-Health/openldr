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

@Table({ tableName: "facilities" })
class Facility extends Model<
  InferAttributes<Facility>,
  InferCreationAttributes<Facility>
> {
  @Attribute(DataTypes.UUID)
  @PrimaryKey
  @Default(sql.uuidV4)
  declare facilityId: CreationOptional<string>;

  @Attribute(DataTypes.STRING)
  @NotNull
  declare facilityCode: string;

  @Attribute(DataTypes.STRING)
  @NotNull
  declare facilityName: string;

  @Attribute(DataTypes.STRING)
  @NotNull
  declare facilityType: string;

  @Attribute(DataTypes.STRING)
  declare description: string;

  @Attribute(DataTypes.STRING)
  @NotNull
  declare countryCode: string;

  @Attribute(DataTypes.STRING)
  @NotNull
  declare provinceCode: string;

  @Attribute(DataTypes.STRING)
  @NotNull
  declare regionCode: string;

  @Attribute(DataTypes.STRING)
  @NotNull
  declare districtCode: string;

  @Attribute(DataTypes.STRING)
  @NotNull
  declare subDistrictCode: string;

  @Attribute(DataTypes.STRING)
  declare lattLong: string;

  // @HasMany(() => DataFeedModel, "facilityId")
  // declare dataFeeds?: NonAttribute<DataFeedModel[]>;
  declare dataFeeds?: any;
}

export default Facility;
