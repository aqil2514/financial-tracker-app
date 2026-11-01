// Input angka berdesimal gaya Indonesia: koma = desimal, titik = pemisah ribuan (hanya tampilan).
// Nilai yang disimpan di form adalah string dengan titik sebagai desimal ("1234.5"), siap di-Number().

export function parseDecimalInput(text: string, grouped: boolean): string {
  let normalized: string;
  if (grouped) {
    // Tampilan tidak pernah berakhir dengan titik (titik ribuan selalu diikuti digit), jadi titik di
    // ujung berarti user baru mengetiknya sebagai pemisah desimal.
    const typedDecimalDot = text.endsWith(".") && !text.includes(",");
    normalized = text.replace(/\./g, "") + (typedDecimalDot ? "," : "");
  } else {
    normalized = text.replace(/\./g, ",");
  }

  const cleaned = normalized.replace(/[^0-9,]/g, "");
  const commaIndex = cleaned.indexOf(",");
  const integerPart = (commaIndex === -1 ? cleaned : cleaned.slice(0, commaIndex)).replace(/^0+(?=\d)/, "");
  if (commaIndex === -1) return integerPart;

  const fraction = cleaned.slice(commaIndex + 1).replace(/,/g, "");
  return `${integerPart || "0"}.${fraction}`;
}

export function formatDecimalDisplay(raw: string, grouped: boolean): string {
  if (raw === "") return "";
  const [integerPart, fraction] = raw.split(".");
  const integerDisplay = grouped ? integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : integerPart;
  return fraction === undefined ? integerDisplay : `${integerDisplay},${fraction}`;
}
