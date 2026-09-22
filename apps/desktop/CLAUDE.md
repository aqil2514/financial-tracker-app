# Aturan proyek

Konvensi dan aturan arsitektur untuk kode di `apps/desktop` didokumentasikan
di `docs/rules/`. Baca folder itu sebelum menulis atau mengubah kode di sini.

- [docs/rules/state-lifting-vs-context.md](docs/rules/state-lifting-vs-context.md) —
  kapan state harus diangkat ke React context, bukan diteruskan lewat props.
- [docs/rules/page-layout.md](docs/rules/page-layout.md) — struktur wajib
  `page.tsx` dan kapan context level-page dipakai (beda dari context level
  section).
- [docs/rules/dialog-pattern.md](docs/rules/dialog-pattern.md) — pemisahan
  trigger vs dialog, dan `useDialogState` untuk state "dialog mana yang
  aktif".

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
