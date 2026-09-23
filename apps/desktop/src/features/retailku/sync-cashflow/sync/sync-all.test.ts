import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";
import { syncCashflow, type SyncCashflowResult } from "./cashflow";
import { rollbackArApSnapshots, syncArAp, type SyncArApResult } from "./sync-ar-ap";
import { syncAll, type SyncAllInput } from "./sync-all";

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("./cashflow", () => ({
  syncCashflow: vi.fn(),
}));

vi.mock("./sync-ar-ap", () => ({
  syncArAp: vi.fn(),
  rollbackArApSnapshots: vi.fn(),
}));

/**
 * `syncAll` diuji lewat mock modul (bukan fake DB in-memory seperti
 * `apply-debt-transaction.test.ts`) karena yang diuji di sini BUKAN SQL
 * `syncAll` sendiri (dia tidak menulis apa pun langsung), tapi
 * ORKESTRASI-nya: urutan cashflow->AR/AP, rollback all-or-nothing saat
 * salah satu gagal, dan yang terpenting — LOCK in-memory yang mencegah
 * dua panggilan `syncAll()` konkuren saling menimpa (root cause bug live
 * "UNIQUE constraint failed: transactions.source, transactions.source_ref",
 * lihat handover 2026-09-23).
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
  unmappedAccountIds: [],
  deactivatedPaymentMethodAccountIds: [],
};

const emptyArApResult: SyncArApResult = {
  insertedCount: 0,
  insertedSourceRefs: [],
  touchedPartyIds: [],
  previousSnapshotsById: new Map(),
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
    vi.mocked(syncArAp).mockReset();
    vi.mocked(rollbackArApSnapshots).mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("menjalankan cashflow lalu AR/AP secara berurutan dan mengembalikan hasil gabungan", async () => {
    const order: string[] = [];
    vi.mocked(syncCashflow).mockImplementation(async () => {
      order.push("cashflow");
      return { ...emptyCashflowResult, insertedCount: 2, insertedSourceRefs: ["a", "b"] };
    });
    vi.mocked(syncArAp).mockImplementation(async () => {
      order.push("ar-ap");
      return { ...emptyArApResult, insertedCount: 1, insertedSourceRefs: ["c"] };
    });

    const result = await syncAll(baseInput);

    expect(order).toEqual(["cashflow", "ar-ap"]);
    expect(result).toEqual({
      cashflowInsertedCount: 2,
      cashflowUnmappedAccountIds: [],
      cashflowDeactivatedPaymentMethodAccountIds: [],
      arApInsertedCount: 1,
    });
  });

  it("rollback manual (DELETE source_ref + restore snapshot) saat AR/AP gagal setelah cashflow sukses", async () => {
    vi.mocked(syncCashflow).mockResolvedValue({
      ...emptyCashflowResult,
      insertedCount: 1,
      insertedSourceRefs: ["2026-01-01:acc1"],
    });
    vi.mocked(syncArAp).mockRejectedValue(new Error("MCP timeout"));

    const db = { execute: vi.fn().mockResolvedValue({}), select: vi.fn() };
    vi.mocked(getDb).mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    await expect(syncAll(baseInput)).rejects.toThrow("MCP timeout");

    // DELETE debts lalu DELETE transactions untuk source_ref yang sudah
    // sempat ter-insert oleh cashflow, meski AR/AP-nya sendiri gagal.
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM debts"),
      ["2026-01-01:acc1"]
    );
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM transactions"),
      ["2026-01-01:acc1"]
    );
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
    vi.mocked(syncArAp).mockResolvedValue({ ...emptyArApResult });

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
    vi.mocked(syncArAp).mockResolvedValue({ ...emptyArApResult });

    const db = { execute: vi.fn().mockResolvedValue({}), select: vi.fn() };
    vi.mocked(getDb).mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    const call1 = syncAll(baseInput);
    const call2 = syncAll(baseInput);

    await expect(call1).rejects.toThrow("sync pertama gagal");
    const result2 = await call2;

    expect(result2.cashflowInsertedCount).toBe(5);
  });
});
