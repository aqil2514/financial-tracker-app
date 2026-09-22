import { getDb } from "@/lib/db";
import { connectRetailkuMcp, getCashflowDetail, type RetailkuMcpConfig } from "@/shared/retailku";
import type { RetailkuCashflowSyncMode } from "./use-retailku-cashflow-sync-settings";

type Db = Awaited<ReturnType<typeof getDb>>;

export type SyncCashflowInput = {
  mcpConfig: RetailkuMcpConfig;
  /** Tanggal ISO inklusif, lihat "Pertanyaan terbuka #1". */
  dateFrom: string;
  dateTo: string;
  timezone: string;
  mode: RetailkuCashflowSyncMode;
};

export type SyncCashflowResult = {
  /** Berapa baris transaksi baru yang berhasil di-insert (tanggal/baris
   * yang sudah pernah tersinkron sebelumnya di-skip, TIDAK dihitung). */
  insertedCount: number;
  /** `source_ref` dari SEMUA baris yang berhasil di-insert sync ini —
   * dipakai `sync-all.ts` untuk ROLLBACK MANUAL (DELETE) kalau jalur
   * AR/AP gagal setelah cashflow sukses, lihat "Keterkaitan dengan sync
   * utang-piutang" (@tauri-apps/plugin-sql tidak mendukung BEGIN/COMMIT
   * lintas-panggilan dengan aman — connection pool, bukan 1 koneksi). */
  insertedSourceRefs: string[];
  /** `accountId` Retailku yang muncul di data TAPI belum ada baris
   * `retailku_account_mapping` untuknya — di-skip, TIDAK menggagalkan
   * seluruh sync (lihat keputusan #2 revisi). */
  unmappedAccountIds: string[];
};

/** Satu baris cashflow yang AKAN diproses — hasil `computeCashflowSync`,
 * dipakai baik untuk insert sungguhan (`syncCashflow`) maupun preview
 * (baca-saja, lihat use-preview-sync.ts). `willInsert: false` berarti
 * baris ini di-skip (net nol, sudah pernah tersinkron, atau akunnya
 * belum dipetakan) — preview tetap menampilkannya supaya user tahu APA
 * yang di-skip dan KENAPA, bukan cuma total yang akan masuk. */
export type CashflowSyncPlanRow = {
  date: string;
  retailkuAccountId: string;
  accountName: string;
  net: number;
  note: string;
  sourceRef: string;
  willInsert: boolean;
  skipReason: "already-synced" | "unmapped-account" | null;
  localAccountId: number | null;
};

export type CashflowSyncPlan = {
  rows: CashflowSyncPlanRow[];
  unmappedAccountIds: string[];
};

/**
 * Hitung APA yang akan disinkronkan (fetch MCP + agregasi + cek
 * mapping/idempotency) TANPA menulis apa pun ke database — dipakai
 * BAIK oleh `syncCashflow` (lanjut insert) MAUPUN oleh preview
 * (`use-preview-sync.ts`, baca-saja). Dipisah dari `syncCashflow`
 * supaya preview tidak perlu insert+rollback cuma untuk menghitung
 * hasilnya lebih dulu.
 */
export async function computeCashflowSync(
  db: Db,
  input: Pick<SyncCashflowInput, "mcpConfig" | "dateFrom" | "dateTo" | "timezone" | "mode">
): Promise<CashflowSyncPlan> {
  const client = await connectRetailkuMcp(input.mcpConfig);
  try {
    const rows = await fetchAllCashflowDetailRows(client, input);
    const accountMap = await loadAccountMapping(db);

    const totals =
      input.mode === "summary"
        ? aggregateByDateAndAccount(rows)
        : aggregateByDateAccountAndSourceType(rows);

    const planRows: CashflowSyncPlanRow[] = [];
    const unmappedAccountIds = new Set<string>();

    for (const total of totals) {
      if (total.net === 0) continue;

      const localAccountId = accountMap.get(total.retailkuAccountId) ?? null;
      if (localAccountId == null) {
        unmappedAccountIds.add(total.retailkuAccountId);
        planRows.push({ ...total, willInsert: false, skipReason: "unmapped-account", localAccountId: null });
        continue;
      }

      const alreadySynced = await isSourceRefSynced(db, total.sourceRef);
      if (alreadySynced) {
        planRows.push({ ...total, willInsert: false, skipReason: "already-synced", localAccountId });
        continue;
      }

      planRows.push({ ...total, willInsert: true, skipReason: null, localAccountId });
    }

    return { rows: planRows, unmappedAccountIds: [...unmappedAccountIds] };
  } finally {
    await client.close();
  }
}

/**
 * Sinkronisasi cashflow Retailku -> transaksi lokal, lihat
 * docs/todos/plan/retailku-cashflow-sync.md keputusan #1 (idempotency),
 * #2 REVISI (per akun kas Retailku sendiri-sendiri, BUKAN konvergen ke
 * satu akun lokal) dan #6 (mode ringkas/detail). SUMBER DATA SEKARANG
 * SELALU `get_cashflow_detail` (punya `accountId` per baris) — TIDAK
 * LAGI memakai `get_cashflow_summary` sama sekali, bahkan untuk mode
 * ringkas, karena tool itu tidak punya breakdown per akun.
 *
 * TIDAK dibungkus BEGIN/COMMIT SQL (lihat "Bug ditemukan live" di
 * retailku-cashflow-sync.md — @tauri-apps/plugin-sql tidak mendukung
 * itu dengan aman) — caller (`sync-all.ts`) melakukan rollback MANUAL
 * (DELETE) berdasar `insertedSourceRefs` yang dikembalikan di sini kalau
 * jalur lain gagal.
 *
 * Logic fetch+agregasi+cek mapping/idempotency ada di
 * `computeCashflowSync` — fungsi ini tinggal INSERT baris yang
 * `willInsert: true`.
 */
export async function syncCashflow(db: Db, input: SyncCashflowInput): Promise<SyncCashflowResult> {
  const plan = await computeCashflowSync(db, input);

  const insertedSourceRefs: string[] = [];
  for (const row of plan.rows) {
    if (!row.willInsert || row.localAccountId == null) continue;
    await insertCashflowTransaction(db, {
      accountId: row.localAccountId,
      amount: row.net,
      date: row.date,
      note: row.note,
      sourceRef: row.sourceRef,
    });
    insertedSourceRefs.push(row.sourceRef);
  }

  return {
    insertedCount: insertedSourceRefs.length,
    insertedSourceRefs,
    unmappedAccountIds: plan.unmappedAccountIds,
  };
}

async function fetchAllCashflowDetailRows(
  client: Awaited<ReturnType<typeof connectRetailkuMcp>>,
  input: Pick<SyncCashflowInput, "dateFrom" | "dateTo" | "timezone">
) {
  const rows: Awaited<ReturnType<typeof getCashflowDetail>>["data"] = [];
  let page = 1;
  const limit = 100;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await getCashflowDetail(client, {
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      timezone: input.timezone,
      page,
      limit,
    });
    rows.push(...result.data);
    if (page >= result.meta.pagination.totalPages) break;
    page += 1;
  }
  return rows;
}

async function loadAccountMapping(db: Db): Promise<Map<string, number>> {
  const rows = await db.select<{ retailku_account_id: string; local_account_id: number }[]>(
    "SELECT retailku_account_id, local_account_id FROM retailku_account_mapping"
  );
  return new Map(rows.map((row) => [row.retailku_account_id, row.local_account_id]));
}

type AggregatedTotal = {
  date: string;
  retailkuAccountId: string;
  accountName: string;
  net: number;
  note: string;
  sourceRef: string;
};

function aggregateByDateAndAccount(
  rows: Awaited<ReturnType<typeof getCashflowDetail>>["data"]
): AggregatedTotal[] {
  const totals = new Map<string, AggregatedTotal>();
  for (const row of rows) {
    const date = row.date.slice(0, 10);
    const key = `${date}:${row.accountId}`;
    const existing = totals.get(key);
    const net = row.debit - row.credit;
    totals.set(key, {
      date,
      retailkuAccountId: row.accountId,
      accountName: row.accountName,
      net: (existing?.net ?? 0) + net,
      note: `Ringkasan Kas Harian Retailku — ${row.accountName}`,
      sourceRef: key,
    });
  }
  return [...totals.values()];
}

function aggregateByDateAccountAndSourceType(
  rows: Awaited<ReturnType<typeof getCashflowDetail>>["data"]
): AggregatedTotal[] {
  const totals = new Map<string, AggregatedTotal & { sourceType: string }>();
  for (const row of rows) {
    const date = row.date.slice(0, 10);
    const sourceType = row.sourceType ?? "LAINNYA";
    const key = `${date}:${row.accountId}:${sourceType}`;
    const existing = totals.get(key);
    const net = row.debit - row.credit;
    totals.set(key, {
      date,
      retailkuAccountId: row.accountId,
      accountName: row.accountName,
      sourceType,
      net: (existing?.net ?? 0) + net,
      note: `Kas Harian Retailku — ${row.accountName} — ${sourceType}`,
      sourceRef: key,
    });
  }
  return [...totals.values()];
}

async function isSourceRefSynced(db: Db, sourceRef: string): Promise<boolean> {
  const rows = await db.select<{ found: number }[]>(
    "SELECT 1 AS found FROM transactions WHERE source = 'retailku_sync' AND source_ref = $1 LIMIT 1",
    [sourceRef]
  );
  return rows.length > 0;
}

async function insertCashflowTransaction(
  db: Db,
  params: { accountId: number; amount: number; date: string; note: string; sourceRef: string }
): Promise<void> {
  const type = params.amount >= 0 ? "income" : "expense";
  await db.execute(
    `INSERT INTO transactions (type, amount, account_id, note, date, source, source_ref)
     VALUES ($1, $2, $3, $4, $5, 'retailku_sync', $6)`,
    // `params.date` cuma "YYYY-MM-DD" (dipakai APA ADANYA untuk
    // sourceRef/tampilan preview) — kolom `transactions.date` HARUS
    // "YYYY-MM-DDTHH:mm" (lihat form-field-date.tsx: <input
    // type="datetime-local">, use-create-transaction.ts men-simpan
    // dengan format sama). Tanpa "T00:00" ini, form Edit Transaksi
    // membaca value tidak valid untuk datetime-local dan field Tanggal
    // tampil KOSONG (bug ditemukan live).
    [type, Math.abs(params.amount), params.accountId, params.note, `${params.date}T00:00`, params.sourceRef]
  );
}
