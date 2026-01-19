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

import { createUUIDv7, validUUID } from "../utils/common";

@Table({ tableName: "notifications" })
class Notification extends Model<
  InferAttributes<Notification>,
  InferCreationAttributes<Notification>
> {
  @Attribute(DataTypes.UUID)
  @PrimaryKey
  @Default(sql.uuidV4)
  declare notificationId: CreationOptional<string>;

  @Attribute(DataTypes.STRING)
  @NotNull
  declare notificationType: string;

  @Attribute(DataTypes.DATE)
  @NotNull
  declare timestamp: Date;

  @Attribute(DataTypes.STRING)
  declare title: string;

  @Attribute(DataTypes.STRING)
  declare content: string;

  @Attribute(DataTypes.BOOLEAN)
  @Default(false)
  declare isRead: boolean;

  @Attribute(DataTypes.DATE)
  @NotNull
  declare expireOn: Date;
}

export default Notification;
