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
import { FieldInvestmentCorrection } from "./fields/field-investment-correction";

type AccountBalanceCorrectionFormProps = {
  accountId: string;
  accountType: Account["account_type"];
  defaultValues: DefaultValues<AccountBalanceCorrectionFormValues>;
  onSubmit: (values: AccountBalanceCorrectionFormOutput) => void;
  isPending: boolean;
};

export function AccountBalanceCorrectionForm({
  accountId,
  accountType,
  defaultValues,
  onSubmit,
  isPending,
}: AccountBalanceCorrectionFormProps) {
  return (
    <BaseForm<AccountBalanceCorrectionFormValues, AccountBalanceCorrectionFormOutput>
      schema={accountBalanceCorrectionSchema(accountType)}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      isPending={isPending}
      submitLabel="Koreksi Saldo"
    >
      {() =>
        accountType === "investment" ? (
          <FieldInvestmentCorrection accountId={accountId} />
        ) : (
          <>
            <FieldTargetBalance />
            {accountType === "cash" && <FieldCountAsCash />}
          </>
        )
      }
    </BaseForm>
  );
}
