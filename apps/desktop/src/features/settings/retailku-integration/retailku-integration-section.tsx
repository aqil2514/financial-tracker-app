import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RetailkuSettingsForm } from "./retailku-settings-form";

export function RetailkuIntegrationSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrasi Retailku</CardTitle>
      </CardHeader>
      <CardContent>
        <RetailkuSettingsForm />
      </CardContent>
    </Card>
  );
}
