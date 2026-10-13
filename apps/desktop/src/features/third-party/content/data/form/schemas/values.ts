import type { ThirdPartyFundFormValues } from "./schema";

function now() {
  const date = new Date();
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function defaultThirdPartyFundValues(): ThirdPartyFundFormValues {
  return {
    direction: "in",
    account_id: "",
    contact_name: null,
    amount: 0,
    date: now(),
    note: "",
  };
}
