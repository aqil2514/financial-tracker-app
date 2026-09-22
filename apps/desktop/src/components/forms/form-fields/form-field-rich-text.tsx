import {
  Controller,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";
import type { JSONContent } from "@tiptap/react";

import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/rich-text";

type FormFieldRichTextProps<TFieldValues extends FieldValues> = {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
};

export function FormFieldRichText<TFieldValues extends FieldValues>({
  form,
  name,
  label,
}: FormFieldRichTextProps<TFieldValues>) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <div className="space-y-2">
          <Label>{label}</Label>
          <RichTextEditor
            value={(field.value as JSONContent | null) ?? null}
            onChange={field.onChange}
          />
          {fieldState.error && (
            <p className="text-destructive text-sm">{fieldState.error.message}</p>
          )}
        </div>
      )}
    />
  );
}
