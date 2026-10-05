# Jangan hard-wrap paragraf di dokumen Markdown

Berlaku untuk semua dokumen Markdown di `docs/` (root maupun tiap app,
termasuk `apps/*/docs/`).

## Aturan

Satu paragraf atau satu item list ditulis dalam **satu baris mentah**
(soft wrap), bukan dipecah manual jadi banyak baris pendek dengan enter
di tengah kalimat. Biarkan editor yang membungkus tampilan secara
visual — jangan masukkan newline literal di tengah kalimat.

Alasannya: hard-wrap manual membuat enter sering jatuh di titik yang
janggal (di tengah frasa, atau tepat sebelum kata yang jadi terlihat
dipenggal), dan menyulitkan edit/diff karena mengubah satu kata di
tengah paragraf bisa menggeser rewrap seluruh baris setelahnya.

Yang TETAP boleh/wajib pakai baris terpisah seperti biasa:

- Judul (`#`, `##`, dst.), tetap satu baris sendiri.
- Baris kosong pemisah antar paragraf.
- Setiap item list (`-`, `1.`, dst.) tetap barisnya sendiri — yang
  dilarang adalah memecah SATU item jadi beberapa baris dengan enter di
  tengah isinya, bukan memisah antar-item.
- Code block, tabel, blockquote — mengikuti struktur baku masing-masing.

## Contoh

Jangan:

```markdown
Saldo akun bertipe Utang/Piutang punya makna terbalik dari intuisi
"kas" biasa, karena tanda angkanya ditentukan dari sudut pandang
**pemilik aplikasi**, bukan dari sudut pandang uangnya sendiri.
```

Lakukan:

```markdown
Saldo akun bertipe Utang/Piutang punya makna terbalik dari intuisi "kas" biasa, karena tanda angkanya ditentukan dari sudut pandang **pemilik aplikasi**, bukan dari sudut pandang uangnya sendiri.
```
