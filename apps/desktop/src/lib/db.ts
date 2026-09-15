import Database from "@tauri-apps/plugin-sql";

let dbPromise: Promise<Database> | null = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = Database.load("sqlite:finance.db");
  }
  return dbPromise;
}

export type Category = {
  id: number;
  name: string;
  icon: string | null;
  type: "income" | "expense";
};

export type Transaction = {
  id: number;
  type: "income" | "expense";
  amount: number;
  category_id: number | null;
  note: string | null;
  date: string;
  created_at: string;
};
