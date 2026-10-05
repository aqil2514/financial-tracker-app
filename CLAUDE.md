# Aturan proyek (lintas apps)

Ini monorepo (`apps/desktop`, `apps/mobile`, `apps/mcp-server`,
`apps/worker`). Konvensi yang berlaku LINTAS semua app didokumentasikan
di `docs/rules/` (root ini) — baca sebelum menulis atau mengubah dokumen
yang disebut. Tiap app juga bisa punya `CLAUDE.md`/`docs/rules/` sendiri
untuk aturan yang spesifik ke app itu saja (mis. `apps/desktop/CLAUDE.md`).

- [docs/rules/todo-docs.md](docs/rules/todo-docs.md) — format wajib
  dokumen `docs/todos/*`: ringkasan status checklist `[ ]`/`[x]` di
  paling atas file, sebelum latar belakang/konteks lainnya.
- [docs/rules/markdown-line-wrap.md](docs/rules/markdown-line-wrap.md) —
  jangan hard-wrap paragraf/item list di dokumen Markdown; satu
  paragraf/item = satu baris mentah (soft wrap), biar editor yang
  membungkus tampilannya.
