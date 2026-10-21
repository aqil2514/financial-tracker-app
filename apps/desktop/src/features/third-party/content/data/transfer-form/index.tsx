"use client";

import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";

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
import type { ThirdPartyTransferFormOutput, ThirdPartyTransferFormValues } from "./schemas";

type ThirdPartyTransferFormProps = {
  form: UseFormReturn<ThirdPartyTransferFormValues, unknown, ThirdPartyTransferFormOutput>;
  onSubmit: (values: ThirdPartyTransferFormOutput) => void;
  isPending: boolean;
};

const kindOptions = [
  { value: "move_location", label: "Pindah Tempat" },
  { value: "move_ownership", label: "Pindah Kepemilikan" },
  { value: "both", label: "Keduanya" },
];

/** Sinkronisasi field yang DISEMBUNYIKAN agar selalu ikut field yang
 * ditampilkan (lihat docs/todos/plan/account-type-third-party.md, "Form
 * transfer `third_party → third_party`" — keputusan: field tersembunyi
 * auto-sync, bukan dibiarkan kosong lalu di-resolve saat submit). Untuk
 * `move_location`, kontak tujuan HARUS = kontak asal (cuma 1 field kontak
 * yang terlihat). Untuk `move_ownership`, akun tujuan HARUS = akun asal
 * (cuma 1 field akun yang terlihat). `both` menampilkan keduanya penuh,
 * tidak perlu sinkronisasi. */
function useFieldSync(form: ThirdPartyTransferFormProps["form"]) {
  const kind = form.watch("kind");
  const sourceAccountId = form.watch("source_account_id");
  const sourceContactName = form.watch("source_contact_name");

  useEffect(() => {
    if (kind === "move_location") {
      form.setValue("destination_contact_name", sourceContactName, { shouldValidate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, sourceContactName]);

  useEffect(() => {
    if (kind === "move_ownership") {
      form.setValue("destination_account_id", sourceAccountId, { shouldValidate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, sourceAccountId]);
}

export function ThirdPartyTransferForm({ form, onSubmit, isPending }: ThirdPartyTransferFormProps) {
  const { data: accounts } = useAccounts();
  useFieldSync(form);

  const kind = form.watch("kind");
  const showDestinationAccount = kind !== "move_ownership";
  const showDestinationContact = kind !== "move_location";

  const thirdPartyAccountOptions =
    accounts
      ?.filter((account) => account.account_type === "third_party" && account.is_active)
      .map((account) => ({
        value: String(account.id),
        label: account.group_name ? `${account.name} — ${account.group_name}` : account.name,
      })) ?? [];

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <FormFieldToggleGroup
        form={form}
        name="kind"
        label="Jenis Perpindahan"
        options={kindOptions}
      />
      <FormFieldCombobox
        form={form}
        name="source_account_id"
        label={showDestinationAccount ? "Akun Asal" : "Akun"}
        placeholder="Cari akun..."
        options={thirdPartyAccountOptions}
      />
      {showDestinationAccount && (
        <FormFieldCombobox
          form={form}
          name="destination_account_id"
          label="Akun Tujuan"
          placeholder="Cari akun..."
          options={thirdPartyAccountOptions}
        />
      )}
      <ContactField
        control={form.control}
        name="source_contact_name"
        label={showDestinationContact ? "Kontak Asal (wajib)" : "Kontak (wajib)"}
      />
      {showDestinationContact && (
        <ContactField
          control={form.control}
          name="destination_contact_name"
          label="Kontak Tujuan (wajib)"
        />
      )}
      <FormFieldCurrency form={form} name="amount" label="Nominal" useCalculator />
      <FormFieldDate form={form} name="date" label="Tanggal" />
      <FormFieldText
        form={form}
        name="note"
        label="Catatan"
        placeholder="Mis. Pindah dari Kas Tunai ke Bank Jago"
      />
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Menyimpan..." : "Simpan"}
        </Button>
      </DialogFooter>
    </form>
  );
}
