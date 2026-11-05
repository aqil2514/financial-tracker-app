// Geometri donut untuk BreakdownPie. Sudut dalam derajat, 0 = jam 12, searah jarum jam.

export interface SliceAngles {
  startAngle: number;
  endAngle: number;
}

// Sudut tiap irisan pada `progress` (0..1). Seperti Recharts, animasi
// dibuat dengan menskalakan semua sudut dari 0 ke nilai akhir, jadi donut
// "terbuka" melingkar dari jam 12. `paddingAngle` = sela antar irisan,
// hanya dipakai kalau irisannya lebih dari satu.
export function computeSlices(values: number[], progress: number, paddingAngle = 2): SliceAngles[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return [];

  const padding = values.length > 1 ? paddingAngle : 0;
  let cursor = 0;

  return values.map((value) => {
    const span = (value / total) * 360;
    const start = cursor;
    cursor += span;
    return {
      startAngle: (start + padding / 2) * progress,
      endAngle: (start + span - padding / 2) * progress,
    };
  });
}

export function polar(cx: number, cy: number, radius: number, angle: number) {
  const radians = (angle * Math.PI) / 180;
  return { x: cx + radius * Math.sin(radians), y: cy - radius * Math.cos(radians) };
}

function arc(cx: number, cy: number, inner: number, outer: number, start: number, end: number) {
  const largeArc = end - start > 180 ? 1 : 0;
  const outerStart = polar(cx, cy, outer, start);
  const outerEnd = polar(cx, cy, outer, end);
  const innerEnd = polar(cx, cy, inner, end);
  const innerStart = polar(cx, cy, inner, start);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outer} ${outer} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${inner} ${inner} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

// Path satu irisan donut. Satu busur SVG tidak bisa menggambar lingkaran penuh
// (titik awal = titik akhir), jadi irisan ≥ 360° dipecah jadi dua setengah lingkaran.
// Irisan hampir nol (awal animasi) mengembalikan array kosong.
export function describeSector(
  cx: number,
  cy: number,
  inner: number,
  outer: number,
  startAngle: number,
  endAngle: number
): string[] {
  const span = endAngle - startAngle;
  if (span < 0.01) return [];
  if (span >= 359.99) {
    const mid = startAngle + 180;
    return [arc(cx, cy, inner, outer, startAngle, mid), arc(cx, cy, inner, outer, mid, endAngle)];
  }
  return [arc(cx, cy, inner, outer, startAngle, endAngle)];
}
