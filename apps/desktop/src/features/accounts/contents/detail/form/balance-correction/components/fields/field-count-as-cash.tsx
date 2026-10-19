import { useFormContext } from "react-hook-form";

import { Checkbox } from "@/components/ui/checkbox";
import type {
  AccountBalanceCorrectionFormOutput,
  AccountBalanceCorrectionFormValues,
} from "../../schema";

export function FieldCountAsCash() {
  const form = useFormContext<
    AccountBalanceCorrectionFormValues,
    unknown,
    AccountBalanceCorrectionFormOutput
  >();
  const countAsCash = form.watch("countAsCash");

  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm">
      <Checkbox
        checked={countAsCash}
        onCheckedChange={(checked) =>
          form.setValue("countAsCash", checked === true, {
            shouldValidate: true,
            shouldDirty: true,
          })
        }
      />
      <span>
        Hitung sebagai transaksi kas di laporan?
        <span className="text-muted-foreground block text-xs">
          Centang kalau ini selisih kas fisik riil (mis. ketahuan uangnya
          lebih/kurang). Kosongkan kalau cuma membenarkan salah catat
          administratif -- transaksi penyesuaian tidak akan dihitung di
          laporan cashflow.
        </span>
      </span>
    </label>
  );
}
