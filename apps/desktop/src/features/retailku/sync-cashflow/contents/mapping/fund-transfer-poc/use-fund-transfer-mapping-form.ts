"use client";

import { useMemo } from "react";
import { useForm, useWatch, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useAccounts } from "@/hooks/resources";
import {
  sourceTypeMappingSchema,
  type SourceTypeMappingFormOutput,
  type SourceTypeMappingFormValues,
} from "./schema";

/** PoC hook form utk mapping `sourceType: FUND_TRANSFER` — komponen
 * TERPISAH, BELUM diintegrasikan ke tab Mapping existing (lihat
 * "Keputusan terbuka #6" di retailku-dynamic-sourcetype-mapping.md).
 * Submit SEMENTARA cuma `console.log` (belum ada tabel/kolom DB utk
 * key 2-akun — itu "Keputusan terbuka #2", dibahas belakangan). */
export function useFundTransferMappingForm(key: string) {
  const { data: accounts } = useAccounts();

  const form: UseFormReturn<SourceTypeMappingFormValues, unknown, SourceTypeMappingFormOutput> = useForm<
    SourceTypeMappingFormValues,
    unknown,
    SourceTypeMappingFormOutput
  >({
    resolver: zodResolver(sourceTypeMappingSchema),
    defaultValues: {
      sourceType: "FUND_TRANSFER",
      key,
      fromAccountId: "",
      toAccountId: "",
    },
  });

  const fromAccountId = useWatch({ control: form.control, name: "fromAccountId" });
  const toAccountId = useWatch({ control: form.control, name: "toAccountId" });

  const cashAccountOptions = useMemo(
    () =>
      (accounts ?? [])
        .filter((account) => account.is_active && account.account_type === "cash")
        .map((account) => ({
          value: String(account.id),
          label: account.group_name ? `${account.name} — ${account.group_name}` : account.name,
        })),
    [accounts],
  );

  function handleSubmit(values: SourceTypeMappingFormOutput) {
    // eslint-disable-next-line no-console -- PoC: submit belum ditulis ke DB, lihat JSDoc di atas
    console.log("[fund-transfer-poc] submit mapping", values);
  }

  return {
    form,
    cashAccountOptions,
    fromAccountId,
    toAccountId,
    handleSubmit: form.handleSubmit(handleSubmit),
  };
}
