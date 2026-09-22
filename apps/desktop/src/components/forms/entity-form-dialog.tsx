"use client";

import type { ReactElement, ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface EntityFormDialogProps {
  /** Opsional — kosongkan kalau dialog dipicu dari luar (mis. item menu
   * aksi) lewat `open`/`onOpenChange` saja, tanpa trigger visible sendiri. */
  trigger?: ReactElement;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  contentClassName?: string;
}

export function EntityFormDialog({
  trigger,
  title,
  open,
  onOpenChange,
  children,
  contentClassName,
}: EntityFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent className={contentClassName}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
