import type { Contact } from "@/lib/db";

function normalize(name: string) {
  return name.trim().toLowerCase();
}

// Levenshtein sederhana — cukup untuk mendeteksi salah ketik/variasi kecil
// nama kontak (mis. "Kak Ipit" vs "Kak Ipiy"), tidak butuh library eksternal
// untuk kasus sekecil ini.
function levenshtein(a: string, b: string) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist = Array.from({ length: rows }, (_, i) => [
    i,
    ...Array(cols - 1).fill(0),
  ]);
  for (let j = 1; j < cols; j++) dist[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dist[i][j] = Math.min(
        dist[i - 1][j] + 1,
        dist[i][j - 1] + 1,
        dist[i - 1][j - 1] + cost
      );
    }
  }
  return dist[rows - 1][cols - 1];
}

/**
 * Kontak dengan nama yang "mirip" (bukan identik) dengan `name` — dipakai
 * untuk menampilkan warning non-blocking saat user mengetik nama kontak
 * baru yang mungkin sebenarnya typo dari kontak yang sudah ada. Keputusan
 * akhir (pakai yang sudah ada / tetap buat baru) diserahkan ke user.
 */
export function findSimilarContacts(name: string, contacts: Contact[]): Contact[] {
  const query = normalize(name);
  if (!query) return [];

  return contacts.filter((contact) => {
    const target = normalize(contact.name);
    if (target === query) return false; // exact match, bukan "mirip"
    if (target.includes(query) || query.includes(target)) return true;
    const distance = levenshtein(query, target);
    return distance <= 2 && target.length > 2;
  });
}
