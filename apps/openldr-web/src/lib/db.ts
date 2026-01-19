import { Database } from "@sqlite.org/sqlite-wasm";

export const get_table_version = (
  db: Database,
  country?: string | undefined
) => {
  const script = `
            SELECT
             ('LAB' || COUNTRY_A || '.' || LABORATORY) 'labId'  
            FROM Isolates
            WHERE CAST(LABORATORY as int) > 0 ${
              country ? `AND COUNTRY_A = '${country}'` : ""
            }                        
            GROUP BY ('LAB' || COUNTRY_A || '.' || LABORATORY)
        `;

  try {
    const resultRows: any[] = [];
    db.exec({
      sql: script,
      rowMode: "object",
      resultRows: resultRows,
    });

    return resultRows.map((row: any) => row.labId);
  } catch (e) {
    console.log(e);
  }

  return [];
};

export const get_table_schema = (db: Database, name: string | undefined) => {
  if (name) {
    const script = `
            PRAGMA table_info(${name}) 
        `;

    const resultRows: any[] = [];
    db.exec({
      sql: script,
      rowMode: "object",
      resultRows: resultRows,
    });
    return resultRows?.map((c) => {
      const item: any = {
        name: c.name,
        type: c.type,
        nullable: c.notnull === 0,
      };

      const found = c.type.match(/(.*)\((.*)\)/i);
      if (found) {
        item.type = found[1];
        item.constraint = parseInt(found[2]);
      }

      return item;
    });
  }
  return [];
};

export const get_tables = (db: Database, where?: string | undefined) => {
  if (where === undefined) where = `WHERE name NOT LIKE 'sqlite_autoindex_%_%'`;

  const script = `
        SELECT  name 
        FROM sqlite_master
        ${where}
    `;

  try {
    const resultRows: any[] = [];
    db.exec({
      sql: script,
      rowMode: "object",
      resultRows: resultRows,
    });

    const response = resultRows.map((item) => item.name);

    response.sort();

    return response;
  } catch (e) {
    console.log(e);
  }

  return [];
};

export const get_table_script = (db: Database, name: string | undefined) => {
  if (name) {
    const script = `
            SELECT sql 
            FROM sqlite_master
            WHERE lower(tbl_name) = '${name.toLowerCase()}'
        `;

    try {
      const resultRows: any[] = [];
      db.exec({
        sql: script,
        rowMode: "object",
        resultRows: resultRows,
      });
      const response = resultRows.map((item) => item.sql);

      return response.find((item) => item != null);
    } catch (e) {
      console.log(e);
    }
  }

  return null;
};

export const get_table_data = (db: Database, name: string | undefined) => {
  const script = `SELECT * FROM ${name}`;

  try {
    const response: any[] = [];
    db.exec({
      sql: script,
      rowMode: "object",
      resultRows: response,
    });

    return response;
  } catch (e) {
    console.log(e);
  }
  return [];
};

export const get_table_data_count = (
  db: Database,
  name: string | undefined
) => {
  if (name) {
    const where: any = null;

    //prepare sql statement
    let script = `SELECT`;
    //append columns to sql statement
    script += ` COUNT(1) "total" `;
    //append table to access
    script += `FROM ${name.toLowerCase()} `;
    //append where statement
    if (where !== undefined && where != null && where.length > 0) {
      script += ` WHERE ${where}`;
    }

    const resultRows: any[] = [];
    db.exec({
      sql: script,
      rowMode: "object",
      resultRows: resultRows,
    });
    const response = resultRows.shift()?.total;
    return response || 0;
  }
  return 0;
};

export const table_exists = async (db: Database, name: string) => {
  const script = `SELECT name FROM sqlite_master WHERE type='table' AND name='${name}'`;

  const resultRows: any[] = [];
  db.exec({
    sql: script,
    rowMode: "object",
    resultRows: resultRows,
  });
  const hasData = resultRows.length > 0;

  return hasData;
};

export const data_types = (name: string) => {
  if (name === "string") return "TEXT";
  if (name === "number") return "INTEGER";
  if (name === "boolean") return "INTEGER";
  if (name === "date") return "TEXT";
  if (name === "datetime") return "TEXT";
  if (name === "time") return "TEXT";
  return "TEXT";
};

export const save_database = (binaryArray: Uint8Array) => {
  if (!binaryArray) return;

  // Create a Blob from the binary array
  const blob = new Blob([binaryArray as any], {
    type: "application/octet-stream",
  });

  // Create a download link
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  //use random name from datetime in format YYYYMMDDHHMMSS
  a.download = `whonet.${new Date()
    .toISOString()
    .replace(/[-:Z]/g, "")}.sqlite`; // File name
  document.body.appendChild(a);
  a.click();

  // Clean up
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
};
