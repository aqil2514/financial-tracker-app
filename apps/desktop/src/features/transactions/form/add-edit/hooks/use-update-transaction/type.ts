export type UseUpdateTransactionOptions = {
  /** Dialog terbuka atau tidak — datang dari context, dipakai untuk
   * resetOnOpen. */
  open: boolean;
  /** Dipanggil setelah transaksi berhasil diperbarui — dipakai pemanggil
   * untuk menutup dialog dari context. Edit tidak punya "Simpan & Lanjut",
   * jadi ini selalu dipanggil setelah submit sukses. */
  onClosed?: () => void;
};
