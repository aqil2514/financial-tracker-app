import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactList, ContactFormDialog } from "@/features/contacts";

export default function ContactsPage() {
  return (
    <PageContainer>
      <PageHeader title="Nama Pihak" description="Kelola daftar kontak/pihak terkait" />
      <Card>
        <CardHeader>
          <CardTitle>Daftar Kontak</CardTitle>
          <CardAction>
            <ContactFormDialog />
          </CardAction>
        </CardHeader>
        <CardContent>
          <ContactList />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
