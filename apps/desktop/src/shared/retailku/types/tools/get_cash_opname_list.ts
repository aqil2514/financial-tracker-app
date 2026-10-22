export type RetailkuCashOpnameListItem = {
  /** ID cash opname */
  id: string;
  /** Status data Cash Opname */
  status: "DRAFT" | "POSTED" | "CANCELLED";
  /** Waktu kas dihitung */
  countedAt: string;
  /** Saldo menurut sistem saat dihitung */
  systemBalance: number;
  /** Total hasil hitung fisik, sebelum dikurangi dana pihak ketiga */
  physicalTotal: number;
  /** Fisik setelah dikurangi dana pihak ketiga */
  netTotal: number;
  /** netTotal dikurangi systemBalance */
  difference: number;
  /** Pembuat data opname */
  createdBy: { name: string };
  /** Waktu data opname dibuat */
  createdAt: string;
};

export type RetailkuCashOpnameList = {
  /** Daftar cash opname pada halaman ini */
  data: RetailkuCashOpnameListItem[];
  /** Total seluruh data (lintas halaman) */
  total: number;
  /** Halaman saat ini */
  page: number;
  /** Jumlah data per halaman */
  limit: number;
};

/** Bentuk mentah satu item dari respons `get_cash_opname_list` — field
 * angka masih string, belum dikonversi ke `number`. */
export type RetailkuCashOpnameListItemRaw = Omit<
  RetailkuCashOpnameListItem,
  "systemBalance" | "physicalTotal" | "netTotal" | "difference"
> & {
  systemBalance: string;
  physicalTotal: string;
  netTotal: string;
  difference: string;
};

/** Bentuk mentah respons `get_cash_opname_list`. */
export type RetailkuCashOpnameListRaw = Omit<RetailkuCashOpnameList, "data"> & {
  data: RetailkuCashOpnameListItemRaw[];
};
