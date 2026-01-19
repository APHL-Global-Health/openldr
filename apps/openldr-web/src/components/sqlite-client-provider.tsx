/* eslint-disable react-refresh/only-export-components */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import sqlite3InitModule, {
  Database,
  PreparedStatement,
  Sqlite3Static,
} from "@sqlite.org/sqlite-wasm";
import React from "react";
import * as dbUtils from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SQLiteClientConfig {}

const ENV = import.meta.env;
const isDev = ENV.NODE_ENV === "development";
const publicUrl = (import.meta.env.VITE_BASE_URL || "/").replace(/\/?$/, "/");
export class SQLiteClient {
  #mountCount: number;
  #sqlite3: Sqlite3Static | undefined;
  #db: Database | undefined;
  #loaded: boolean;

  constructor(_config: SQLiteClientConfig = {}) {
    this.#mountCount = 0;
    this.#loaded = false;
  }

  #getDBatabaseBytes(
    db: Database,
    schema?: string | undefined
  ): Uint8Array | undefined {
    if (!db || !this.#sqlite3) return undefined;

    if (!schema) schema = "main";

    return this.#sqlite3.capi.sqlite3_js_db_export(db.pointer as any, schema);
  }

  async #mount(): Promise<void> {
    this.#sqlite3 = await sqlite3InitModule({
      print: console.log,
      printErr: console.error,
      locateFile: (file) => {
        console.log(`locateFile: ${publicUrl}${file}`);
        return `${publicUrl}${file}`;
      },
    });

    if (this.#sqlite3) {
      try {
        this.#db = new this.#sqlite3.oo1.DB();

        this.#loaded = true;

        console.log(
          `SQLite3 version ${this.#sqlite3.version.libVersion} ${
            this.#loaded ? "loaded" : "not loaded"
          }`
        );
      } catch (err) {
        console.warn("Failed to enable OPFS:", err);
      }
    }
  }

  mount(): void {
    this.#mountCount++;
    if (this.#mountCount !== 1) return;

    this.#mount();
  }

  unmount(): void {
    this.#mountCount--;
    if (this.#mountCount !== 0) return;

    if (this.#db) {
      this.#db.close();
      this.#db = undefined;
    }

    if (this.#sqlite3) {
      this.#sqlite3 = undefined;
    }
  }

  load(buffer: ArrayBuffer, immutable: boolean = false): Database | undefined {
    if (this.#sqlite3) {
      const ba = new Uint8Array(buffer);
      ba[18] = ba[19] = 0; // force db out of WAL mode.

      const p = this.#sqlite3.wasm.allocFromTypedArray(ba);
      const db = new this.#sqlite3.oo1.DB();

      let deserialize_flags = this.#sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE;
      if (!immutable) {
        deserialize_flags |= this.#sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE;
      }

      if (db.pointer) {
        const rc = this.#sqlite3.capi.sqlite3_deserialize(
          db.pointer,
          "main",
          p,
          ba.byteLength,
          ba.byteLength,
          deserialize_flags
        );
        db.checkRc(rc);
        return db;
      }
    }
    return undefined;
  }

  download(db: Database): void {
    const binaryArray = this.#getDBatabaseBytes(db);
    if (binaryArray) dbUtils.save_database(binaryArray);
  }

  async importDB(db: Database) {
    if (!this.#db) return;

    const columns = (await dbUtils.get_table_schema(db, "Isolates")).map(
      (column) => column.name
    );
    const data = await dbUtils.get_table_data(db, "Isolates");
    const version = (await dbUtils.get_table_version(db)).shift();
    return { columns, data, version };
  }

  get sqlite3(): Sqlite3Static | undefined {
    return this.#sqlite3;
  }

  get db(): Database | undefined {
    return this.#db;
  }

  get loaded(): boolean {
    return this.#loaded;
  }
}

export const SQLiteClientContext = React.createContext<
  SQLiteClient | undefined
>(undefined);

export const useSQLiteClient = (queryClient?: SQLiteClient) => {
  const client = React.useContext(SQLiteClientContext);

  if (queryClient) {
    return queryClient;
  }

  if (!client) {
    throw new Error("No SQLiteClient set, use SQLiteClientProvider to set one");
  }

  return client;
};

export type SQLiteClientProviderProps = {
  client: SQLiteClient;
  children?: React.ReactNode;
};

export const SQLiteClientProvider = ({
  client,
  children,
}: SQLiteClientProviderProps): React.JSX.Element => {
  React.useEffect(() => {
    client.mount();
    return () => {
      client.unmount();
    };
  }, [client]);

  return (
    <SQLiteClientContext.Provider value={client}>
      {children}
    </SQLiteClientContext.Provider>
  );
};
