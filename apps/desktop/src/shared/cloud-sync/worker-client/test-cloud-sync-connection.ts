import type { CloudSyncCredentials } from "./types";
import { request } from "./request";

export async function testCloudSyncConnection(creds: CloudSyncCredentials): Promise<boolean> {
  try {
    await request(creds, "/health");
    return true;
  } catch {
    return false;
  }
}
