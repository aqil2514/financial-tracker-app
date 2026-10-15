import { FormFieldCurrency } from "@/components/forms/form-fields";
import { useTransactionFormFields } from "../../context/transaction-form-fields-context";

export function FieldAmount() {
  const { form, debtFieldsLocked, needsInvestmentSellFields, needsInvestmentWriteOffFields } =
    useTransactionFormFields();
  const amountIsAutoComputed = needsInvestmentSellFields || needsInvestmentWriteOffFields;

  return (
    <FormFieldCurrency
      form={form}
      name="amount"
      label={amountIsAutoComputed ? "Nominal (otomatis dari unit × average cost)" : "Nominal"}
      useCalculator
      disabled={debtFieldsLocked || amountIsAutoComputed}
    />
  );
}
