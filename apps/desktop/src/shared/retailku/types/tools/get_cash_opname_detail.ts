export type RetailkuCashOpnameThirdPartyFund = {
  /** Nama pemilik dana pihak ketiga */
  label: string;
  /** Jumlah dana pihak ketiga yang ikut tercampur di kas */
  amount: number;
  /** Alasan/keterangan dana ini tercampur di kas */
  reason: string;
};

export type RetailkuCashOpnameDenominationItem = {
  /** ID baris denominasi dalam opname ini */
  id: string;
  /** ID master denominasi */
  denominationId: string;
  /** Label denominasi, mis. "Rp 5.000" */
  label: string;
  /** Nilai satu lembar/koin denominasi ini */
  value: number;
  /** Jumlah lembar/koin yang dihitung */
  quantity: number;
  /** value dikali quantity */
  subtotal: number;
};

export type RetailkuCashOpnameAccount = {
  /** ID akun kas yang di-opname */
  id: string;
  /** Kode akun (COA) */
  code: string;
  /** Nama akun */
  name: string;
};

export type RetailkuCashOpnameUser = {
  /** ID user */
  id: string;
  /** Nama user */
  name: string;
  /** URL foto profil, null jika tidak ada */
  picture: string | null;
};

export type RetailkuCashOpnameDetail = {
  /** ID cash opname */
  id: string;
  /** Status data Cash Opname */
  status: "DRAFT" | "POSTED" | "CANCELLED";
  /** Waktu kas dihitung */
  countedAt: string;
  /** Saldo menurut sistem saat dihitung */
  systemBalance: number;
  /** Dana pihak ketiga yang ikut tercampur di kas */
  thirdPartyFunds: RetailkuCashOpnameThirdPartyFund[];
  /** Total hasil hitung fisik, sebelum dikurangi dana pihak ketiga */
  physicalTotal: number;
  /** Fisik setelah dikurangi dana pihak ketiga */
  netTotal: number;
  /** netTotal dikurangi systemBalance */
  difference: number;
  /** Catatan tambahan opname */
  notes: string;
  /** Akun kas yang di-opname */
  account: RetailkuCashOpnameAccount;
  /** ID jurnal yang dihasilkan saat opname di-post, null jika belum */
  journalEntryId: string | null;
  /** Pembuat data opname */
  createdBy: RetailkuCashOpnameUser;
  /** Waktu data opname dibuat */
  createdAt: string;
  /** User yang mem-post opname, null jika belum diposting */
  postedBy: RetailkuCashOpnameUser | null;
  /** Waktu opname diposting, null jika belum */
  postedAt: string | null;
  /** Breakdown hitung fisik per denominasi */
  items: RetailkuCashOpnameDenominationItem[];
};

/** Bentuk mentah satu baris denominasi dari respons
 * `get_cash_opname_detail` — `subtotal` masih string, belum dikonversi ke
 * `number`. */
export type RetailkuCashOpnameDenominationItemRaw = Omit<RetailkuCashOpnameDenominationItem, "subtotal"> & {
  subtotal: string;
};

/** Bentuk mentah respons `get_cash_opname_detail` — field angka
 * (`systemBalance`, `physicalTotal`, `netTotal`, `difference`) masih
 * string, belum dikonversi ke `number`. */
export type RetailkuCashOpnameDetailRaw = Omit<
  RetailkuCashOpnameDetail,
  "systemBalance" | "physicalTotal" | "netTotal" | "difference" | "items"
> & {
  systemBalance: string;
  physicalTotal: string;
  netTotal: string;
  difference: string;
  items: RetailkuCashOpnameDenominationItemRaw[];
};
