"use client";

import type { DefaultValues } from "react-hook-form";

import { BaseForm } from "@/components/forms/base-form";
import {
  accountSchema,
  type AccountFormOutput,
  type AccountFormValues,
} from "../schema";
import { FieldAccountName } from "./fields/field-account-name";
import { FieldInitialBalance } from "./fields/field-initial-balance";
import { FieldIconColor } from "./fields/field-icon-color";
import { FieldGroup } from "./fields/field-group";
import { FieldAccountType } from "./fields/field-account-type";
import { FieldInvestment } from "./fields/field-investment";
import { FieldDebt } from "./fields/field-debt";
import { FieldDescription } from "./fields/field-description";
import { FieldIsActive } from "./fields/field-is-active";

type AccountFormProps = {
  defaultValues: DefaultValues<AccountFormValues>;
  onSubmit: (values: AccountFormOutput) => void;
  isPending: boolean;
  submitLabel?: string;
  /** true kalau akun ini sudah punya transaksi/piutang-utang terkait —
   * field "Tipe Akun" dikunci read-only, lihat README.md. */
  accountTypeLocked?: boolean;
};

export function AccountForm({
  defaultValues,
  onSubmit,
  isPending,
  submitLabel,
  accountTypeLocked = false,
}: AccountFormProps) {
  return (
    <BaseForm<AccountFormValues, AccountFormOutput>
      schema={accountSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      isPending={isPending}
      submitLabel={submitLabel}
    >
      {() => (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-4">
            <FieldAccountName />
            <FieldInitialBalance />
            <FieldIconColor />
            <FieldGroup />
            <FieldAccountType locked={accountTypeLocked} />
            <FieldInvestment />
            <FieldDebt />
          </div>
          <div className="space-y-4">
            <FieldDescription />
            <FieldIsActive />
          </div>
        </div>
      )}
    </BaseForm>
  );
}
