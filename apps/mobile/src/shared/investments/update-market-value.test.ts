import { describe, expect, it, vi } from "vitest";
import type { SQLiteDatabase } from "expo-sqlite";
import { updateMarketValue } from "./update-market-value";

describe("updateMarketValue", () => {
  it("meng-UPDATE hanya investment_accounts milik akun itu dan memajukan updated_at", async () => {
    const runAsync = vi.fn().mockResolvedValue(undefined);
    const db = { runAsync } as unknown as SQLiteDatabase;

    await updateMarketValue(db, "acc-1", 1_500_000);

    expect(runAsync).toHaveBeenCalledTimes(1);
    const [sql, params] = runAsync.mock.calls[0];
    expect(sql).toContain("UPDATE investment_accounts");
    expect(sql).toContain("updated_at = datetime('now')");
    expect(sql).not.toMatch(/transactions|accounts\.balance/);
    expect(params).toEqual([1_500_000, "acc-1"]);
  });
});
