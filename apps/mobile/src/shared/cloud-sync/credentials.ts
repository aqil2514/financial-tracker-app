import * as SecureStore from "expo-secure-store";

// Token sync disimpan terenkripsi (Keystore/Keychain), bukan di SQLite, supaya tidak ikut terbaca dari dump/backup DB.
const TOKEN_KEY = "cloud_sync_token";

export function getSyncToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export function setSyncToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(TOKEN_KEY, token);
}

export function clearSyncToken(): Promise<void> {
  return SecureStore.deleteItemAsync(TOKEN_KEY);
}
