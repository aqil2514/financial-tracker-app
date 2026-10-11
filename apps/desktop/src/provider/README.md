# provider

Context/provider generic yang dipakai lintas fitur — tidak tahu domain apa pun.

- **`dialog-state/`** — state "dialog mana yang aktif" dalam satu fitur, backing store `useState` lokal (`useDialogState`, `createDialogContext`).
- **`dialog-query-state/`** — versi yang sama, tapi backing store-nya URL lewat `nuqs` (`useDialogQueryState`, `createDialogQueryContext`) — dipakai kalau dialog itu perlu deep-link/tahan refresh.

Lihat README masing-masing modul untuk detail.
