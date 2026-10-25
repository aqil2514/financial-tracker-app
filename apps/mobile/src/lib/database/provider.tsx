import type { ReactNode } from "react";
import { SQLiteProvider } from "expo-sqlite";
import { DATABASE_NAME, migrateDbIfNeeded } from "./migrate";

export function AppDatabaseProvider({ children }: { children: ReactNode }) {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded}>
      {children}
    </SQLiteProvider>
  );
}
