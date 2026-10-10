import { pushDeleteOnWrite } from "./push-delete-on-write";

export async function pushDeleteAttachmentOnWrite(id: string): Promise<void> {
  await pushDeleteOnWrite("transaction_attachments", id, {});
}
