"use client";

import type { ReactElement, ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EntityFormDialogProps {
  trigger?: ReactElement;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  contentClassName?: string;
  scrollBody?: boolean;
}

export function EntityFormDialog({
  trigger,
  title,
  open,
  onOpenChange,
  children,
  contentClassName,
  scrollBody,
}: EntityFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent
        className={
          scrollBody
            ? `grid grid-rows-[auto_1fr] overflow-hidden ${contentClassName ?? ""}`
            : contentClassName
        }
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {scrollBody ? (
          <ScrollArea className="h-full min-h-0">{children}</ScrollArea>
        ) : (
          children
        )}
      </DialogContent>
    </Dialog>
  );
}
