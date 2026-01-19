import { Op } from "@sequelize/core";

export type FilterOption = {
  id: string;
  column: string;
  operator: string;
  combineWith: string;
  value: any | undefined | null;
};

export function buildSequelizeWhere(filters: FilterOption[]) {
  if (!filters || filters.length === 0) {
    return {};
  }

  // Operator mapping - converts string operators to Sequelize Op symbols
  const operatorMap: any = {
    eq: Op.eq,
    ne: Op.ne,
    like: Op.like,
    iLike: Op.iLike,
    notLike: Op.notLike,
    gt: Op.gt,
    gte: Op.gte,
    lt: Op.lt,
    lte: Op.lte,
    in: Op.in,
    notIn: Op.notIn,
    between: Op.between,
    is: Op.is,
    not: Op.not,
    contains: Op.contains,
    startsWith: Op.startsWith,
    endsWith: Op.endsWith,
  };

  // Group filters by combineWith logic
  const andFilters: any = [];
  const orFilters: any = [];

  filters.forEach((filter) => {
    const { column, operator, value, combineWith } = filter;

    // Validate that the operator exists
    if (!operatorMap[operator]) {
      console.warn(`Unknown operator: ${operator}, defaulting to 'eq'`);
    }

    // Get the Sequelize operator symbol
    const seqOp = operatorMap[operator] || Op.eq;

    // Build the condition based on operator type
    let condition;

    if (operator === "like" || operator === "iLike" || operator === "notLike") {
      // Add wildcards for LIKE operations
      condition = { [column]: { [seqOp]: `%${value}%` } };
    } else if (operator === "startsWith") {
      condition = { [column]: { [seqOp]: `${value}%` } };
    } else if (operator === "endsWith") {
      condition = { [column]: { [seqOp]: `%${value}` } };
    } else if (operator === "in" || operator === "notIn") {
      // Ensure value is an array
      const arrayValue = Array.isArray(value) ? value : [value];
      condition = { [column]: { [seqOp]: arrayValue } };
    } else if (operator === "between") {
      // Expect value to be an array with two elements
      condition = { [column]: { [seqOp]: value } };
    } else if (operator === "is") {
      // For IS NULL or IS NOT NULL
      condition = { [column]: { [seqOp]: value } };
    } else {
      // Standard operators (eq, ne, gt, gte, lt, lte, etc.)
      condition = { [column]: { [seqOp]: value } };
    }

    // Group by combineWith
    if (combineWith === "or") {
      orFilters.push(condition);
    } else {
      andFilters.push(condition);
    }
  });

  // Build the final where object
  const whereConditions = [];

  if (andFilters.length > 0) {
    whereConditions.push(...andFilters);
  }

  if (orFilters.length > 0) {
    whereConditions.push({ [Op.or]: orFilters });
  }

  // Handle different cases
  if (whereConditions.length === 0) {
    return {};
  }

  if (whereConditions.length === 1 && orFilters.length === 0) {
    return whereConditions[0];
  }

  return { [Op.and]: whereConditions };
}
