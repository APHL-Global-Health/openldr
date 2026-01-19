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
  Unique,
} from "@sequelize/core/decorators-legacy";

import { createUUIDv7, validUUID } from "../utils/common";

@Table({ tableName: "users" })
class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  @Default(sql.uuidV4)
  @PrimaryKey
  @Attribute(DataTypes.UUID)
  declare userId: CreationOptional<string>;

  @Attribute(DataTypes.STRING)
  @NotNull
  declare firstName: string;

  @Attribute(DataTypes.STRING)
  @NotNull
  declare lastName: string;

  @Attribute(DataTypes.STRING)
  @NotNull
  @Unique
  declare email: string;

  @Attribute(DataTypes.STRING)
  @NotNull
  declare phoneNumber: string;
}

export default User;
