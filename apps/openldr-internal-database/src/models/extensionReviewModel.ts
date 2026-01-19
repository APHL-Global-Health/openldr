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

@Table({
  tableName: "extensionReviews",
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ["userId", "extensionId"],
      name: "unique_user_review",
    },
  ],
})
class ExtensionReview extends Model<
  InferAttributes<ExtensionReview>,
  InferCreationAttributes<ExtensionReview>
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

  @Attribute(DataTypes.INTEGER)
  @NotNull
  declare rating: number; // 1-5

  @Attribute(DataTypes.TEXT)
  declare comment: string;

  @Attribute(DataTypes.BOOLEAN)
  @Default(false)
  declare isEdited: CreationOptional<boolean>;

  // Relationship
  //   @BelongsTo(() => Extension, "extensionId")
  //   declare extension?: Extension;
  declare extension?: any;
}

export default ExtensionReview;
