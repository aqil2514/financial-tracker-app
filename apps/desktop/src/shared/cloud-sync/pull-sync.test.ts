import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";
import { applySyncResponse } from "./pull-sync";
import type { SyncResponse } from "./worker-client";

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(),
}));

/** Fake DB in-memory generik -- berbeda dari pola di
 * apply-debt-transaction.test.ts (yang menyimulasikan hasil query spesifik
 * per fungsi) karena yang diuji di sini BUKAN behaviour LWW/SQL per tabel
 * (itu sudah diverifikasi manual terhadap SQLite asli), tapi REGRESI
 * spesifik: "setiap koleksi non-kosong di `SyncResponse` benar-benar
 * disalurkan ke tabel yang sesuai" -- itu yang luput saat 3 tabel
 * investment ditambahkan ke Worker tapi terlupa di sisi pull desktop
 * (lihat docs/dogfooding/). `execute`/`select` hanya mencatat nama tabel
 * yang disentuh dari teks SQL, tidak benar-benar menjalankan apa pun. */
function createTableTrackingDb() {
  const touchedTables = new Set<string>();
  // Catatan: TIDAK match `UPDATE` begitu saja -- semua upsert di
  // pull-sync.ts pakai `INSERT ... ON CONFLICT DO UPDATE SET ...`, jadi
  // `UPDATE\s+(\w+)` akan salah menangkap kata `SET` sendiri (dari "DO
  // UPDATE SET"), bukan nama tabel. `DELETE FROM`/`INSERT INTO`/
  // `SELECT ... FROM` sudah cukup -- satu-satunya `UPDATE <table>` murni
  // (bukan dalam ON CONFLICT) di pull-sync.ts tidak pernah terjadi.
  const FROM_OR_INTO = /(?:FROM|INTO)\s+([a-z_]+)/gi;

  function recordTables(sql: string) {
    for (const match of sql.matchAll(FROM_OR_INTO)) {
      touchedTables.add(match[1]);
    }
  }

  const db = {
    select: vi.fn(async (sql: string) => {
      recordTables(sql);
      // Selalu "belum ada lokal" -> applyRow/applyInvestmentAccountRow
      // menganggap baris incoming menang (wins()), lanjut ke upsert --
      // supaya tiap baris non-deleted benar-benar memanggil db.execute.
      return [];
    }),
    execute: vi.fn(async (sql: string) => {
      recordTables(sql);
    }),
  };

  return { db, touchedTables };
}

function row(overrides: Partial<{ id: string; updatedAt: string | null; deletedAt: string | null }> = {}) {
  return { id: "id-1", updatedAt: "2026-10-10 00:00:00", deletedAt: null, ...overrides };
}

function emptySyncResponse(): SyncResponse {
  return {
    checkpoint: "2026-10-10T00:00:00.000Z",
    accountGroups: [],
    categories: [],
    contacts: [],
    accounts: [],
    transactions: [],
    debts: [],
    debtPayments: [],
    investmentAccounts: [],
    investmentPurchases: [],
    investmentSales: [],
    labels: [],
    transactionLabels: [],
    categoryLabels: [],
    accountLabels: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("applySyncResponse", () => {
  it("menerapkan SEMUA 15 koleksi SyncResponse ke tabel lokalnya -- regresi investment_* yang dulu terlupa", async () => {
    const { db, touchedTables } = createTableTrackingDb();
    vi.mocked(getDb).mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    const response: SyncResponse = {
      ...emptySyncResponse(),
      accountGroups: [{ ...row({ id: "ag1" }), name: "Grup" }],
      categories: [
        { ...row({ id: "c1" }), name: "Kategori", icon: null, type: "expense", parentId: null, isActive: true },
      ],
      contacts: [{ ...row({ id: "ct1" }), name: "Kontak", note: null }],
      accounts: [
        {
          ...row({ id: "a1" }),
          name: "Akun",
          icon: null,
          initialBalance: 0,
          groupId: null,
          description: null,
          isActive: true,
          accountType: "cash",
          color: null,
        },
      ],
      transactions: [
        {
          ...row({ id: "t1" }),
          type: "transfer",
          amount: 10000,
          categoryId: null,
          accountId: "a1",
          transferAccountId: "a2",
          note: "Investasi RDPU",
          date: "2026-10-10T18:24",
          description: null,
          contactId: null,
          source: "manual",
          sourceRef: null,
        },
      ],
      debts: [
        {
          ...row({ id: "d1" }),
          type: "payable",
          contactId: null,
          amount: 1000,
          accountId: "a1",
          transactionId: "t1",
          status: "ongoing",
          note: null,
          date: "2026-10-10",
          source: "manual",
          sourceRef: null,
        },
      ],
      debtPayments: [
        {
          ...row({ id: "dp1" }),
          debtId: "d1",
          amount: 1000,
          accountId: "a1",
          transactionId: "t1",
          note: null,
          date: "2026-10-10",
          source: "manual",
          sourceRef: null,
        },
      ],
      // investment_accounts BUKAN SyncRow (PK-nya account_id, bukan id) --
      // lihat komentar di worker-client.ts.
      investmentAccounts: [
        {
          accountId: "a2",
          unitLabel: "Unit",
          currentMarketValue: 2302308,
          updatedAt: "2026-10-10 00:00:00",
          deletedAt: null,
        },
      ],
      investmentPurchases: [
        {
          ...row({ id: "ip1" }),
          accountId: "a2",
          transactionId: "t1",
          unit: null,
          pricePerUnit: null,
          date: "2026-10-10T18:24",
          status: "pending",
        },
      ],
      investmentSales: [
        {
          ...row({ id: "is1" }),
          accountId: "a2",
          transactionId: "t1",
          adjustmentTransactionId: null,
          unit: 20,
          pricePerUnit: 16000,
          averageCostPerUnit: 15000,
          realizedPl: 20000,
          date: "2026-10-03",
          status: "settled",
        },
      ],
      labels: [{ ...row({ id: "l1" }), name: "Label", scope: "transaction_category" }],
      transactionLabels: [{ ...row({ id: "tl1" }), transactionId: "t1", labelId: "l1" }],
      categoryLabels: [{ ...row({ id: "cl1" }), categoryId: "c1", labelId: "l1" }],
      accountLabels: [{ ...row({ id: "al1" }), accountId: "a1", labelId: "l1" }],
    };

    await applySyncResponse(response);

    // Setiap tabel yang punya baris non-kosong di atas HARUS tersentuh --
    // kalau ada koleksi yang diam-diam terlupa di applySyncResponse (sama
    // seperti bug investment_* kemarin), assertion ini gagal.
    expect(touchedTables).toEqual(
      new Set([
        "account_groups",
        "categories",
        "contacts",
        "accounts",
        "transactions",
        "debts",
        "debt_payments",
        "investment_accounts",
        "investment_purchases",
        "investment_sales",
        "labels",
        "transaction_labels",
        "category_labels",
        "account_labels",
      ])
    );
  });

  it("koleksi kosong tidak menyentuh tabelnya sama sekali (sanity check utk test di atas)", async () => {
    const { db, touchedTables } = createTableTrackingDb();
    vi.mocked(getDb).mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);

    await applySyncResponse(emptySyncResponse());

    expect(touchedTables.size).toBe(0);
  });
});
