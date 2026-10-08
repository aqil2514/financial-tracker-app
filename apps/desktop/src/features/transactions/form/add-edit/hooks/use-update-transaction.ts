"use client";

import { getDb, type Account, type Transaction } from "@/lib/db";
import { useEntityForm } from "@/components/forms/hooks/use-entity-form";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import { isEmptyDoc } from "@/components/rich-text";
import { useContacts } from "@/shared/contacts/use-contacts";
import { resolveContactId } from "@/shared/contacts/resolve-contact";
import { useTransactionDebtStatus } from "@/shared/debts/use-transaction-debt-status";
import { applyDebtTransactionEdit } from "@/shared/debts/apply-debt-transaction";
import { classifyAccountPair } from "@/shared/debts/classify-account-pair";
import { applyInvestmentTransactionEdit } from "@/shared/investments/apply-investment-transaction";
import {
  applySellInvestmentTransactionEdit,
  InsufficientInvestmentUnitsError,
} from "@/shared/investments/apply-sell-investment-transaction";
import {
  applyWriteOffInvestmentTransactionEdit,
  getTransactionWriteOff,
} from "@/shared/investments/apply-write-off-investment-transaction";
import { getAverageCostPerUnit, getRemainingUnit } from "@/shared/investments/investment-holding-math";
import { useTransactionInvestmentPurchase } from "@/shared/investments/use-transaction-investment-purchase";
import { useTransactionInvestmentSale } from "@/shared/investments/use-transaction-investment-sale";
import { transactionSchema, type TransactionFormOutput } from "../schema";
import { pushOnWrite, pushDeleteOnWrite } from "@/shared/cloud-sync/push-on-write";

type Db = Awaited<ReturnType<typeof getDb>>;

async function getAccountType(db: Db, accountId: string): Promise<Account["account_type"] | null> {
  const rows = await db.select<Pick<Account, "account_type">[]>(
    "SELECT account_type FROM accounts WHERE id = $1",
    [accountId]
  );
  return rows[0]?.account_type ?? null;
}

type UseUpdateTransactionOptions = {
  /** Dialog terbuka atau tidak — datang dari context, dipakai untuk
   * resetOnOpen. */
  open: boolean;
  /** Dipanggil setelah transaksi berhasil diperbarui — dipakai pemanggil
   * untuk menutup dialog dari context. Edit tidak punya "Simpan & Lanjut",
   * jadi ini selalu dipanggil setelah submit sukses. */
  onClosed?: () => void;
};

export function useUpdateTransaction(
  transaction: Transaction,
  { open, onClosed }: UseUpdateTransactionOptions
) {
  const { data: contacts } = useContacts();
  const contactName =
    contacts?.find((contact) => contact.id === transaction.contact_id)?.name ?? null;
  const { data: debtStatus } = useTransactionDebtStatus(transaction.id);
  const { data: investmentPurchase } = useTransactionInvestmentPurchase(transaction.id);
  // Transaksi transfer cuma bisa berperan sebagai SALAH SATU: pembelian
  // (investment_purchases) ATAU penjualan (investment_sales), tidak
  // pernah dua-duanya -- query sale ini cuma relevan kalau investmentPurchase
  // null (lihat prefill unit/price_per_unit/investment_status di bawah).
  const { data: investmentSale } = useTransactionInvestmentSale(transaction.id);

  return useEntityForm({
    schema: transactionSchema,
    defaultValues: () => ({
      type: transaction.type,
      amount: transaction.amount,
      account_id: transaction.account_id != null ? String(transaction.account_id) : "",
      category_id:
        transaction.category_id != null ? String(transaction.category_id) : null,
      transfer_account_id:
        transaction.transfer_account_id != null
          ? String(transaction.transfer_account_id)
          : null,
      note: transaction.note ?? "",
      description: transaction.description ? JSON.parse(transaction.description) : null,
      date: transaction.date,
      contact_name: contactName,
      // Reset ke kosong (bukan direkonstruksi dari debt_payments lama) —
      // lihat "Edit transaksi yang sudah py debts terkait" di
      // debt-receivable-tracking.md. Kalau field berbahaya diedit ulang
      // pada transaksi yang berperan sebagai pelunasan, user WAJIB pilih
      // ulang aksinya dari awal (transaction-form.tsx yang menampilkan
      // DebtActionField begitu terdeteksi perlu).
      debt_action: null,
      settle_debt_ids: [],
      unit: investmentPurchase?.unit ?? investmentSale?.unit ?? null,
      price_per_unit: investmentPurchase?.price_per_unit ?? investmentSale?.price_per_unit ?? null,
      investment_status: investmentPurchase?.status ?? investmentSale?.status ?? "pending",
    }),
    open,
    resetOnOpen: true,
    mutationFn: async (values: TransactionFormOutput) => {
      const contactId = await resolveContactId(values.contact_name);

      const db = await getDb();
      const accountId = values.account_id;
      const transferAccountId =
        values.type === "transfer" ? values.transfer_account_id : null;

      // Deteksi arah investment SEBELUM update -- pola sama
      // use-create-transaction.ts. Untuk arah jual (investment->cash),
      // nominal yang di-UPDATE ke transactions.amount BUKAN values.amount
      // (field itu dikunci read-only di form.tsx, cuma preview) tapi
      // average_cost * unit SAAT INI -- dihitung ulang di titik edit ini
      // (bukan dipakai dari nilai lama) karena average cost bisa sudah
      // berubah sejak transaksi jual ini pertama dibuat (pembelian baru
      // masuk, dst). Lihat docs/concept/konsep-investasi.md "Efek ke
      // accounts.balance".
      let isInvestmentSell = false;
      let amount = values.amount;
      if (values.type === "transfer" && transferAccountId != null) {
        const [sourceType, destinationType] = await Promise.all([
          getAccountType(db, accountId),
          getAccountType(db, transferAccountId),
        ]);
        if (sourceType != null && destinationType != null) {
          try {
            isInvestmentSell = classifyAccountPair(sourceType, destinationType) === "investment-cash";
          } catch {
            // UnsupportedAccountPairError -- bukan kombinasi investment, no-op.
          }
        }
      }
      if (isInvestmentSell && values.unit != null) {
        // Validasi oversell SEBELUM update baris transactions -- pola
        // sama use-create-transaction.ts. Beda dari create: kalau
        // transaksi ini SEBELUMNYA juga arah jual (investmentSale != null),
        // unit lamanya ditambahkan balik ke remainingUnit dulu sebelum
        // dibandingkan -- applySellInvestmentTransactionEdit SENDIRI
        // menghapus baris investment_sales lama sebelum menghitung ulang
        // (lihat deleteInvestmentSaleAndAdjustment), jadi pre-check ini
        // HARUS meniru urutan yang sama supaya tidak salah menolak unit
        // yang sebenarnya valid (mis. user cuma menambah 1 unit dari
        // transaksi jual yang sudah ada).
        const [averageCost, remainingUnitRaw] = await Promise.all([
          getAverageCostPerUnit(db, accountId),
          getRemainingUnit(db, accountId),
        ]);
        const remainingUnit = remainingUnitRaw + (investmentSale?.unit ?? 0);
        if (values.unit > remainingUnit) {
          throw new InsufficientInvestmentUnitsError(remainingUnit, values.unit);
        }
        amount = averageCost * values.unit;
      }

      // Write-off investasi (income/expense LANGSUNG pada akun investment,
      // tanpa transfer_account_id -- lihat konsep-investasi.md "Unit yang
      // berubah TANPA transfer kas", arah berkurang) BUKAN jalur
      // isInvestmentSell di atas (itu khusus transfer investment->cash) --
      // dideteksi terpisah dari baris investment_sales dengan
      // price_per_unit = 0 (lihat getTransactionWriteOffSale). amount
      // SAMA prinsipnya dgn jual: BUKAN values.amount dari form (field itu
      // bahkan tidak muncul sama sekali di form utama untuk income/expense,
      // lihat use-transaction-investment-fields.ts), dihitung ulang dari
      // averageCost x unit SAAT INI. unit sendiri TIDAK bisa diubah lewat
      // form utama (field unit/harga tersembunyi untuk kasus ini) -- unit
      // LAMA baris ini dipakai apa adanya, cuma amount yang mungkin
      // bergeser kalau average cost berubah sejak write-off ini dibuat.
      const writeOffSale = await getTransactionWriteOff(db, transaction.id);
      const isWriteOff = writeOffSale != null;
      if (isWriteOff) {
        amount = await getAverageCostPerUnit(db, accountId).then((cost) => cost * writeOffSale.unit);
      }

      // Field yang mempengaruhi PERHITUNGAN debt — kalau salah satu
      // berubah dari nilai semula, debt/debt_payment terkait (kalau ada)
      // perlu di-recreate dari nilai baru (atau diblokir, tergantung
      // status — lihat applyDebtTransactionEdit). Field lain (note,
      // description, lampiran) tidak pernah mempengaruhi debt sama
      // sekali, jadi tidak perlu dibandingkan.
      const dangerousFieldsChanged =
        values.type !== transaction.type ||
        accountId !== transaction.account_id ||
        transferAccountId !== transaction.transfer_account_id ||
        amount !== transaction.amount ||
        contactId !== transaction.contact_id;

      await db.execute(
        `UPDATE transactions
         SET type = $1, amount = $2, category_id = $3, account_id = $4, transfer_account_id = $5, note = $6, description = $7, date = $8, contact_id = $9
         WHERE id = $10`,
        [
          values.type,
          amount,
          values.type === "transfer" || !values.category_id
            ? null
            : values.category_id,
          accountId,
          transferAccountId,
          values.note,
          isEmptyDoc(values.description) ? null : JSON.stringify(values.description),
          values.date,
          contactId,
          transaction.id,
        ]
      );

      // debtStatus HARUS sudah termuat sebelum submit bisa terjadi — kalau
      // belum (query belum selesai), lebih aman menolak mutation daripada
      // diam-diam berasumsi role: "none" dan mem-bypass proteksi
      // "piutang sudah dicicil" di applyDebtTransactionEdit.
      if (debtStatus === undefined) {
        throw new Error("Status utang/piutang transaksi ini belum termuat, coba lagi.");
      }

      const touchedDebtRows = await applyDebtTransactionEdit({
        db,
        transactionId: transaction.id,
        type: values.type,
        accountId,
        transferAccountId,
        contactId,
        amount,
        date: values.date,
        debtAction: values.debt_action,
        settleDebtIds: values.settle_debt_ids,
        status: debtStatus,
        dangerousFieldsChanged,
      });

      let adjustmentTransactionId: string | null = null;
      let investmentPurchaseId: string | null = null;
      let deletedInvestmentPurchaseIds: string[] = [];
      let investmentSaleId: string | null = null;
      let deletedInvestmentSaleIds: string[] = [];
      if (isInvestmentSell) {
        // Form transaksi utama HANYA mendukung jual 'settled' (lihat
        // komentar sama di use-create-transaction.ts) -- transactionId
        // transaksi utama yang SEDANG diedit dioper sebagai leg transfer
        // utama (sudah ter-UPDATE di atas), applySellInvestmentTransactionEdit
        // yang mencari baris investment_sales lama lewat id itu.
        const touched = await applySellInvestmentTransactionEdit(transaction.id, {
          db,
          transactionId: transaction.id,
          accountId,
          transferAccountId,
          date: values.date,
          unit: values.unit as number,
          pricePerUnit: values.price_per_unit as number,
          status: "settled",
        });
        adjustmentTransactionId = touched.adjustmentTransactionId;
        investmentSaleId = touched.investmentSaleIds[0] ?? null;
        deletedInvestmentSaleIds = touched.deletedInvestmentSaleIds;
      } else if (isWriteOff) {
        // Beda tabel dari isInvestmentSell (investment_sales dgn
        // price_per_unit=0, bukan hasil transfer) -- lihat
        // apply-write-off-investment-transaction.ts. UPDATE in-place,
        // tidak ada leg kedua yang perlu diurus (adjustment_transaction_id
        // selalu NULL utk write-off).
        const touched = await applyWriteOffInvestmentTransactionEdit({
          db,
          transactionId: transaction.id,
          accountId,
          unit: writeOffSale.unit,
        });
        investmentSaleId = writeOffSale.id;
        void touched; // amount sudah dipakai di atas (sebelum UPDATE transactions)
      } else {
        const touched = await applyInvestmentTransactionEdit({
          db,
          transactionId: transaction.id,
          type: values.type,
          accountId,
          transferAccountId,
          date: values.date,
          unit: values.unit,
          pricePerUnit: values.price_per_unit,
          status: values.investment_status ?? "pending",
        });
        investmentPurchaseId = touched.investmentPurchaseIds[0] ?? null;
        deletedInvestmentPurchaseIds = touched.deletedInvestmentPurchaseIds;
      }

      // Sama alasan dgn use-create-transaction.ts -- await push
      // "transactions" dulu sebelum push baris turunan (FK ke
      // transactions(id)).
      await pushOnWrite("transactions", transaction.id);
      if (adjustmentTransactionId != null) void pushOnWrite("transactions", adjustmentTransactionId);
      if (investmentPurchaseId != null) void pushOnWrite("investment_purchases", investmentPurchaseId);
      if (investmentSaleId != null) void pushOnWrite("investment_sales", investmentSaleId);
      for (const debtId of touchedDebtRows.debtIds) void pushOnWrite("debts", debtId);
      for (const debtPaymentId of touchedDebtRows.debtPaymentIds) void pushOnWrite("debt_payments", debtPaymentId);
      // Id LAMA dari RECREATE (field berbahaya berubah) -- Worker tidak
      // pernah tahu id ini harus dihapus kalau cuma mengandalkan push
      // baris baru di atas, lihat komentar TouchedDebtRows.
      for (const debtId of touchedDebtRows.deletedDebtIds) void pushDeleteOnWrite("debts", debtId, {});
      for (const debtPaymentId of touchedDebtRows.deletedDebtPaymentIds)
        void pushDeleteOnWrite("debt_payments", debtPaymentId, {});
      for (const purchaseId of deletedInvestmentPurchaseIds)
        void pushDeleteOnWrite("investment_purchases", purchaseId, {});
      for (const saleId of deletedInvestmentSaleIds)
        void pushDeleteOnWrite("investment_sales", saleId, {});
    },
    invalidateKey: QUERY_DEPENDENCIES.transactions,
    successMessage: "Transaksi berhasil diperbarui",
    errorMessage: "Gagal memperbarui transaksi",
    onSuccess: async () => {
      onClosed?.();
    },
  });
}
