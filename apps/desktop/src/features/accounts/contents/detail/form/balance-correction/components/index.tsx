"use client";

import type { DefaultValues } from "react-hook-form";

import { BaseForm } from "@/components/forms/base-form";
import {
  accountBalanceCorrectionSchema,
  type AccountBalanceCorrectionFormOutput,
  type AccountBalanceCorrectionFormValues,
} from "../schema";
import { FieldTargetBalance } from "./fields/field-target-balance";

type AccountBalanceCorrectionFormProps = {
  defaultValues: DefaultValues<AccountBalanceCorrectionFormValues>;
  onSubmit: (values: AccountBalanceCorrectionFormOutput) => void;
  isPending: boolean;
};

export function AccountBalanceCorrectionForm({
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
      {() => <FieldTargetBalance />}
    </BaseForm>
  );
}
