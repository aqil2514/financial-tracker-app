"use client";

import { useRef } from "react";

import { BaseForm } from "@/components/forms/base-form";
import type { PendingAttachment } from "@/shared/attachments/pending-attachment";
import { transactionSchema, defaultTransactionValues } from "../schema";
import type { TransactionFormOutput, TransactionFormValues } from "../schema";
import { TransactionFormFieldsProvider } from "../context/transaction-form-fields-context";
import { FieldNote } from "./fields/field-note";
import { FieldTransactionType } from "./fields/field-transaction-type";
import { FieldAmount } from "./fields/field-amount";
import { FieldAccountId } from "./fields/field-account-id";
import { FieldTransferAccountOrCategory } from "./fields/field-transfer-account-or-category";
import { FieldContactName } from "./fields/field-contact-name";
import { FieldDebtAction } from "./fields/field-debt-action";
import { FieldLabel } from "./fields/field-label";
import { FieldInvestment } from "./fields/field-investment";
import { FieldDate } from "./fields/field-date";
import { FieldAttachments } from "./fields/field-attachments";
import { FieldDescription } from "./fields/field-description";
import { CreateAccountDialog } from "./fields/create-account-dialog";
import { CreateCategoryDialog } from "./fields/create-category-dialog";

type TransactionFormWithBaseFormProps = {
  defaultValues: Partial<TransactionFormValues>;
  onSubmit: (values: TransactionFormOutput) => void;
  isPending: boolean;
  submitLabel?: string;
  transactionId?: string;
  pendingAttachments?: PendingAttachment[];
  onPendingAttachmentsChange?: (attachments: PendingAttachment[]) => void;
};

export function TransactionFormWithBaseForm({
  defaultValues,
  onSubmit,
  isPending,
  submitLabel = "Simpan",
  transactionId,
  pendingAttachments,
  onPendingAttachmentsChange,
}: TransactionFormWithBaseFormProps) {
  const handleSubmitRef = useRef<(values: TransactionFormOutput) => void>(onSubmit);

  function submitViaRef(values: TransactionFormOutput) {
    handleSubmitRef.current(values);
  }

  return (
    <BaseForm<TransactionFormValues, TransactionFormOutput>
      schema={transactionSchema}
      defaultValues={{ ...defaultTransactionValues(), ...defaultValues }}
      onSubmit={submitViaRef}
      isPending={isPending}
      submitLabel={submitLabel}
    >
      {(form) => (
        <TransactionFormFieldsProvider
          form={form}
          onSubmit={onSubmit}
          handleSubmitRef={handleSubmitRef}
          transactionId={transactionId}
          isPending={isPending}
          pendingAttachments={pendingAttachments}
          onPendingAttachmentsChange={onPendingAttachmentsChange}
        >
          <div className="grid max-h-[70vh] gap-6 overflow-y-auto pr-1 sm:grid-cols-2">
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

            <div className="space-y-4">
              <FieldAttachments />
              <FieldDescription />
            </div>
          </div>
          <CreateAccountDialog />
          <CreateCategoryDialog />
        </TransactionFormFieldsProvider>
      )}
    </BaseForm>
  );
}
