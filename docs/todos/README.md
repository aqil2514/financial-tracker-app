# `docs/todos/` — Konvensi Dokumen Rencana

## Apa isi folder ini

Dokumen perencanaan kerja: riset, keputusan desain, dan checklist
eksekusi untuk fitur/perubahan yang cukup besar untuk butuh catatan
tertulis sebelum/selama dikerjakan — bukan untuk setiap task kecil.

## Dua subfolder

- **`plan/`** — dokumen fitur yang MASIH AKTIF direncanakan atau
  dikerjakan. Ditulis SEBELUM/SELAMA implementasi, diupdate terus
  selama kerja berlangsung (status checklist, keputusan baru,
  perubahan arah).
- **`done/`** — dokumen fitur yang SUDAH SELESAI dikerjakan.
  Dipindahkan dari `plan/` ke `done/` (bukan dihapus) begitu fitur
  kelar — isinya jadi arsip/riwayat keputusan, tidak diupdate lagi
  kecuali ada koreksi faktual.

Pola pemindahan `plan/` → `done/` ini sudah dipakai konsisten di
`apps/desktop/docs/todos/` — lihat folder itu sbg contoh konkret.

## Root vs per-app

Struktur `docs/todos/{plan,done}/` yang SAMA berulang di beberapa
level:

- **Root** (`docs/todos/`, tempat README ini) — untuk fitur yang
  LINTAS-APP: menyentuh lebih dari satu folder `apps/*` sekaligus.
  Dokumen di sini biasanya HANYA index/navigasi ringkas + checklist
  per tahap, menunjuk ke dokumen detail di masing-masing app — BUKAN
  tempat menulis detail keputusan/riset itu sendiri (supaya tidak
  duplikasi/basi saat detailnya berubah).
- **Per-app** (`apps/<nama>/docs/todos/`) — untuk fitur yang scope-nya
  MURNI di app itu sendiri, ATAU untuk detail teknis satu app dari
  fitur lintas-app yang index-nya ada di root. Lihat contoh
  [`plan/cloud-sync-mcp.md`](plan/cloud-sync-mcp.md): index-nya di
  root, tapi detail Worker ada di `apps/worker/docs/todos/plan/`,
  detail PC ada di `apps/desktop/docs/todos/plan/`.

Aturan praktis: kalau ragu fitur ini lintas-app atau tidak, mulai dari
per-app dulu — pindah/pecah ke root HANYA kalau ternyata scope-nya
melebar ke app lain (seperti yang terjadi pada `cloud-sync-mcp.md`,
awalnya ditulis di `apps/desktop` saja sebelum ketahuan menyentuh
`apps/worker` juga).
