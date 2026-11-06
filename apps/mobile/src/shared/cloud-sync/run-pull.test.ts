import { beforeEach, describe, expect, it } from "vitest";
import type { SQLiteDatabase } from "expo-sqlite";
import { createSqliteTestDb } from "@/lib/database/testing/sqlite-test-db";
import type { SyncResponse } from "./pull-types";
import { runPull } from "./run-pull";
import { getSyncState, setCheckpoint } from "./sync-state";
import type { FetchLike } from "./worker-client";

const creds = { workerUrl: "https://worker.test", token: "tok" };

function emptyResponse(overrides: Partial<SyncResponse> = {}): SyncResponse {
  return {
    checkpoint: "2026-11-04 10:00:00",
    accountGroups: [],
    categories: [],
    contacts: [],
    labels: [],
    transactionLabels: [],
    categoryLabels: [],
    accountLabels: [],
    accounts: [],
    transactions: [],
    debts: [],
    debtPayments: [],
    debtAccounts: [],
    investmentAccounts: [],
    investmentPurchases: [],
    investmentSales: [],
    categoryPeriods: [],
    thirdPartyFunds: [],
    ...overrides,
  };
}

function fetchReturning(response: SyncResponse) {
  const urls: string[] = [];
  const impl = (async (url: string) => {
    urls.push(url);
    return { ok: true, status: 200, json: async () => response };
  }) as unknown as FetchLike;
  return { urls, impl };
}

const account = (id: string, updatedAt: string | null, extra: Record<string, unknown> = {}) => ({
  id,
  name: `Akun ${id}`,
  icon: null,
  color: null,
  initialBalance: 100,
  groupId: null,
  description: null,
  isActive: true,
  accountType: "cash" as const,
  updatedAt,
  deletedAt: null,
  ...extra,
});

const transaction = (id: string, updatedAt: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: "expense" as const,
  amount: 5,
  categoryId: null,
  accountId: "a1",
  transferAccountId: null,
  note: "makan",
  date: "2026-11-04T10:00",
  description: null,
  contactId: null,
  isCashNeutral: false,
  updatedAt,
  deletedAt: null,
  ...extra,
});

describe("runPull", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    db = await createSqliteTestDb();
  });

  it("pull pertama tanpa since menerapkan data, memajukan checkpoint, dan tidak mengantre gema", async () => {
    const { urls, impl } = fetchReturning(
      emptyResponse({
        accountGroups: [{ id: "g1", name: "Grup", updatedAt: "2026-11-01 00:00:00", deletedAt: null }],
        accounts: [account("a1", "2026-11-01 00:00:00", { groupId: "g1" })],
        contacts: [{ id: "k1", name: "Budi", note: null, updatedAt: "2026-11-01 00:00:00", deletedAt: null }],
        transactions: [transaction("t1", "2026-11-02 00:00:00", { contactId: "k1" })],
      })
    );

    const result = await runPull(db, creds, impl);

    expect(urls).toEqual(["https://worker.test/sync"]);
    expect(result).toEqual({ applied: 4, rejected: 0, skipped: 0, checkpointAdvanced: true });
    expect((await getSyncState(db)).checkpoint).toBe("2026-11-04 10:00:00");
    expect(await db.getFirstAsync("SELECT name, group_id FROM accounts WHERE id = 'a1'")).toEqual({ name: "Akun a1", group_id: "g1" });
    expect(await db.getFirstAsync("SELECT contact_id, updated_at FROM transactions WHERE id = 't1'")).toEqual({
      contact_id: "k1",
      updated_at: "2026-11-02 00:00:00",
    });
    expect(await db.getAllAsync("SELECT * FROM cloud_sync_queue")).toEqual([]);
    expect(await db.getFirstAsync("SELECT applying_pull FROM cloud_sync_state")).toEqual({ applying_pull: 0 });
  });

  it("pull berikutnya memakai checkpoint sebagai since", async () => {
    await runPull(db, creds, fetchReturning(emptyResponse()).impl);
    const { urls, impl } = fetchReturning(emptyResponse({ checkpoint: "2026-11-04 11:00:00" }));
    await runPull(db, creds, impl);
    expect(urls).toEqual(["https://worker.test/sync?since=2026-11-04%2010%3A00%3A00"]);
  });

  it("LWW: versi cloud yang lebih lama atau sama tidak menimpa data lokal", async () => {
    await db.runAsync("INSERT INTO accounts (id, name, updated_at) VALUES ('a1', 'Lokal', '2026-11-03 00:00:00')");
    await db.runAsync("DELETE FROM cloud_sync_queue");

    await runPull(db, creds, fetchReturning(emptyResponse({ accounts: [account("a1", "2026-11-02 00:00:00")] })).impl);
    expect(await db.getFirstAsync("SELECT name FROM accounts WHERE id = 'a1'")).toEqual({ name: "Lokal" });

    await runPull(db, creds, fetchReturning(emptyResponse({ accounts: [account("a1", "2026-11-03 00:00:00")] })).impl);
    expect(await db.getFirstAsync("SELECT name FROM accounts WHERE id = 'a1'")).toEqual({ name: "Lokal" });

    await runPull(db, creds, fetchReturning(emptyResponse({ accounts: [account("a1", "2026-11-04 00:00:00")] })).impl);
    expect(await db.getFirstAsync("SELECT name, updated_at FROM accounts WHERE id = 'a1'")).toEqual({
      name: "Akun a1",
      updated_at: "2026-11-04 00:00:00",
    });
  });

  it("deletedAt terisi menghapus baris lokal (hard delete) tanpa mengantre delete", async () => {
    await db.runAsync("INSERT INTO contacts (id, name, updated_at) VALUES ('k1', 'Budi', '2026-11-01 00:00:00')");
    await db.runAsync("DELETE FROM cloud_sync_queue");
    await runPull(
      db,
      creds,
      fetchReturning(
        emptyResponse({ contacts: [{ id: "k1", name: "Budi", note: null, updatedAt: "2026-11-02 00:00:00", deletedAt: "2026-11-02 00:00:00" }] })
      ).impl
    );
    expect(await db.getAllAsync("SELECT id FROM contacts")).toEqual([]);
    expect(await db.getAllAsync("SELECT * FROM cloud_sync_queue")).toEqual([]);
  });

  it("label dari cloud diterapkan, dan label lokal sebangsa (nama+scope sama, id beda) kalah", async () => {
    await db.runAsync("INSERT INTO labels (id, name, scope) VALUES ('lokal', 'Liburan', 'transaction_category')");
    await db.runAsync("INSERT INTO labels (id, name, scope) VALUES ('aman', 'Liburan', 'account')");
    const label = (id: string, name: string, scope: "transaction_category" | "account") => ({
      id,
      name,
      scope,
      updatedAt: "2026-11-02 00:00:00",
      deletedAt: null,
    });

    const result = await runPull(
      db,
      creds,
      fetchReturning(emptyResponse({ labels: [label("cloud", "Liburan", "transaction_category")] })).impl
    );

    expect(result).toMatchObject({ applied: 1, rejected: 0 });
    expect(await db.getAllAsync("SELECT id, name, scope FROM labels ORDER BY id")).toEqual([
      { id: "aman", name: "Liburan", scope: "account" },
      { id: "cloud", name: "Liburan", scope: "transaction_category" },
    ]);
    expect(await db.getAllAsync("SELECT * FROM cloud_sync_queue WHERE table_name = 'labels' AND row_id = 'cloud'")).toEqual([]);
  });

  it("junction label: diterapkan, pasangan lokal beda id kalah, tombstone melepas", async () => {
    await db.runAsync("INSERT INTO accounts (id, name) VALUES ('a1', 'Kas')");
    await db.runAsync("INSERT INTO labels (id, name, scope, updated_at) VALUES ('l1', 'X', 'account', '2026-11-01 00:00:00')");
    await db.runAsync("INSERT INTO account_labels (id, account_id, label_id) VALUES ('lokal', 'a1', 'l1')");
    const row = (deletedAt: string | null) => ({
      id: "cloud",
      accountId: "a1",
      labelId: "l1",
      updatedAt: deletedAt ?? "2026-11-02 00:00:00",
      deletedAt,
    });

    await runPull(db, creds, fetchReturning(emptyResponse({ accountLabels: [row(null)] })).impl);
    expect(await db.getAllAsync("SELECT id, account_id, label_id FROM account_labels")).toEqual([
      { id: "cloud", account_id: "a1", label_id: "l1" },
    ]);
    expect(await db.getAllAsync("SELECT * FROM cloud_sync_queue WHERE table_name = 'account_labels' AND row_id = 'cloud'")).toEqual([]);

    await runPull(db, creds, fetchReturning(emptyResponse({ accountLabels: [row("2026-11-03 00:00:00")] })).impl);
    expect(await db.getAllAsync("SELECT id FROM account_labels")).toEqual([]);
  });

  it("tombstone label menghapus label lokal", async () => {
    await db.runAsync("INSERT INTO labels (id, name, scope, updated_at) VALUES ('l1', 'X', 'account', '2026-11-01 00:00:00')");
    await runPull(
      db,
      creds,
      fetchReturning(
        emptyResponse({
          labels: [{ id: "l1", name: "X", scope: "account", updatedAt: "2026-11-02 00:00:00", deletedAt: "2026-11-02 00:00:00" }],
        })
      ).impl
    );
    expect(await db.getAllAsync("SELECT id FROM labels")).toEqual([]);
  });

  it("tombstone untuk baris yang tidak ada lokal tidak dihitung sebagai diterapkan", async () => {
    const result = await runPull(
      db,
      creds,
      fetchReturning(
        emptyResponse({ contacts: [{ id: "hantu", name: "X", note: null, updatedAt: "2026-11-02 00:00:00", deletedAt: "2026-11-02 00:00:00" }] })
      ).impl
    );
    expect(result).toEqual({ applied: 0, rejected: 0, skipped: 0, checkpointAdvanced: true });
  });

  it("anak yang datang sebelum induk di tabel yang sama berhasil lewat coba ulang", async () => {
    const category = (id: string, parentId: string | null) => ({
      id,
      name: id,
      icon: null,
      type: "expense" as const,
      parentId,
      isActive: true,
      updatedAt: "2026-11-01 00:00:00",
      deletedAt: null,
    });
    const result = await runPull(db, creds, fetchReturning(emptyResponse({ categories: [category("anak", "induk"), category("induk", null)] })).impl);
    expect(result).toMatchObject({ applied: 2, rejected: 0 });
    expect(await db.getFirstAsync("SELECT parent_id FROM categories WHERE id = 'anak'")).toEqual({ parent_id: "induk" });
  });

  it("pull inkremental: FK gagal dicatat, tidak menghentikan pull, dan checkpoint tidak maju", async () => {
    await setCheckpoint(db, "2026-11-01 00:00:00");
    const result = await runPull(
      db,
      creds,
      fetchReturning(
        emptyResponse({
          accounts: [account("a1", "2026-11-01 00:00:00")],
          // category_id merujuk kategori yang tidak ada -> FOREIGN KEY gagal; baris sehat tetap masuk.
          transactions: [transaction("rusak", "2026-11-02 00:00:00", { categoryId: "tidak-ada" }), transaction("sehat", "2026-11-02 00:00:00")],
        })
      ).impl
    );

    expect(result).toEqual({ applied: 2, rejected: 1, skipped: 0, checkpointAdvanced: false });
    expect((await getSyncState(db)).checkpoint).toBe("2026-11-01 00:00:00");
    expect(await db.getAllAsync("SELECT id FROM transactions")).toEqual([{ id: "sehat" }]);
    const log = await db.getAllAsync<{ table_name: string; row_id: string; direction: string; reason: string }>(
      "SELECT table_name, row_id, direction, reason FROM cloud_sync_rejected_log"
    );
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ table_name: "transactions", row_id: "rusak", direction: "pull" });
    expect(log[0].reason).toMatch(/FOREIGN KEY/i);
    expect(await db.getFirstAsync("SELECT applying_pull FROM cloud_sync_state")).toEqual({ applying_pull: 0 });
  });

  it("pull penuh: FK gagal dilewati permanen (induk memang sudah dihapus), dicatat, dan checkpoint maju", async () => {
    const result = await runPull(
      db,
      creds,
      fetchReturning(
        emptyResponse({
          investmentPurchases: [
            { id: "yatim", accountId: "akun-terhapus", transactionId: null, unit: 1, pricePerUnit: 1, date: "2026-11-01T00:00", status: "settled", updatedAt: "2026-11-01 00:00:00", deletedAt: null },
          ],
        })
      ).impl
    );
    expect(result).toEqual({ applied: 0, rejected: 0, skipped: 1, checkpointAdvanced: true });
    const log = await db.getAllAsync<{ reason: string }>("SELECT reason FROM cloud_sync_rejected_log WHERE row_id = 'yatim'");
    expect(log).toHaveLength(1);
    expect(log[0].reason).toMatch(/^dilewati: .*FOREIGN KEY/);
  });

  it("transaksi tanpa account_id selalu dilewati permanen, baris sehat tetap masuk", async () => {
    await setCheckpoint(db, "2026-11-01 00:00:00");
    const result = await runPull(
      db,
      creds,
      fetchReturning(
        emptyResponse({
          accounts: [account("a1", "2026-11-01 00:00:00")],
          transactions: [transaction("tanpa-akun", "2026-11-02 00:00:00", { accountId: null }), transaction("sehat", "2026-11-02 00:00:00")],
        })
      ).impl
    );
    expect(result).toEqual({ applied: 2, rejected: 0, skipped: 1, checkpointAdvanced: true });
    expect(await db.getAllAsync("SELECT id FROM transactions")).toEqual([{ id: "sehat" }]);
    expect(await db.getFirstAsync<{ reason: string }>("SELECT reason FROM cloud_sync_rejected_log WHERE row_id = 'tanpa-akun'")).toMatchObject({
      reason: expect.stringMatching(/^dilewati: .*NOT NULL.*account_id/),
    });
  });

  it("log penolakan dibersihkan begitu baris yang sama berhasil diterapkan di pull berikutnya", async () => {
    await setCheckpoint(db, "2026-11-01 00:00:00");
    const broken = emptyResponse({ transactions: [transaction("t1", "2026-11-02 00:00:00", { categoryId: "c1" })] });
    await runPull(db, creds, fetchReturning(broken).impl);
    expect(await db.getAllAsync("SELECT row_id FROM cloud_sync_rejected_log")).toHaveLength(1);

    const fixed = emptyResponse({
      categories: [{ id: "c1", name: "Makan", icon: null, type: "expense", parentId: null, isActive: true, updatedAt: "2026-11-01 00:00:00", deletedAt: null }],
      transactions: [transaction("t1", "2026-11-02 00:00:00", { categoryId: "c1" })],
    });
    const result = await runPull(db, creds, fetchReturning(fixed).impl);
    expect(result).toMatchObject({ rejected: 0, checkpointAdvanced: true });
    expect(await db.getAllAsync("SELECT * FROM cloud_sync_rejected_log")).toEqual([]);
  });

  it("memulihkan penanda gema walau fetch gagal, dan tidak menyentuh checkpoint", async () => {
    const impl = (async () => {
      throw new TypeError("Network request failed");
    }) as unknown as FetchLike;
    await expect(runPull(db, creds, impl)).rejects.toThrow("Network request failed");
    expect((await getSyncState(db)).checkpoint).toBeNull();
    await db.runAsync("INSERT INTO contacts (id, name) VALUES ('k1', 'Budi')");
    expect(await db.getAllAsync("SELECT row_id FROM cloud_sync_queue")).toEqual([{ row_id: "k1" }]);
  });

  it("menerapkan pivot periode, debt_accounts, dan investment_accounts; debt_accounts dilewati kalau ada perubahan lokal tertunda", async () => {
    const stamp = "2026-11-01 00:00:00";
    await runPull(
      db,
      creds,
      fetchReturning(
        emptyResponse({
          categories: [{ id: "c1", name: "Gaji", icon: null, type: "income", parentId: null, isActive: true, updatedAt: stamp, deletedAt: null }],
          accounts: [
            account("d1", stamp, { accountType: "debt" }),
            account("i1", stamp, { accountType: "investment" }),
          ],
          debtAccounts: [{ accountId: "d1", direction: "receivable", updatedAt: stamp, deletedAt: null }],
          investmentAccounts: [{ accountId: "i1", unitLabel: "lembar", currentMarketValue: 500, updatedAt: stamp, deletedAt: null }],
          categoryPeriods: [{ id: "p1", name: "P", startDate: "2026-11-01", endDate: "2026-11-30", categoryIds: ["c1"], updatedAt: stamp, deletedAt: null }],
        })
      ).impl
    );
    expect(await db.getFirstAsync("SELECT direction FROM debt_accounts WHERE account_id = 'd1'")).toEqual({ direction: "receivable" });
    expect(await db.getFirstAsync("SELECT unit_label, current_market_value FROM investment_accounts WHERE account_id = 'i1'")).toEqual({ unit_label: "lembar", current_market_value: 500 });
    expect(await db.getAllAsync("SELECT category_id FROM category_period_categories WHERE period_id = 'p1'")).toEqual([{ category_id: "c1" }]);
    expect(await db.getAllAsync("SELECT * FROM cloud_sync_queue")).toEqual([]);

    await db.runAsync("UPDATE debt_accounts SET direction = 'payable' WHERE account_id = 'd1'");
    await runPull(db, creds, fetchReturning(emptyResponse({ debtAccounts: [{ accountId: "d1", direction: "receivable", updatedAt: "2026-11-05 00:00:00", deletedAt: null }] })).impl);
    expect(await db.getFirstAsync("SELECT direction FROM debt_accounts WHERE account_id = 'd1'")).toEqual({ direction: "payable" });
  });
});
