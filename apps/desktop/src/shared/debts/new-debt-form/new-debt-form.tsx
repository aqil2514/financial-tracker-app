"use client";

import { useEffect, useMemo } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  FormFieldCombobox,
  FormFieldCurrency,
  FormFieldDate,
  FormFieldText,
  FormFieldToggleGroup,
} from "@/components/forms/form-fields";
import { useAccounts } from "@/features/accounts";
import { ContactField } from "@/shared/contacts/contact-field";
import { useDebtAccountUsage } from "../use-debt-account-usage";
import type { NewDebtFormOutput, NewDebtFormValues } from "./schema";

const DEBT_TYPE_LABEL: Record<"receivable" | "payable", string> = {
  receivable: "Piutang",
  payable: "Utang",
};

type NewDebtFormProps = {
  form: UseFormReturn<NewDebtFormValues, unknown, NewDebtFormOutput>;
  onSubmit: (values: NewDebtFormOutput) => void;
  isPending: boolean;
};

const debtTypeOptions = [
  { value: "receivable", label: "Piutang (saya meminjamkan)" },
  { value: "payable", label: "Utang (saya berutang)" },
];

export function NewDebtForm({ form, onSubmit, isPending }: NewDebtFormProps) {
  const { data: accounts } = useAccounts();
  const { data: usage } = useDebtAccountUsage();

  const debtType = useWatch({ control: form.control, name: "debt_type" });

  const cashAccountOptions =
    accounts
      ?.filter((account) => account.account_type === "cash" && account.is_active)
      .map((account) => ({
        value: String(account.id),
        label: account.group_name ? `${account.name} — ${account.group_name}` : account.name,
      })) ?? [];

  const debtAccounts = accounts?.filter(
    (account) => account.account_type === "debt" && account.is_active
  );

  /** `{ [accountId]: { receivable: n, payable: n } }` dari histori baris
   * `debts` — dipakai utk mengurutkan opsi & warning "akun ini biasanya
   * dipakai utk arah lain", BUKAN filter/constraint (1 akun debt boleh
   * dipakai 2 arah by design, lihat use-debt-account-usage.ts). */
  const usageByAccount = useMemo(() => {
    const map = new Map<string, { receivable: number; payable: number }>();
    for (const row of usage ?? []) {
      const entry = map.get(row.account_id) ?? { receivable: 0, payable: 0 };
      entry[row.type] = row.n;
      map.set(row.account_id, entry);
    }
    return map;
  }, [usage]);

  function dominantDirection(accountId: string): "receivable" | "payable" | null {
    const entry = usageByAccount.get(accountId);
    if (!entry || (entry.receivable === 0 && entry.payable === 0)) return null;
    return entry.receivable >= entry.payable ? "receivable" : "payable";
  }

  const debtAccountOptions =
    debtAccounts
      ?.slice()
      .sort((a, b) => {
        // Akun yang histori dominannya SEARAH dengan debt_type yang sedang
        // dipilih naik ke atas daftar — dropdown tetap tampilkan semua
        // akun debt (tidak disembunyikan), cuma urutannya membantu.
        const aMatches = dominantDirection(String(a.id)) === debtType;
        const bMatches = dominantDirection(String(b.id)) === debtType;
        if (aMatches === bMatches) return 0;
        return aMatches ? -1 : 1;
      })
      .map((account) => ({
        value: String(account.id),
        label: account.group_name ? `${account.name} — ${account.group_name}` : account.name,
      })) ?? [];

  const debtAccountId = useWatch({ control: form.control, name: "debt_account_id" });

  // Prefill akun utang piutang dari akun debt yang histori pemakaiannya
  // SEARAH dengan debt_type yang sedang dipilih (bukan sekadar akun debt
  // pertama apa pun) — begitu debt_type berubah, re-evaluasi, supaya
  // toggle "Utang" tidak diam-diam mewarisi prefill akun "Piutang" dari
  // state sebelumnya. Akun tanpa histori sama sekali (baru dibuat) tetap
  // fallback ke akun debt pertama di daftar, prefill tetap wajib diisi.
  const oppositeOf = debtType === "receivable" ? "payable" : "receivable";

  useEffect(() => {
    if (!debtAccounts || debtAccounts.length === 0) return;
    const current = form.getValues("debt_account_id");
    const currentMatchesOpposite = current != null && dominantDirection(current) === oppositeOf;
    // Re-prefill kalau field masih kosong, ATAU akun yang terisi sekarang
    // histori dominannya JELAS berlawanan arah dgn debt_type baru (mis.
    // user baru toggle dari "Piutang" ke "Utang" tapi field masih
    // menyimpan akun "Piutang" dari prefill sebelumnya). Akun tanpa
    // histori ATAU yang histori dominannya SUDAH searah dibiarkan apa
    // adanya, supaya tidak menimpa pilihan manual user.
    if (current && !currentMatchesOpposite) return;
    const matching = debtAccounts.find((account) => dominantDirection(String(account.id)) === debtType);
    form.setValue("debt_account_id", String((matching ?? debtAccounts[0]).id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debtAccounts, debtType, usageByAccount]);

  const selectedDebtAccountMismatch =
    debtAccountId != null && dominantDirection(debtAccountId) === oppositeOf;

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <FormFieldToggleGroup
        form={form}
        name="debt_type"
        label="Jenis"
        options={debtTypeOptions}
      />
      <ContactField control={form.control} label="Nama Kontak (wajib)" />
      <FormFieldCurrency form={form} name="amount" label="Nominal" useCalculator />
      <FormFieldCombobox
        form={form}
        name="cash_account_id"
        label="Akun Kas"
        placeholder="Cari akun kas..."
        options={cashAccountOptions}
      />
      <div className="space-y-1">
        <FormFieldCombobox
          form={form}
          name="debt_account_id"
          label="Akun Utang Piutang"
          placeholder="Cari akun utang piutang..."
          options={debtAccountOptions}
        />
        {selectedDebtAccountMismatch && (
          <p className="text-amber-600 text-sm">
            Akun ini biasanya dipakai untuk {DEBT_TYPE_LABEL[oppositeOf]}, bukan {DEBT_TYPE_LABEL[debtType]} — pastikan ini sengaja.
          </p>
        )}
      </div>
      <FormFieldDate form={form} name="date" label="Tanggal" />
      <FormFieldText
        form={form}
        name="note"
        label="Catatan"
        placeholder={
          debtType === "receivable"
            ? "Mis. Minjem modal usaha"
            : "Mis. Pinjam buat kebutuhan mendesak"
        }
      />
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Menyimpan..." : "Simpan"}
        </Button>
      </DialogFooter>
    </form>
  );
}
