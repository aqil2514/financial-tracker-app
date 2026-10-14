import { FormFieldCurrency } from "@/components/forms/form-fields";
import { useTransactionFormFields } from "../../context/transaction-form-fields-context";

export function FieldAmount() {
  const { form, debtFieldsLocked, needsInvestmentSellFields } = useTransactionFormFields();

  return (
    <FormFieldCurrency
      form={form}
      name="amount"
      label={needsInvestmentSellFields ? "Nominal (otomatis dari unit × average cost)" : "Nominal"}
      useCalculator
      disabled={debtFieldsLocked || needsInvestmentSellFields}
    />
  );
}
