import { PeriodPicker } from "@/components/query/period-picker";
import { useRetailkuSyncCashflowSummary } from "../summary-context";

export function Header() {
  const { setRange, range } = useRetailkuSyncCashflowSummary();
  return (
    <>
      <PeriodPicker
        onChange={(periodRange) => {
          if (!periodRange) return;
          const dateFrom = formatToCashflowDateRange(
            periodRange.from,
            range.timezone,
          );
          const dateTo = formatToCashflowDateRange(
            periodRange.to,
            range.timezone,
          );

          setRange((prev) => {
            return {
              ...prev,
              dateFrom,
              dateTo,
            };
          });
        }}
        value={{
          from: new Date(range.dateFrom),
          to: new Date(range.dateTo),
        }}
      />
    </>
  );
}

const formatToCashflowDateRange = (
  date: Date | undefined,
  timeZone: string,
) => {
  const format = new Intl.DateTimeFormat("id-ID", {
    timeZone: timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
    .format(date)
    .replaceAll("/", "-");

  const year = format.split("-")[2];
  const month = format.split("-")[1];
  const day = format.split("-")[0];

  return `${year}-${month}-${day}`;
};
