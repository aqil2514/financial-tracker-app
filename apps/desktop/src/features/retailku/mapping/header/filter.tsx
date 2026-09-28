import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRetailkuSyncCashflowMapping } from "../context";
import { RetailkuCashflowSyncMode } from "../context/interfaces";
import { PeriodPicker } from "@/components/query/period-picker";
import { useMemo } from "react";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

export function Filter() {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <Mode />
      <Period />
      <SubmitButton />
    </div>
  );
}

const Mode = () => {
  const { mode, setMode } = useRetailkuSyncCashflowMapping().filter;
  return (
    <div className="space-y-1.5">
      <Label>Mode</Label>
      <Select
        value={mode}
        onValueChange={(value) => setMode(value as RetailkuCashflowSyncMode)}
      >
        <SelectTrigger className="w-40">
          <SelectValue>
            {(value: RetailkuCashflowSyncMode) =>
              value === "summary" ? "Ringkas" : "Detail per kategori"
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="summary">Ringkas</SelectItem>
          <SelectItem value="detail">Detail per kategori</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

const Period = () => {
  const { dateFrom, dateTo, setDateFrom, setDateTo } =
    useRetailkuSyncCashflowMapping().filter;
  const periodValue = useMemo<DateRange | undefined>(
    () => ({
      from: new Date(`${dateFrom}T00:00`),
      to: new Date(`${dateTo}T00:00`),
    }),
    [dateFrom, dateTo],
  );

  const handlePeriodChange = (range: DateRange | undefined) => {
    if (!range?.from || !range.to) return;
    setDateFrom(format(range.from, "yyyy-MM-dd"));
    setDateTo(format(range.to, "yyyy-MM-dd"));
  };

  return (
    <div className="space-y-1.5">
      <Label>Periode</Label>
      <PeriodPicker value={periodValue} onChange={handlePeriodChange} />
    </div>
  );
};

const SubmitButton = () => {
  const { handleLoadKeys, isLoadingKeys } =
    useRetailkuSyncCashflowMapping().loads;
  return (
    <Button onClick={handleLoadKeys} disabled={isLoadingKeys}>
      {isLoadingKeys ? "Memuat..." : "Muat Jenis Transaksi"}
    </Button>
  );
};
