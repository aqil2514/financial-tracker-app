import type { RetailkuCashflowSyncSettings } from "../../../../shared/sync";
import type { SetSyncSettings, UseSettingsDraftOutput } from "./use-settings-draft";

export interface UseCashflowSyncFieldsOutput {
  syncSettings: RetailkuCashflowSyncSettings | undefined;
  syncSettingsLoading: boolean;
  setSyncSettings: SetSyncSettings;
  mode: UseSettingsDraftOutput<"syncMode">;
  arApCashAccountId: UseSettingsDraftOutput<"arApCashAccountId">;
  autoSyncEnabled: UseSettingsDraftOutput<"autoSyncEnabled">;
  lastAutoSyncDate: string | null;
}
