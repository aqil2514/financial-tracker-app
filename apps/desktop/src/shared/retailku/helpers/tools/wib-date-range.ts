const WIB_OFFSET_MS = 7 * 60 * 60_000;

export function wibDayRangeToUtcMs(dateFrom: string, dateTo: string) {
  const startUtcMs = new Date(`${dateFrom}T00:00:00.000Z`).getTime() - WIB_OFFSET_MS;
  const endUtcMs = new Date(`${dateTo}T23:59:59.999Z`).getTime() - WIB_OFFSET_MS;
  return { startUtcMs, endUtcMs };
}

export function isWithinWibDayRange(iso: string, dateFrom: string, dateTo: string) {
  const { startUtcMs, endUtcMs } = wibDayRangeToUtcMs(dateFrom, dateTo);
  const ms = new Date(iso).getTime();
  return ms >= startUtcMs && ms <= endUtcMs;
}
