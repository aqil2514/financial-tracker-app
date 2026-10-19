"use client";

import type { DefaultValues } from "react-hook-form";

import { BaseForm } from "@/components/forms/base-form";
import type { Account } from "@/lib/db";
import {
  accountBalanceCorrectionSchema,
  type AccountBalanceCorrectionFormOutput,
  type AccountBalanceCorrectionFormValues,
} from "../schema";
import { FieldTargetBalance } from "./fields/field-target-balance";
import { FieldCountAsCash } from "./fields/field-count-as-cash";

type AccountBalanceCorrectionFormProps = {
  accountType: Account["account_type"];
  defaultValues: DefaultValues<AccountBalanceCorrectionFormValues>;
  onSubmit: (values: AccountBalanceCorrectionFormOutput) => void;
  isPending: boolean;
};

export function AccountBalanceCorrectionForm({
  accountType,
  defaultValues,
  onSubmit,
  isPending,
}: AccountBalanceCorrectionFormProps) {
  return (
    <BaseForm<AccountBalanceCorrectionFormValues, AccountBalanceCorrectionFormOutput>
      schema={accountBalanceCorrectionSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      isPending={isPending}
      submitLabel="Koreksi Saldo"
    >
      {() => (
        <>
          <FieldTargetBalance />
          {accountType === "cash" && <FieldCountAsCash />}
        </>
      )}
    </BaseForm>
  );
}
