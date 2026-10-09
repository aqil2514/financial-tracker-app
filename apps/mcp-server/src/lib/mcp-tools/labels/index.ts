import type { McpServer } from "@modelcontextprotocol/server";
import { registerCreateLabel } from "./create-label";
import { registerListLabels } from "./list-labels";
import { registerUpdateLabel } from "./update-label";
import { registerDeleteLabel } from "./delete-label";
import { registerAttachLabel } from "./attach-label";
import { registerDetachLabel } from "./detach-label";
import { registerListEntityLabels } from "./list-entity-labels";

export function registerLabelsMcpTools(server: McpServer) {
  registerCreateLabel(server);
  registerListLabels(server);
  registerUpdateLabel(server);
  registerDeleteLabel(server);
  registerAttachLabel(server);
  registerDetachLabel(server);
  registerListEntityLabels(server);
}
