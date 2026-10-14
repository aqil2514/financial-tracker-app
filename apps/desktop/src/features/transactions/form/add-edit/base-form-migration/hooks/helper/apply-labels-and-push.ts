import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";
import { resolveLabelIds } from "@/shared/labels/resolve-label-ids";
import { applyTransactionLabels } from "@/shared/labels/apply-transaction-labels";

type ApplyLabelsAndPushInput = {
  transactionId: string;
  labelNames: string[];
};

export async function applyLabelsAndPush({
  transactionId,
  labelNames,
}: ApplyLabelsAndPushInput): Promise<void> {
  await pushOnWrite("transactions", transactionId);

  const labelIds = await resolveLabelIds(labelNames, "transaction_category");
  await applyTransactionLabels(transactionId, labelIds);
}
