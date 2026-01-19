const common = {
  database: "openldr",
  user: "openldr",
  password: "openldr123",
  pool: {
    maxConnections: 5,
    maxIdleTime: 3000,
  },
};

const Config = {
  mysql: {
    dialect: "mysql",
    database: common.database,
    user: common.user,
    password: common.password,
    host: "openldr-db-mysql",
    port: 3306,
    pool: common.pool,
  },

  postgres: {
    dialect: "postgres",
    database: common.database,
    user: common.user,
    password: common.password,
    host: "openldr-db-postgres",
    port: 5432,
    pool: common.pool,
  },

  sqlite3: {
    dialect: "sqlite3",
    storage: "openldr.sqlite",
  },
};

export default Config;
