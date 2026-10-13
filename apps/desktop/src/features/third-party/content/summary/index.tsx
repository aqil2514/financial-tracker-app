import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ThirdPartySummarySection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Segera Hadir</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">
          Ringkasan total titipan per kontak dan per akun akan tampil di sini. Lihat{" "}
          <code className="text-xs">docs/todos/plan/account-type-third-party.md</code> untuk
          status pengerjaannya.
        </p>
      </CardContent>
    </Card>
  );
}
