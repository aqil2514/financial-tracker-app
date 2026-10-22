"use client";

import { useEffect, useRef } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  transactionSchema,
  defaultTransactionValues,
  type TransactionFormValues,
  type TransactionFormOutput,
} from "@/features/transactions/form/add-edit/schema";
import { TransactionFormFieldsProvider } from "@/features/transactions/form/add-edit/context/transaction-form-fields-context";
import { FieldNote } from "@/features/transactions/form/add-edit/components/fields/field-note";
import { FieldTransactionType } from "@/features/transactions/form/add-edit/components/fields/field-transaction-type";
import { FieldAmount } from "@/features/transactions/form/add-edit/components/fields/field-amount";
import { FieldAccountId } from "@/features/transactions/form/add-edit/components/fields/field-account-id";
import { FieldTransferAccountOrCategory } from "@/features/transactions/form/add-edit/components/fields/field-transfer-account-or-category";
import { FieldContactName } from "@/features/transactions/form/add-edit/components/fields/field-contact-name";
import { FieldDebtAction } from "@/features/transactions/form/add-edit/components/fields/field-debt-action";
import { FieldLabel } from "@/features/transactions/form/add-edit/components/fields/field-label";
import { FieldInvestment } from "@/features/transactions/form/add-edit/components/fields/field-investment";
import { FieldDate } from "@/features/transactions/form/add-edit/components/fields/field-date";
import { CreateAccountDialog } from "@/features/transactions/form/add-edit/components/fields/create-account-dialog";
import { CreateCategoryDialog } from "@/features/transactions/form/add-edit/components/fields/create-category-dialog";

export function TransactionEntryForm({
  defaultValues,
  onChange,
}: {
  defaultValues: Partial<TransactionFormValues>;
  onChange: (values: TransactionFormOutput | null) => void;
}) {
  const form = useForm<TransactionFormValues, unknown, TransactionFormOutput>({
    resolver: zodResolver(transactionSchema),
    defaultValues: { ...defaultTransactionValues(), ...defaultValues },
  });

  // Tab ini tidak punya tombol submit sendiri (lihat ../index.tsx — satu
  // tombol "Simpan Semua" di luar) — `handleSubmitRef`/`onSubmit` di sini
  // TIDAK PERNAH benar-benar dipanggil, cuma dipenuhi karena
  // `TransactionFormFieldsProvider` mewajibkannya.
  const noopHandleSubmitRef = useRef<(values: TransactionFormOutput) => void>(() => {});

  const values = useWatch({ control: form.control });

  useEffect(() => {
    const parsed = transactionSchema.safeParse(values);
    onChange(parsed.success ? parsed.data : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `onChange` dipegang parent, tidak perlu di deps
  }, [values]);

  return (
    <FormProvider {...form}>
      <TransactionFormFieldsProvider
        form={form}
        onSubmit={() => {}}
        handleSubmitRef={noopHandleSubmitRef}
        isPending={false}
      >
        <div className="space-y-4">
          <FieldNote />
          <FieldTransactionType />
          <FieldAmount />
          <FieldAccountId />
          <FieldTransferAccountOrCategory />
          <FieldContactName />
          <FieldDebtAction />
          <FieldLabel />
          <FieldInvestment />
          <FieldDate />
        </div>
        <CreateAccountDialog />
        <CreateCategoryDialog />
      </TransactionFormFieldsProvider>
    </FormProvider>
  );
}
