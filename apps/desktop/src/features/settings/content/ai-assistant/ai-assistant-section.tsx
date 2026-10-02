import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AiAssistantForm } from "./ai-assistant-form";

export function AiAssistantSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Assistant (MCP)</CardTitle>
      </CardHeader>
      <CardContent>
        <AiAssistantForm />
      </CardContent>
    </Card>
  );
}
