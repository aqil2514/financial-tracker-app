import { beforeEach, describe, expect, it } from "vitest";
import type { SQLiteDatabase } from "expo-sqlite";
import { createSqliteTestDb } from "@/lib/database/testing/sqlite-test-db";
import { flushPushQueue } from "./flush-push-queue";
import type { FetchLike } from "./worker-client";

const creds = { workerUrl: "https://worker.test/", token: "tok" };

type Call = { method: string; path: string; body: unknown; auth: string | null };

function fakeFetch(respond: (call: Call) => { status: number; json?: unknown } = () => ({ status: 200 })) {
  const calls: Call[] = [];
  const impl = (async (url: string, init: RequestInit = {}) => {
    const call: Call = {
      method: init.method ?? "GET",
      path: url.replace("https://worker.test", ""),
      body: init.body ? JSON.parse(init.body as string) : null,
      auth: (init.headers as Record<string, string>)?.Authorization ?? null,
    };
    calls.push(call);
    const { status, json } = respond(call);
    return { ok: status < 400, status, json: async () => json ?? { status: "ok" } };
  }) as unknown as FetchLike;
  return { calls, impl };
}

const queueRows = (db: SQLiteDatabase) =>
  db.getAllAsync<{ table_name: string; row_id: string; op: string; attempts: number; last_error: string | null }>(
    "SELECT table_name, row_id, op, attempts, last_error FROM cloud_sync_queue ORDER BY id"
  );

describe("flushPushQueue", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    db = await createSqliteTestDb();
  });

  it("mengirim upsert berurutan FK dengan bearer token dan mengosongkan antrean", async () => {
    await db.runAsync("INSERT INTO transactions (id, note, type, amount, date, account_id) VALUES ('t1', 'n', 'expense', 5, '2026-11-04T10:00', 'a1')");
    await db.runAsync("INSERT INTO accounts (id, name) VALUES ('a1', 'Kas')");
    await db.runAsync("INSERT INTO account_groups (id, name) VALUES ('g1', 'Grup')");

    const { calls, impl } = fakeFetch();
    const result = await flushPushQueue(db, creds, impl);

    expect(result).toEqual({ sent: 3, failed: 0, aborted: false });
    expect(calls.map((call) => call.path)).toEqual(["/account-groups", "/accounts", "/transactions"]);
    expect(calls.every((call) => call.method === "POST" && call.auth === "Bearer tok")).toBe(true);
    expect(await queueRows(db)).toEqual([]);
  });

  it("mengirim label ke /labels dan hapus ke DELETE /labels/:id", async () => {
    await db.runAsync("INSERT INTO labels (id, name, scope, updated_at) VALUES ('l1', 'Liburan', 'account', '2026-11-04 10:00:00')");
    const first = fakeFetch();
    await flushPushQueue(db, creds, first.impl);
    expect(first.calls).toEqual([
      {
        method: "POST",
        path: "/labels",
        body: { id: "l1", name: "Liburan", scope: "account", updatedAt: "2026-11-04 10:00:00" },
        auth: "Bearer tok",
      },
    ]);

    await db.runAsync("DELETE FROM labels WHERE id = 'l1'");
    const second = fakeFetch();
    await flushPushQueue(db, creds, second.impl);
    expect(second.calls.map((call) => `${call.method} ${call.path}`)).toEqual(["DELETE /labels/l1"]);
    expect(await queueRows(db)).toEqual([]);
  });

  it("junction label: attach ke POST /labels/:scope/:entityId, detach ke DELETE .../:labelId", async () => {
    await db.runAsync("INSERT INTO categories (id, name, type) VALUES ('c1', 'Makan', 'expense')");
    await db.runAsync("INSERT INTO labels (id, name, scope) VALUES ('l1', 'Rutin', 'transaction_category')");
    await db.runAsync(
      "INSERT INTO category_labels (id, category_id, label_id, updated_at) VALUES ('j1', 'c1', 'l1', '2026-11-04 10:00:00')"
    );
    const first = fakeFetch();
    await flushPushQueue(db, creds, first.impl);
    expect(first.calls.map((call) => `${call.method} ${call.path}`)).toEqual(["POST /categories", "POST /labels", "POST /labels/categories/c1"]);
    expect(first.calls.at(-1)?.body).toEqual({ id: "j1", labelId: "l1", updatedAt: "2026-11-04 10:00:00" });

    await db.runAsync("DELETE FROM category_labels WHERE id = 'j1'");
    const second = fakeFetch();
    await flushPushQueue(db, creds, second.impl);
    expect(second.calls.map((call) => `${call.method} ${call.path}`)).toEqual(["DELETE /labels/categories/c1/l1"]);
    expect(await queueRows(db)).toEqual([]);
  });

  it("memetakan transaksi ke payload camelCase dengan boolean dan updatedAt", async () => {
    await db.runAsync("INSERT INTO accounts (id, name) VALUES ('a1', 'Kas')");
    await db.runAsync("INSERT INTO contacts (id, name) VALUES ('k1', 'Budi')");
    await db.runAsync(
      "INSERT INTO transactions (id, note, type, amount, date, account_id, contact_id, is_cash_neutral) VALUES ('t1', 'n', 'expense', 5, '2026-11-04T10:00', 'a1', 'k1', 1)"
    );
    const { calls, impl } = fakeFetch();
    await flushPushQueue(db, creds, impl);

    const body = calls.find((call) => call.path === "/transactions")?.body as Record<string, unknown>;
    expect(body).toMatchObject({
      id: "t1",
      type: "expense",
      amount: 5,
      accountId: "a1",
      contactId: "k1",
      date: "2026-11-04T10:00",
      isCashNeutral: true,
    });
    expect(body.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it("mengirim akun, pembelian, dan penjualan valas berurutan FK dengan payload sesuai Worker", async () => {
    const stamp = "2026-11-07 10:00:00";
    await db.runAsync("INSERT INTO accounts (id, name, account_type) VALUES ('kas', 'BCA', 'cash'), ('fx', 'USD', 'forex')");
    await db.runAsync("INSERT INTO forex_accounts (account_id, country, currency, current_rate, updated_at) VALUES ('fx', 'AS', 'USD', 16500, ?)", [stamp]);
    await db.runAsync("INSERT INTO transactions (id, note, type, amount, date, account_id, transfer_account_id) VALUES ('t1', 'b', 'transfer', 160000, '2026-11-07T10:00', 'kas', 'fx'), ('t2', 'j', 'transfer', 80000, '2026-11-07T11:00', 'fx', 'kas')");
    await db.runAsync("INSERT INTO forex_purchases (id, account_id, transaction_id, unit, rate, date, updated_at) VALUES ('p1', 'fx', 't1', 10, 16000, '2026-11-07T10:00', ?)", [stamp]);
    await db.runAsync("INSERT INTO forex_sales (id, account_id, transaction_id, adjustment_transaction_id, unit, rate, average_cost_per_unit, realized_pl, date, updated_at) VALUES ('s1', 'fx', 't2', NULL, 5, 17000, 16000, 5000, '2026-11-07T11:00', ?)", [stamp]);

    const { calls, impl } = fakeFetch();
    const result = await flushPushQueue(db, creds, impl);

    expect(result).toEqual({ sent: 7, failed: 0, aborted: false });
    const paths = calls.map((call) => call.path);
    expect(paths.indexOf("/forex/accounts/push")).toBeGreaterThan(paths.indexOf("/accounts"));
    expect(paths.indexOf("/forex/purchases/push")).toBeGreaterThan(paths.indexOf("/transactions"));
    expect(calls.find((call) => call.path === "/forex/accounts/push")?.body).toEqual({
      accountId: "fx", country: "AS", currency: "USD", currentRate: 16500, updatedAt: stamp,
    });
    expect(calls.find((call) => call.path === "/forex/purchases/push")?.body).toEqual({
      id: "p1", accountId: "fx", transactionId: "t1", unit: 10, rate: 16000, date: "2026-11-07T10:00", updatedAt: stamp,
    });
    expect(calls.find((call) => call.path === "/forex/sales/push")?.body).toEqual({
      id: "s1", accountId: "fx", transactionId: "t2", adjustmentTransactionId: null, unit: 5, rate: 17000,
      averageCostPerUnit: 16000, realizedPl: 5000, date: "2026-11-07T11:00", updatedAt: stamp,
    });
    expect(await queueRows(db)).toEqual([]);

    await db.runAsync("DELETE FROM forex_sales WHERE id = 's1'");
    await db.runAsync("DELETE FROM forex_purchases WHERE id = 'p1'");
    const second = fakeFetch();
    await flushPushQueue(db, creds, second.impl);
    expect(second.calls.map((call) => `${call.method} ${call.path}`).sort()).toEqual([
      "DELETE /forex/purchases/push/p1",
      "DELETE /forex/sales/push/s1",
    ]);
  });

  it("mengirim direction untuk akun utang", async () => {
    await db.runAsync("INSERT INTO accounts (id, name, account_type) VALUES ('d1', 'Piutang', 'debt')");
    await db.runAsync("INSERT INTO debt_accounts (account_id, direction) VALUES ('d1', 'receivable')");
    const { calls, impl } = fakeFetch();
    await flushPushQueue(db, creds, impl);
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toMatchObject({ id: "d1", accountType: "debt", direction: "receivable" });
  });

  it("422 dicatat ke rejected log dan entry tetap; sukses berikutnya membersihkan log", async () => {
    await db.runAsync("INSERT INTO contacts (id, name) VALUES ('k1', 'Budi')");
    let reject = true;
    const { impl } = fakeFetch(() => (reject ? { status: 422, json: { error: "nama kosong" } } : { status: 200 }));

    expect(await flushPushQueue(db, creds, impl)).toEqual({ sent: 0, failed: 1, aborted: false });
    expect(await queueRows(db)).toMatchObject([{ row_id: "k1", attempts: 1, last_error: "rejected: nama kosong" }]);
    expect(await db.getAllAsync("SELECT table_name, row_id, direction, reason FROM cloud_sync_rejected_log")).toEqual([
      { table_name: "contacts", row_id: "k1", direction: "push", reason: "nama kosong" },
    ]);

    reject = false;
    await flushPushQueue(db, creds, impl);
    expect(await queueRows(db)).toEqual([]);
    expect(await db.getAllAsync("SELECT * FROM cloud_sync_rejected_log")).toEqual([]);
  });

  it("gagal jaringan menghentikan putaran dan menandai entry", async () => {
    await db.runAsync("INSERT INTO account_groups (id, name) VALUES ('g1', 'Grup')");
    await db.runAsync("INSERT INTO contacts (id, name) VALUES ('k1', 'Budi')");
    const impl = (async () => {
      throw new TypeError("Network request failed");
    }) as unknown as FetchLike;

    const result = await flushPushQueue(db, creds, impl);
    expect(result).toEqual({ sent: 0, failed: 1, aborted: true });
    const rows = await queueRows(db);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ attempts: 1, last_error: "Network request failed" });
    expect(rows[1].attempts).toBe(0);
  });

  it("error HTTP selain 422 menandai entry tapi lanjut ke berikutnya", async () => {
    await db.runAsync("INSERT INTO account_groups (id, name) VALUES ('g1', 'Grup')");
    await db.runAsync("INSERT INTO contacts (id, name) VALUES ('k1', 'Budi')");
    const { impl } = fakeFetch((call) => (call.path === "/account-groups" ? { status: 500, json: { error: "boom" } } : { status: 200 }));

    expect(await flushPushQueue(db, creds, impl)).toEqual({ sent: 1, failed: 1, aborted: false });
    expect(await queueRows(db)).toMatchObject([{ table_name: "account_groups", attempts: 1, last_error: "boom" }]);
  });

  it("delete dikirim setelah upsert, anak dulu, dan 404 dianggap sukses", async () => {
    await db.runAsync("INSERT INTO accounts (id, name) VALUES ('a1', 'Kas')");
    await db.runAsync("INSERT INTO transactions (id, note, type, amount, date, account_id) VALUES ('t1', 'n', 'expense', 5, '2026-11-04T10:00', 'a1')");
    await db.runAsync("DELETE FROM cloud_sync_queue");
    await db.runAsync("DELETE FROM transactions WHERE id = 't1'");
    await db.runAsync("DELETE FROM accounts WHERE id = 'a1'");
    await db.runAsync("INSERT INTO contacts (id, name) VALUES ('k1', 'Budi')");

    const { calls, impl } = fakeFetch((call) => (call.path === "/transactions/t1" ? { status: 404, json: { error: "x" } } : { status: 200 }));
    const result = await flushPushQueue(db, creds, impl);

    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual(["POST /contacts", "DELETE /transactions/t1", "DELETE /accounts/a1"]);
    expect(result).toEqual({ sent: 3, failed: 0, aborted: false });
    expect(await queueRows(db)).toEqual([]);
  });

  it("body delete diambil dari kolom payload", async () => {
    await db.runAsync("INSERT INTO cloud_sync_queue (table_name, row_id, op, payload) VALUES ('accounts', 'a1', 'delete', ?)", [
      JSON.stringify({ transactionAction: "reassign", targetAccountId: "a2" }),
    ]);
    const { calls, impl } = fakeFetch();
    await flushPushQueue(db, creds, impl);
    expect(calls[0]).toMatchObject({ method: "DELETE", path: "/accounts/a1", body: { transactionAction: "reassign", targetAccountId: "a2" } });
  });

  it("debts tanpa transaksi tidak dikirim tapi keluar dari antrean", async () => {
    await db.runAsync("INSERT INTO debts (id, type, amount, date) VALUES ('d1', 'receivable', 10, '2026-11-04T10:00')");
    const { calls, impl } = fakeFetch();
    await flushPushQueue(db, creds, impl);
    expect(calls).toEqual([]);
    expect(await queueRows(db)).toEqual([]);
  });

  it("baris yang diedit lagi saat request berjalan tetap ada di antrean", async () => {
    await db.runAsync("INSERT INTO contacts (id, name) VALUES ('k1', 'Budi')");
    const { impl } = fakeFetch(() => {
      void db.runAsync("UPDATE contacts SET name = 'Budi Baru' WHERE id = 'k1'");
      return { status: 200 };
    });
    await flushPushQueue(db, creds, impl);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await queueRows(db)).toMatchObject([{ table_name: "contacts", row_id: "k1", op: "upsert" }]);
  });

  it("entry yang sudah habis percobaan dilewati sync otomatis, tapi sync manual mencobanya lagi", async () => {
    await db.runAsync("INSERT INTO contacts (id, name) VALUES ('k1', 'Budi')");
    await db.runAsync("UPDATE cloud_sync_queue SET attempts = 5, last_error = 'Invalid payload'");

    const auto = fakeFetch();
    expect(await flushPushQueue(db, creds, auto.impl)).toEqual({ sent: 0, failed: 0, aborted: false });
    expect(auto.calls).toEqual([]);

    const manual = fakeFetch();
    expect(await flushPushQueue(db, creds, manual.impl, undefined, { includeExhausted: true })).toMatchObject({ sent: 1 });
    expect(manual.calls).toHaveLength(1);
    expect(await queueRows(db)).toEqual([]);
  });

  it("400 Invalid payload menaikkan attempts tiap flush sampai berhenti dicoba otomatis", async () => {
    await db.runAsync("INSERT INTO contacts (id, name) VALUES ('k1', 'Budi')");
    const failing = fakeFetch(() => ({ status: 400, json: { error: "Invalid payload" } }));

    for (let i = 0; i < 7; i++) await flushPushQueue(db, creds, failing.impl);

    expect(failing.calls).toHaveLength(5);
    expect(await queueRows(db)).toMatchObject([{ attempts: 5, last_error: "Invalid payload" }]);
  });

  it("flush bersamaan berbagi satu putaran", async () => {
    await db.runAsync("INSERT INTO contacts (id, name) VALUES ('k1', 'Budi')");
    const { calls, impl } = fakeFetch();
    const [first, second] = await Promise.all([flushPushQueue(db, creds, impl), flushPushQueue(db, creds, impl)]);
    expect(first).toBe(second);
    expect(calls).toHaveLength(1);
  });
});
