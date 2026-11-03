function pad(value: number) {
  return String(value).padStart(2, "0");
}

// Format penyimpanan tanggal-jam, sama dengan desktop: waktu LOKAL tanpa zona, "YYYY-MM-DDTHH:mm".
export function toLocalDateTime(date: Date = new Date()): string {
  return `${toLocalDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Format penyimpanan tanggal saja (periode kategori), sama dengan desktop: "YYYY-MM-DD".
export function toLocalDate(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// SQL setara toLocalDateTime(), untuk INSERT yang mengisi tanggal di SQL.
export const LOCAL_DATETIME_SQL = "strftime('%Y-%m-%dT%H:%M', 'now', 'localtime')";
