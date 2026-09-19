export {
  ContactList,
  DeleteContactDialog,
  useDeleteContact,
} from "./list";
export {
  ContactForm,
  ContactFormDialog,
  ContactEditDialog,
  useCreateContact,
  useUpdateContact,
  contactSchema,
  type ContactFormValues,
  type ContactFormOutput,
} from "./form";
export { useContacts, contactsQueryKey } from "@/shared/contacts/use-contacts";
