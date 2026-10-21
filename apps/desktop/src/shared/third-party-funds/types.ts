import type { getDb } from "@/lib/db";

export type Db = Awaited<ReturnType<typeof getDb>>;

export type TouchedThirdPartyFundRows = {
  thirdPartyFundIds: string[];
  deletedThirdPartyFundIds: string[];
};

export function mergeTouchedThirdPartyFundRows(
  a: TouchedThirdPartyFundRows,
  b: TouchedThirdPartyFundRows
): TouchedThirdPartyFundRows {
  return {
    thirdPartyFundIds: [...a.thirdPartyFundIds, ...b.thirdPartyFundIds],
    deletedThirdPartyFundIds: [...a.deletedThirdPartyFundIds, ...b.deletedThirdPartyFundIds],
  };
}
