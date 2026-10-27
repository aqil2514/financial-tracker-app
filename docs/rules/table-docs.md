
# Format dokumen `docs/tables/*`

Berlaku untuk semua `docs/tables/*.md` di semua app pada monorepo ini (`apps/desktop/docs/tables/`, `apps/mobile/docs/tables/`, dst). Tujuannya: representasi skema database yang ramah dibaca manusia — satu file per tabel (atau per kelompok tabel yang memang satu kesatuan konsep, mis. tabel utama + junction table-nya), WAJIB mencerminkan skema **terbaru** (hasil akhir setelah semua migrasi, bukan snapshot migrasi tertentu).

## Struktur wajib, urutan tetap

1. **Deskripsi** — satu-dua paragraf: tabel ini untuk apa, dipakai di konteks apa. Sebut migrasi mana yang membuat/mengubah tabel ini kalau relevan untuk pembaca menelusuri riwayatnya.
2. **SQL final** — satu code block ```sql``` berisi `CREATE TABLE` (dan index terkait) hasil gabungan semua migrasi yang menyentuh tabel ini sampai saat ini ditulis. Bukan tempel mentah satu file migrasi kalau tabelnya sudah diubah migrasi setelahnya (mis. kolom baru dari `ALTER TABLE`, atau FK yang baru dipasang lewat copy-and-rename) — gabungkan jadi satu `CREATE TABLE` yang benar-benar menggambarkan skema saat ini.
3. **Tabel kolom** — tabel Markdown dengan kolom minimal: Kolom, Tipe, Wajib, Default, Keterangan. Tiap baris jelaskan maksud kolom itu, bukan cuma mengulang tipe datanya — kalau ada constraint (`CHECK`, `UNIQUE`, FK dengan `ON DELETE ...`), jelaskan konsekuensinya dalam bahasa biasa.
4. **Catatan** — hal-hal yang tidak tertangkap di tabel kolom: data yang dihitung on-the-fly (bukan kolom tersimpan), kolom yang sengaja mati/tidak dipakai UI, FK yang sengaja belum dipasang, pola penghapusan khusus (unassign/reassign), dan tautan `[nama-tabel.md](nama-tabel.md)` ke tabel lain yang berelasi langsung.

## Aturan isi

- **Akurat ke kode saat ini, bukan ke rencana.** Kalau sebuah dokumen rencana (`docs/todos/plan/*`) menyebut sesuatu "akan diaktifkan" tapi keputusan final di dokumen `done/*` atau migrasi aktual berbeda, dokumen tabel WAJIB ikut yang final/aktual — cross-check ke migrasi sungguhan sebelum menulis, jangan salin klaim dari dokumen rencana begitu saja.
- **Jangan merujuk file yang belum dipastikan ada** (mis. komentar migrasi yang menyebut path dokumen lain) — verifikasi dulu filenya benar-benar ada sebelum ditautkan/disebut.
- Dokumen ini murni referensi skema — bukan tempat menulis todo/rencana porting (itu tempatnya di `docs/todos/plan/*`, lihat [todo-docs.md](todo-docs.md)) atau konsep bisnis (itu tempatnya `docs/concept/*`). Boleh saling tautan, jangan duplikasi isi.
- Ikuti [markdown-line-wrap.md](markdown-line-wrap.md) — paragraf/item tetap satu baris mentah, soft wrap.

## Contoh kerangka

```markdown
# Tabel `nama_tabel`

Deskripsi singkat tabel ini untuk apa. Dibuat di migrasi `000X_nama.ts`, kolom Y ditambahkan di `000Z_lain.ts`.

## SQL final

\`\`\`sql
CREATE TABLE nama_tabel (
  id TEXT PRIMARY KEY NOT NULL,
  ...
);
\`\`\`

## Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |

## Catatan

- Hal-hal di luar tabel kolom yang perlu pembaca tahu.
- Lihat juga [tabel-lain.md](tabel-lain.md).
```

Lihat `apps/mobile/docs/tables/account.md` dan `apps/mobile/docs/tables/transaction.md` sebagai contoh penerapan nyata.
