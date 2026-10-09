import type { McpServer } from "@modelcontextprotocol/server";
import { registerUploadAttachment } from "./upload-attachment";
import { registerGetAttachment } from "./get-attachment";
import { registerListAttachments } from "./list-attachments";
import { registerDeleteAttachment } from "./delete-attachment";

export function registerAttachmentsMcpTools(server: McpServer) {
  registerUploadAttachment(server);
  registerGetAttachment(server);
  registerListAttachments(server);
  registerDeleteAttachment(server);
}
