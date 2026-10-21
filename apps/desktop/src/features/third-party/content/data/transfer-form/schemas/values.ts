import type { ThirdPartyTransferFormValues } from "./schema";

function now() {
  const date = new Date();
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function defaultThirdPartyTransferValues(): ThirdPartyTransferFormValues {
  return {
    kind: "move_location",
    source_account_id: "",
    source_contact_name: null,
    destination_account_id: "",
    destination_contact_name: null,
    amount: 0,
    date: now(),
    note: "",
  };
}
