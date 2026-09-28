"use client";

import { cn } from "cn";
import {
  FormFieldCombobox,
  FormFieldRichText,
  FormFieldText,
} from "@/components/forms/form-fields";
import type { AccountWithBalance } from "@/hooks/resources/use-accounts";
import type { Contact } from "@/lib/db";
import type { ArApMappingRowDraft, MappingRowDraftPatch } from "../../context/interfaces";
import { FollowSourceToggle } from "../follow-source-toggle";
import { useArApMappingForm } from "./use-ar-ap-mapping-form";

/** Form mapping utk `sourceType: AR_AP` — akun DEBT lokal (piutang/
 * utang, BUKAN akun kas) + kontak (toggle "Mengikuti Retailku": ON =
 * ikut nama pihak Retailku PER TRANSAKSI, OFF = 1 kontak lokal statis
 * yg dipilih di form) + note/deskripsi (SAMA field non-fakta yg dipakai
 * varian lain, MINUS kategori — lihat JSDoc `ArApMappingRowDraft`
 * kenapa kategori TIDAK applicable di sini). TIDAK ada field akun kas
 * di sini — itu di luar scope mapping. SAMA pola dgn varian lain: TIDAK
 * ada tombol submit sendiri, `onChange` melapor ke `updateDraft`
 * Context, tombol "Simpan Mapping" GLOBAL yg submit sekali utk semua
 * key. */
export function ArApMappingForm({
  row,
  debtAccountOptions,
  contactOptions,
  onChange,
}: {
  row: ArApMappingRowDraft;
  debtAccountOptions: AccountWithBalance[];
  contactOptions: Contact[];
  onChange: (patch: MappingRowDraftPatch) => void;
}) {
  const { form, contactFollowSource } = useArApMappingForm({ row, onChange });

  const accountItems = debtAccountOptions.map((account) => ({
    value: String(account.id),
    label: account.group_name ? `${account.name} — ${account.group_name}` : account.name,
  }));

  const contactItems = contactOptions.map((contact) => ({
    value: String(contact.id),
    label: contact.name,
  }));

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
        <div className="flex items-center gap-2">
          <p className="font-medium">
            {row.accountName} — {row.direction === "receivable" ? "Piutang" : "Utang"} (
            {row.transactionCount} transaksi)
          </p>
          {row.kind && (
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                row.kind === "trade"
                  ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              )}
            >
              {row.kind === "trade" ? "Dagang" : "Non-Dagang"}
            </span>
          )}
        </div>
        {row.partyNames.length > 0 && (
          <p className="text-muted-foreground">Pihak: {row.partyNames.join(", ")}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormFieldCombobox
            form={form}
            name="localAccountId"
            label="Akun Utang-Piutang (lokal)"
            placeholder="Pilih akun..."
            options={accountItems}
          />
        </div>

        <div className="sm:col-span-2 space-y-2">
          <FormFieldCombobox
            form={form}
            name="contactId"
            label="Kontak"
            placeholder={contactFollowSource ? "(ikut nama pihak tiap transaksi Retailku)" : "Pilih kontak..."}
            options={contactItems}
            disabled={contactFollowSource}
          />
          <FollowSourceToggle
            form={form}
            name="contactFollowSource"
            label="Mengikuti Retailku (kontak ikut nama pihak tiap transaksi)"
            helpText="Tiap transaksi TETAP dapat satu kontak (bukan daftar) — nilainya ikut nama pihak transaksi itu, bisa beda-beda antar transaksi walau key mapping-nya sama."
          />
        </div>

        <div className="sm:col-span-2">
          <FormFieldText form={form} name="note" label="Judul" placeholder="Judul default" />
        </div>

        <div className="sm:col-span-2">
          <FormFieldRichText form={form} name="description" label="Deskripsi" />
        </div>
      </div>
    </div>
  );
}
