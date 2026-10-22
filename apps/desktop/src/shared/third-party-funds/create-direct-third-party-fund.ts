import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { resolveContactId } from "@/shared/contacts/resolve-contact";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";
import type { ThirdPartyFundFormOutput } from "@/features/third-party/content/data/form/schemas";
import { applyDirectThirdPartyTransaction } from "./apply-third-party-transaction";
import { getRemainingThirdPartyFund } from "./remaining-third-party-fund-sql";
import { InsufficientThirdPartyFundError } from "./apply-third-party-transaction";

/**
 * Fungsi murni untuk submit "Catat Titip/Ambil Dana" — diekstrak dari
 * `use-create-third-party-fund.ts` (yang sekarang memanggil ini di dalam
 * `mutationFn`-nya) supaya bisa dipanggil programatik di luar hook form,
 * mis. dari `shared/retailku/components/mapping-step/` saat "Simpan
 * Semua" diklik. Lihat `use-create-third-party-fund.ts` untuk penjelasan
 * lengkap tiap langkah (validasi oversell sebelum insert, urutan push
 * `transactions` sebelum `third_party_funds` karena FK).
 */
export async function createDirectThirdPartyFund(values: ThirdPartyFundFormOutput): Promise<string> {
  const contactId = await resolveContactId(values.contact_name);
  if (contactId == null) {
    throw new Error("Nama kontak wajib diisi.");
  }

  const db = await getDb();
  const type = values.direction === "in" ? "income" : "expense";

  if (type === "expense") {
    const remaining = await getRemainingThirdPartyFund(db, values.account_id, contactId);
    if (values.amount > remaining) {
      throw new InsufficientThirdPartyFundError(remaining, values.amount);
    }
  }

  const transactionId = newId();
  await db.execute(
    `INSERT INTO transactions (id, type, amount, category_id, account_id, transfer_account_id, note, description, date, contact_id)
     VALUES ($1, $2, $3, NULL, $4, NULL, $5, NULL, $6, $7)`,
    [transactionId, type, values.amount, values.account_id, values.note, values.date, contactId]
  );

  const touched = await applyDirectThirdPartyTransaction({
    db,
    transactionId,
    type,
    accountId: values.account_id,
    contactId,
    amount: values.amount,
    date: values.date,
    note: values.note,
  });

  await pushOnWrite("transactions", transactionId);
  for (const id of touched.thirdPartyFundIds) {
    void pushOnWrite("third_party_funds", id);
  }

  return transactionId;
}
