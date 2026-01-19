import {create} from 'zustand';
import sqlite3InitModule, { Database, Sqlite3Static } from '@sqlite.org/sqlite-wasm';

interface SQLiteProps {
    sqlite3: Sqlite3Static | undefined;
    init: () => Promise<Sqlite3Static>;
    load: (filename?: string, flags?: string, vfs?: string) => Database | null;
    db: Database | undefined;
}

export const useSQLite = create<SQLiteProps>((set, get) => ({
    sqlite3: undefined,
    db: undefined,
    init: async () => {
        const sqlite3 = await sqlite3InitModule({
            print: console.log,
            printErr: console.error,
        });
        set({ sqlite3 });
        return sqlite3;
    },
    load: (filename?: string, flags?: string, vfs?: string) => {
        const sqlite3 = get().sqlite3;
        if (sqlite3) {
            const db = new sqlite3.oo1.DB(filename, flags, vfs);
            set({ db });
            return db;
        }
        return null;
    }
}));