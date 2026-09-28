import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";
import { syncCashflow, SyncCashflowPartialError, type SyncCashflowResult } from "./cashflow";
import { syncAll, type SyncAllInput } from "./sync-all";

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("./cashflow", async () => {
  const actual = await vi.importActual<typeof import("./cashflow")>("./cashflow");
  return {
    ...actual,
    syncCashflow: vi.fn(),
  };
});

/**
 * `syncAll` diuji lewat mock modul (bukan fake DB in-memory seperti
 * `apply-debt-transaction.test.ts`) karena yang diuji di sini BUKAN SQL
 * `syncAll` sendiri (dia tidak menulis apa pun langsung), tapi
 * ORKESTRASI-nya: rollback saat `syncCashflow` gagal di tengah jalan
 * (lewat `SyncCashflowPartialError`), dan yang terpenting — LOCK
 * in-memory yang mencegah dua panggilan `syncAll()` konkuren saling
 * menimpa (root cause bug live "UNIQUE constraint failed:
 * transactions.source, transactions.source_ref", lihat handover
 * 2026-09-23).
 *
 * BEDA dari versi lama (`syncCashflow` + `syncArAp` dua panggilan
 * terpisah, `sync-ar-ap.ts` DIHAPUS): sekarang `syncCashflow` SATU-
 * SATUNYA panggilan (mencakup cashflow DAN AR/AP sekaligus, lihat
 * docs/todos/plan/retailku-ar-ap-via-cashflow-detail.md), jadi test
 * rollback di sini menguji `SyncCashflowPartialError` (dilempar
 * `syncCashflow` sendiri saat insert gagal di tengah loop), bukan lagi
 * "AR/AP gagal setelah cashflow sukses" seperti sebelumnya.
 */

const baseInput: SyncAllInput = {
  mcpConfig: { mcpUrl: "https://mcp.example", apiKey: "key" } as SyncAllInput["mcpConfig"],
  arApCashAccountId: 1,
  receivableDebtAccountId: 2,
  payableDebtAccountId: 3,
  dateFrom: "2026-01-01",
  dateTo: "2026-01-31",
  timezone: "Asia/Jakarta",
  mode: "summary",
};

const emptyCashflowResult: SyncCashflowResult = {
  insertedCount: 0,
  insertedSourceRefs: [],
  unmappedKeys: [],
  deactivatedPaymentMethodAccountIds: [],
  arApInsertedCount: 0,
  arApAccountNotConfigured: false,
};

/** Promise yang bisa "ditahan" lalu diselesaikan manual dari test —
 * dipakai untuk mengontrol timing dua panggilan `syncAll()` supaya bisa
 * dibuktikan mereka TIDAK overlap (serial), bukan cuma "kebetulan tidak
 * overlap" karena keduanya sama-sama cepat resolve. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("syncAll", () => {
  beforeEach(() => {
    vi.mocked(getDb).mockResolvedValue({} as Awaited<ReturnType<typeof getDb>>);
    vi.mocked(syncCashflow).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("menjalankan syncCashflow dan mengembalikan hasil gabungan cashflow+AR/AP", async () => {
    vi.mocked(syncCashflow).mockResolvedValue({
      ...emptyCashflowResult,
      insertedCount: 3,
      arApInsertedCount: 1,
      insertedSourceRefs: ["a", "b", "c"],
    });

    const result = await syncAll(baseInput);

    expect(result).toEqual({
      cashflowInsertedCount: 2,
      cashflowUnmappedKeys: [],
      cashflowDeactivatedPaymentMethodAccountIds: [],
      arApInsertedCount: 1,
      arApAccountNotConfigured: false,
    });
  });

  it("rollback manual (DELETE debts+transactions) saat syncCashflow gagal di tengah jalan", async () => {
    vi.mocked(syncCashflow).mockRejectedValue(
      new SyncCashflowPartialError(["2026-01-01:acc1"], new Error("MCP timeout"))
    );

    const db = { execute: vi.fn().mockResolvedValue({}), select: vi.fn() };
    vi.mocked(getDb).mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    await expect(syncAll(baseInput)).rejects.toThrow("MCP timeout");

    // DELETE debts lalu DELETE transactions untuk source_ref yang sudah
    // sempat ter-insert sebelum kegagalan.
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM debts"),
      ["2026-01-01:acc1"]
    );
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM transactions"),
      ["2026-01-01:acc1"]
    );
  });

  it("TIDAK rollback (tidak ada DELETE) kalau error BUKAN SyncCashflowPartialError (gagal sebelum insert apa pun)", async () => {
    vi.mocked(syncCashflow).mockRejectedValue(new Error("gagal konek MCP"));

    const db = { execute: vi.fn().mockResolvedValue({}), select: vi.fn() };
    vi.mocked(getDb).mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    await expect(syncAll(baseInput)).rejects.toThrow("gagal konek MCP");

    expect(db.execute).not.toHaveBeenCalled();
  });

  it("DUA panggilan konkuren TIDAK saling overlap — panggilan kedua menunggu yang pertama selesai (regresi race condition)", async () => {
    const first = deferred<void>();
    const second = deferred<void>();
    const activeRuns: number[] = [];
    let concurrentCount = 0;
    let maxConcurrent = 0;

    vi.mocked(syncCashflow).mockImplementation(async () => {
      concurrentCount++;
      maxConcurrent = Math.max(maxConcurrent, concurrentCount);
      activeRuns.push(concurrentCount);

      // Panggilan pertama ditahan sampai `first.resolve()` dipanggil
      // eksplisit dari test, mensimulasikan MCP fetch yang lambat —
      // kalau lock TIDAK bekerja, panggilan kedua akan mulai DI SINI,
      // sebelum yang pertama selesai.
      if (concurrentCount === 1) await first.promise;
      else await second.promise;

      concurrentCount--;
      return { ...emptyCashflowResult };
    });

    const call1 = syncAll(baseInput);
    // Beri microtask queue kesempatan jalan supaya call1 sungguh masuk
    // ke syncCashflow (dan tertahan di `first.promise`) sebelum call2
    // dikirim — meniru dua trigger nyata (auto-sync + manual) yang tidak
    // datang di tick JS yang sama persis.
    await Promise.resolve();
    await Promise.resolve();

    const call2 = syncAll(baseInput);

    // Panggilan kedua BELUM mulai (belum menambah concurrentCount)
    // selama panggilan pertama masih tertahan — buktikan dengan resolve
    // panggilan pertama SETELAH jeda, lalu cek urutan baru masuk.
    await Promise.resolve();
    expect(maxConcurrent).toBe(1); // baru satu yang pernah berjalan sejauh ini

    first.resolve();
    await Promise.resolve();
    await Promise.resolve();
    second.resolve();

    await Promise.all([call1, call2]);

    expect(maxConcurrent).toBe(1); // tidak pernah ada 2 yang berjalan BERSAMAAN
    expect(activeRuns).toEqual([1, 1]); // masing-masing mulai dari concurrentCount 1, bukan 2
  });

  it("kalau panggilan pertama GAGAL, lock tetap terlepas — panggilan kedua tidak ikut macet/reject", async () => {
    vi.mocked(syncCashflow)
      .mockRejectedValueOnce(new Error("sync pertama gagal"))
      .mockResolvedValueOnce({ ...emptyCashflowResult, insertedCount: 5, insertedSourceRefs: [] });

    const db = { execute: vi.fn().mockResolvedValue({}), select: vi.fn() };
    vi.mocked(getDb).mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    const call1 = syncAll(baseInput);
    const call2 = syncAll(baseInput);

    await expect(call1).rejects.toThrow("sync pertama gagal");
    const result2 = await call2;

    expect(result2.cashflowInsertedCount).toBe(5);
  });
});
