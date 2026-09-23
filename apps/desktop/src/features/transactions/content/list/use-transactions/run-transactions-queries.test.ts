import { describe, expect, it, vi } from "vitest";

import { runTransactionsQueries } from "./run-transactions-queries";

/**
 * `runTransactionsQueries` diuji lewat SPY pada `db.select` (bukan
 * eksekusi SQLite asli — proyek ini tidak punya dependency SQLite untuk
 * testing, lihat pola sama di `apply-debt-transaction.test.ts`) — yang
 * diverifikasi di sini adalah STRUKTUR SQL dan NUMBERED PLACEHOLDER ($N)
 * yang dikirim, karena itu yang paling rawan salah saat CTE running
 * balance ditambahkan (lihat dokumentasi lengkap kenapa `accountId`
 * ditaruh di urutan PALING AKHIR di `run-transactions-queries.ts`).
 *
 * `$N` reuse (indeks yang sama dipakai berkali-kali dalam satu query)
 * SUDAH dikonfirmasi didukung driver Tauri SQL yang dipakai proyek ini —
 * lihat pola sama persis di
 * `features/accounts/dialogs/detail-dialog/right-side/running-balance-query.ts`
 * (kode production yang sudah berjalan, `$1` dipakai 6x dalam satu query).
 */
function createFakeDb() {
  const calls: { sql: string; params: unknown[] }[] = [];
  const db = {
    select: vi.fn(async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      return [];
    }),
  };
  return { db, calls };
}

describe("runTransactionsQueries", () => {
  it("tanpa accountId: query biasa tanpa CTE/running_balance", async () => {
    const { db, calls } = createFakeDb();

    await runTransactionsQueries(db as never, {
      whereClause: "WHERE type = $1",
      params: ["expense"],
      orderClause: "ORDER BY date DESC, id DESC",
      limitOffsetClause: "LIMIT $2 OFFSET $3",
      limitOffsetParams: [20, 0],
    });

    expect(calls).toHaveLength(2);
    expect(calls[0].sql).not.toContain("WITH ordered_tx");
    expect(calls[0].sql).not.toContain("running_balance");
    expect(calls[0].params).toEqual(["expense", 20, 0]);
    expect(calls[1].sql).toContain("SELECT COUNT(*) as total FROM transactions");
    expect(calls[1].params).toEqual(["expense"]);
  });

  it("dengan accountId: query rows pakai CTE running_balance, accountId di index PALING AKHIR", async () => {
    const { db, calls } = createFakeDb();

    // Meniru whereClause hasil buildWhereConditions saat accountId=5
    // diberikan (lihat build-where-conditions.ts): accountCondition
    // sendiri sudah masuk whereClause dengan $1/$2 (dua slot, nilai sama).
    await runTransactionsQueries(db as never, {
      whereClause: "WHERE (account_id = $1 OR transfer_account_id = $2)",
      params: [5, 5],
      orderClause: "ORDER BY date DESC, id DESC",
      limitOffsetClause: "LIMIT $3 OFFSET $4",
      limitOffsetParams: [20, 0],
      accountId: 5,
    });

    const [rowsCall, countCall] = calls;

    // rowsParams = [...params(2), ...limitOffsetParams(2)] = 4 item ->
    // accountIdIndex = 4 + 1 = 5.
    expect(rowsCall.sql).toContain("WITH ordered_tx AS");
    expect(rowsCall.sql).toContain("running_balance");
    expect(rowsCall.sql).toContain("$5");
    expect(rowsCall.params).toEqual([5, 5, 20, 0, 5]);
    // Placeholder terakhir ($5) harus konsisten dengan accountId asli.
    expect(rowsCall.params[4]).toBe(5);

    // countParams = [...params(2), accountId] = 3 item -> accountIdIndex
    // untuk count = clauses.params.length + 1 = 2 + 1 = 3.
    expect(countCall.sql).toContain("WITH ordered_tx AS");
    expect(countCall.sql).toContain("$3");
    expect(countCall.params).toEqual([5, 5, 5]);
  });

  it("dengan accountId TANPA filter user lain: numbering tetap benar (whereClause kosong)", async () => {
    const { db, calls } = createFakeDb();

    await runTransactionsQueries(db as never, {
      whereClause: "",
      params: [],
      orderClause: "ORDER BY date DESC, id DESC",
      limitOffsetClause: "LIMIT $1 OFFSET $2",
      limitOffsetParams: [20, 0],
      accountId: 7,
    });

    const [rowsCall, countCall] = calls;

    // rowsParams = [...[](0), ...limitOffsetParams(2)] = 2 item ->
    // accountIdIndex = 2 + 1 = 3.
    expect(rowsCall.sql).toContain("$3");
    expect(rowsCall.params).toEqual([20, 0, 7]);

    // countParams = [...[](0), accountId] = 1 item -> accountIdIndex = 1.
    expect(countCall.sql).toContain("$1");
    expect(countCall.params).toEqual([7]);
  });
});
