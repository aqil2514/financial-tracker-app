"use client";

import { CashflowConfigProvider } from "./config-context";
import { ArApCashAccountSection } from "./sections/ar-ap-cash-account-section";
import { AutoSyncToggleSection } from "./sections/auto-sync-toggle-section";
import { DebtAccountsSection } from "./sections/debt-accounts-section";
import { MappingStatusSection } from "./sections/mapping-status-section";
import { PreviewSyncSection } from "./sections/preview-sync-section";
import { SyncFromSection } from "./sections/sync-from-section";
import { SyncModeSection } from "./sections/sync-mode-section";
import { SyncNowButton } from "./sections/sync-now-button";
import { SyncStatusSection } from "./sections/sync-status-section";

/** Tab "Konfigurasi" — kontrol sync (toggle mode, field akun, titik
 * awal sync, toggle auto-sync, tombol "Sync Sekarang"). Logic ada di
 * `useCashflowConfig` (dibungkus `CashflowConfigProvider`), tiap
 * section mengambil data sendiri lewat `useCashflowConfigContext()` —
 * komponen ini murni komposisi/layout, lihat
 * docs/rules/state-lifting-vs-context.md. */
export function CashflowConfigTab() {
  return (
    <CashflowConfigProvider>
      <div className="max-w-xl space-y-6">
        <MappingStatusSection />
        <SyncModeSection />
        <ArApCashAccountSection />
        <DebtAccountsSection />
        <SyncFromSection />
        <AutoSyncToggleSection />
        <SyncStatusSection />
        <PreviewSyncSection />
        <SyncNowButton />
      </div>
    </CashflowConfigProvider>
  );
}
