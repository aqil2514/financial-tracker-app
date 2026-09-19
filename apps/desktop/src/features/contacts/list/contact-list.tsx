"use client";

import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { QueryState } from "@/components/query-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RichTextViewer } from "@/components/rich-text";
import { useContacts } from "@/shared/contacts/use-contacts";
import { ContactEditDialog } from "../form/contact-edit-dialog";
import { DeleteContactDialog } from "./delete-contact-dialog";

export function ContactList() {
  const { data: contacts, isLoading, error } = useContacts();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return contacts;
    return contacts?.filter((contact) =>
      contact.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [contacts, search]);

  return (
    <div className="space-y-3">
      <Input
        placeholder="Cari kontak..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-56"
      />

      <QueryState isLoading={isLoading} error={error} />
      <ScrollArea className="h-80">
        <div className="space-y-2 pr-4">
          {filtered?.map((contact) => {
            const note = contact.note ? JSON.parse(contact.note) : null;
            return (
              <div key={contact.id} className="flex items-start justify-between rounded-lg border p-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{contact.name}</p>
                  {note && <RichTextViewer value={note} className="text-muted-foreground text-xs" />}
                </div>
                <div className="flex items-center gap-1">
                  <ContactEditDialog contact={contact} />
                  <DeleteContactDialog contact={contact} />
                </div>
              </div>
            );
          })}
          {filtered && filtered.length === 0 && contacts && contacts.length > 0 && (
            <p className="text-muted-foreground text-sm">
              Tidak ada kontak yang cocok dengan pencarian.
            </p>
          )}
          {contacts && contacts.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Belum ada kontak. Tambahkan lewat tombol di atas.
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
