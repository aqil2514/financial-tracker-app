"use client";

import { toast } from "sonner";

import { getDb, type Account } from "@/lib/db";
import { newId } from "@/lib/id";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import { isEmptyDoc } from "@/components/rich-text";
import { saveAttachmentToTransaction } from "@/shared/attachments/use-add-attachment";
import { resolveContactId } from "@/shared/contacts/resolve-contact";
import { applyDebtTransaction } from "@/shared/debts/apply-debt-transaction";
import { classifyAccountPair } from "@/shared/debts/classify-account-pair";
import { applyInvestmentTransaction } from "@/shared/investments/apply-investment-transaction";
import {
  applySellInvestmentTransaction,
  InsufficientInvestmentUnitsError,
} from "@/shared/investments/apply-sell-investment-transaction";
import { getAverageCostPerUnit, getRemainingUnit } from "@/shared/investments/investment-holding-math";
import type { PendingAttachment } from "@/shared/attachments/pending-attachment";
import { useEntityForm } from "@/components/forms/hooks/use-entity-form";
import { transactionSchema, type TransactionFormOutput } from "../schema";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";
import { resolveLabelIds } from "@/shared/labels/resolve-label-ids";
import { applyTransactionLabels } from "@/shared/labels/apply-transaction-labels";

type Db = Awaited<ReturnType<typeof getDb>>;

async function getAccountType(db: Db, accountId: string): Promise<Account["account_type"] | null> {
  const rows = await db.select<Pick<Account, "account_type">[]>(
    "SELECT account_type FROM accounts WHERE id = $1",
    [accountId]
  );
  return rows[0]?.account_type ?? null;
}

function now() {
  const date = new Date();
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

type UseCreateTransactionOptions = {
  /** Dialog terbuka atau tidak — datang dari context, dipakai untuk
   * resetOnOpen. */
  open: boolean;
  /** Lampiran yang ditangkap sebelum transaksi tersimpan — diproses
   * (disimpan ke disk + database) setelah insert transaksi berhasil,
   * karena baru di titik itu `transaction_id`-nya diketahui. Dibaca lewat
   * getter (bukan array langsung) supaya selalu ambil state terbaru dari
   * form saat submit terjadi, bukan snapshot saat hook di-mount. */
  getPendingAttachments?: () => PendingAttachment[];
  attachmentFolder?: string | null;
  onAttachmentsSaved?: () => void;
  /** Dipanggil setelah transaksi (dan lampirannya, kalau ada) selesai
   * tersimpan — HANYA saat bukan "Simpan & Lanjut", supaya pemanggil bisa
   * menutup dialog dari context. Saat "Simpan & Lanjut", dialog tetap
   * terbuka dan ini TIDAK dipanggil. */
  onClosed?: () => void;
  /** Akun yang otomatis dipilih saat form dibuka — dipakai halaman detail
   * akun supaya transaksi baru langsung ter-scope ke akun yang sedang
   * dilihat, tanpa user perlu memilih lagi. */
  defaultAccountId?: string;
};

export function useCreateTransaction(options: UseCreateTransactionOptions) {
  const {
    open,
    getPendingAttachments,
    attachmentFolder = null,
    onAttachmentsSaved,
    onClosed,
    defaultAccountId,
  } = options;

  return useEntityForm({
    schema: transactionSchema,
    defaultValues: () => ({
      type: "expense" as const,
      amount: 0,
      account_id: defaultAccountId != null ? String(defaultAccountId) : "",
      category_id: null,
      transfer_account_id: null,
      note: "",
      description: null,
      date: now(),
      contact_name: null,
      debt_action: null,
      settle_debt_ids: [],
      unit: null,
      price_per_unit: null,
      investment_status: "pending" as const,
      label_names: [],
    }),
    open,
    resetOnOpen: true,
    mutationFn: async (values: TransactionFormOutput) => {
      const contactId = await resolveContactId(values.contact_name);

      const db = await getDb();
      const accountId = values.account_id;
      const transferAccountId =
        values.type === "transfer" ? values.transfer_account_id : null;
      const transactionId = newId();

      // Deteksi arah investment SEBELUM insert -- untuk arah jual
      // (investment->cash), nominal yang di-INSERT ke transactions.amount
      // BUKAN values.amount (field itu dikunci read-only di form.tsx,
      // cuma preview) tapi average_cost * unit, pola PERSIS
      // use-create-investment-sale.ts. Lihat
      // docs/concept/konsep-investasi.md "Efek ke accounts.balance".
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
        // Validasi oversell SEBELUM insert baris transactions -- beda
        // dari form "Jual Investasi" khusus (use-create-investment-sale.ts)
        // yang membiarkan InsufficientInvestmentUnitsError terlempar dari
        // applySellInvestmentTransaction SETELAH insert (meninggalkan
        // baris transactions yatim kalau gagal). Form transaksi utama ini
        // bisa cek lebih awal karena sudah query account type duluan di
        // atas -- dicek di sini sekalian supaya tidak ada baris yatim utk
        // kasus paling umum (salah ketik unit kebesaran).
        const [averageCost, remainingUnit] = await Promise.all([
          getAverageCostPerUnit(db, accountId),
          getRemainingUnit(db, accountId),
        ]);
        if (values.unit > remainingUnit) {
          throw new InsufficientInvestmentUnitsError(remainingUnit, values.unit);
        }
        amount = averageCost * values.unit;
      }

      await db.execute(
        `INSERT INTO transactions (id, type, amount, category_id, account_id, transfer_account_id, note, description, date, contact_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          transactionId,
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
        ]
      );

      const touchedDebtRows = await applyDebtTransaction({
        db,
        transactionId,
        type: values.type,
        accountId,
        transferAccountId,
        contactId,
        amount,
        date: values.date,
        debtAction: values.debt_action,
        settleDebtIds: values.settle_debt_ids,
      });

      let adjustmentTransactionId: string | null = null;
      let investmentPurchaseId: string | null = null;
      let investmentSaleId: string | null = null;
      if (isInvestmentSell) {
        // unit/price_per_unit WAJIB diisi untuk arah jual -- divalidasi di
        // useTransactionInvestmentFields (validateInvestmentFields)
        // sebelum mutationFn ini dipanggil, jadi aman non-null di sini.
        // Form transaksi utama ini HANYA mendukung jual 'settled' --
        // InvestmentFields menyembunyikan toggle status & memaksa
        // 'settled' untuk arah jual (keputusan 2026-10-07, status
        // 'pending' cuma lewat dialog "Jual Investasi" khusus karena
        // TIDAK boleh insert transaksi sama sekali, kontradiktif dengan
        // arsitektur form ini yang selalu insert transaksi di atas).
        const touched = await applySellInvestmentTransaction({
          db,
          transactionId,
          accountId,
          transferAccountId,
          date: values.date,
          unit: values.unit as number,
          pricePerUnit: values.price_per_unit as number,
          status: "settled",
        });
        adjustmentTransactionId = touched.adjustmentTransactionId;
        investmentSaleId = touched.investmentSaleIds[0] ?? null;
      } else {
        const touched = await applyInvestmentTransaction({
          db,
          transactionId,
          type: values.type,
          accountId,
          transferAccountId,
          date: values.date,
          unit: values.unit,
          pricePerUnit: values.price_per_unit,
          status: values.investment_status ?? "pending",
        });
        investmentPurchaseId = touched.investmentPurchaseIds[0] ?? null;
      }

      // debts/debt_payments/investment_purchases/investment_sales SEMUA
      // punya FK ke transactions(id) -- await push "transactions" (leg
      // utama) SELESAI dulu sebelum push baris turunan mana pun, supaya
      // tidak race (bug nyata ditemukan Tahap 5: push kedua bisa sampai
      // ke Worker LEBIH DULU dari leg utamanya, FOREIGN KEY constraint
      // failed). adjustmentTransactionId TIDAK direferensikan FK oleh
      // apa pun di sini, tapi tetap diurutkan setelah supaya konsisten.
      await pushOnWrite("transactions", transactionId);
      if (adjustmentTransactionId != null) void pushOnWrite("transactions", adjustmentTransactionId);
      if (investmentPurchaseId != null) void pushOnWrite("investment_purchases", investmentPurchaseId);
      if (investmentSaleId != null) void pushOnWrite("investment_sales", investmentSaleId);
      for (const debtId of touchedDebtRows.debtIds) void pushOnWrite("debts", debtId);
      for (const debtPaymentId of touchedDebtRows.debtPaymentIds) void pushOnWrite("debt_payments", debtPaymentId);

      // Label di-attach TERAKHIR -- butuh transactionId yang sudah pasti
      // ada (sudah di-INSERT di atas), tidak ada efek bisnis apa pun yang
      // bergantung label (query-only, lihat general-label.md), jadi aman
      // di urutan paling akhir mutationFn ini.
      const labelIds = await resolveLabelIds(values.label_names, "transaction_category");
      await applyTransactionLabels(transactionId, labelIds);

      return transactionId;
    },
    onSuccess: async (transactionId, { keepOpen }) => {
      const pending = getPendingAttachments?.() ?? [];

      if (transactionId != null && pending.length > 0) {
        // Transaksinya sendiri sudah tersimpan di titik ini — kegagalan
        // menyimpan lampiran TIDAK boleh dilempar sebagai error mutation
        // (useDbMutation.onError hanya menangkap error dari mutationFn,
        // bukan dari onSuccess), jadi ditangani sendiri di sini supaya user
        // tetap dapat feedback yang jelas alih-alih unhandled rejection.
        try {
          await Promise.all(
            pending.map((attachment) =>
              saveAttachmentToTransaction(transactionId, attachment.input, attachmentFolder)
            )
          );
        } catch (err) {
          const detail = err instanceof Error ? err.message : String(err);
          toast.error(`Transaksi tersimpan, tapi lampiran gagal disimpan: ${detail}`);
        } finally {
          // Dialog/form tetap reset setelah ini (perilaku useEntityForm) —
          // pending attachments yang gagal tidak bisa "dicoba ulang" dari
          // form yang sudah reset, jadi tetap dibersihkan baik sukses
          // maupun gagal supaya tidak ada state foto "hantu" yang tersisa.
          onAttachmentsSaved?.();
        }
      }

      if (!keepOpen) onClosed?.();
    },
    invalidateKey: QUERY_DEPENDENCIES.transactions,
    successMessage: "Transaksi berhasil ditambahkan",
    errorMessage: "Gagal menambahkan transaksi",
  });
}
