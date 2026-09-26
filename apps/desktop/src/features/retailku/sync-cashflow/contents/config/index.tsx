import { Contents } from "./contents";
import { RetailkuSyncCashflowConfigProvider } from "./context";
import { Header } from "./header";

/** Tab "Konfigurasi" — kontrol sync (toggle mode, field akun, titik
 * awal sync, toggle auto-sync, tombol "Sync Sekarang"). Logic ada di
 * `useCashflowConfig` (dibungkus `RetailkuSyncCashflowConfigProvider`),
 * tiap section di `contents/` mengambil data sendiri lewat
 * `useRetailkuSyncCashflowConfig()` — komponen ini murni komposisi/
 * layout, lihat docs/rules/state-lifting-vs-context.md. */
export function CashflowConfigTab() {
  return (
    <RetailkuSyncCashflowConfigProvider>
      <div className="space-y-4">
        <Header />
        <Contents />
      </div>
    </RetailkuSyncCashflowConfigProvider>
  );
}
