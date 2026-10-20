import { useFormContext } from "react-hook-form";

import { formatCurrency } from "@/lib/format-currency";
import { UnitAmountField } from "@/shared/investments/unit-amount-field";
import { PricePerUnitField } from "@/shared/investments/price-per-unit-field";
import { useInvestmentHoldingSummary } from "@/shared/investments/use-investment-holding-summary";
import type {
  AccountBalanceCorrectionFormOutput,
  AccountBalanceCorrectionFormValues,
} from "../../schema";

export function FieldInvestmentCorrection({ accountId }: { accountId: string }) {
  const form = useFormContext<
    AccountBalanceCorrectionFormValues,
    unknown,
    AccountBalanceCorrectionFormOutput
  >();
  const { data: holding } = useInvestmentHoldingSummary(accountId);

  return (
    <div className="space-y-4">
      {holding && (
        <div className="grid grid-cols-2 gap-4 rounded-lg border p-3 text-sm">
          <p>
            Sisa unit tercatat: <span className="font-medium">{holding.remainingUnit}</span>
          </p>
          <p>
            Avg. cost/unit tercatat: <span className="font-medium">{formatCurrency(holding.averageCostPerUnit, "IDR")}</span>
          </p>
        </div>
      )}
      <UnitAmountField form={form} name="unit" label="Unit yang Seharusnya" optional={false} />
      <PricePerUnitField
        form={form}
        name="pricePerUnit"
        unitFieldName="unit"
        label="Harga/Cost per Unit"
        optional={false}
      />
    </div>
  );
}
