import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AttachmentFolderSetting } from "./attachment-folder-setting";

export function AttachmentFolderSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Folder Lampiran Foto</CardTitle>
      </CardHeader>
      <CardContent>
        <AttachmentFolderSetting />
      </CardContent>
    </Card>
  );
}
