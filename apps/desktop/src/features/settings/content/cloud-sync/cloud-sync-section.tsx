import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CloudSyncForm } from "./cloud-sync-form";

export function CloudSyncSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cloud Sync</CardTitle>
      </CardHeader>
      <CardContent>
        <CloudSyncForm />
      </CardContent>
    </Card>
  );
}
