import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import { FormFieldSelect } from "@/components/forms/form-fields";
import { ACCOUNT_TYPE_OPTIONS } from "@/lib/account-types";
import type { AccountFormOutput, AccountFormValues } from "../../schema";

export function FieldAccountType({ locked }: { locked: boolean }) {
  const form = useFormContext<AccountFormValues, unknown, AccountFormOutput>();
  const accountType = useWatch({ control: form.control, name: "account_type" });

  useEffect(() => {
    if (accountType === "third_party") {
      form.setValue("initial_balance", 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountType]);

  return (
    <FormFieldSelect
      form={form}
      name="account_type"
      label="Tipe Akun"
      disabled={locked}
      options={ACCOUNT_TYPE_OPTIONS.map((option) => ({
        ...option,
        description: locked
          ? `${option.description} Tipe terkunci karena akun ini sudah punya transaksi/piutang-utang terkait.`
          : option.description,
      }))}
    />
  );
}
