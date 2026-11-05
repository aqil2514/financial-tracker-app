import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { BottomSheetModal, type BottomSheetModalProps } from "@gorhom/bottom-sheet";
import { useDismissOnBack } from "@/components/use-dismiss-on-back";

// Pengganti BottomSheetModal di seluruh app: sama persis, ditambah tombol back Android yang menutup sheet
// (bukan pindah halaman). Ref tetap instance BottomSheetModal, jadi present()/dismiss() dipakai seperti biasa.
export const SheetModal = forwardRef<BottomSheetModal, BottomSheetModalProps>(function SheetModal(
  { onChange, onDismiss, ...props },
  ref
) {
  const innerRef = useRef<BottomSheetModal>(null);
  const [isOpen, setIsOpen] = useState(false);

  useImperativeHandle(ref, () => innerRef.current as BottomSheetModal);

  const dismiss = useCallback(() => innerRef.current?.dismiss(), []);
  useDismissOnBack(isOpen, dismiss);

  return (
    <BottomSheetModal
      {...props}
      ref={innerRef}
      onChange={(index, position, type) => {
        setIsOpen(index >= 0);
        onChange?.(index, position, type);
      }}
      onDismiss={() => {
        setIsOpen(false);
        onDismiss?.();
      }}
    />
  );
});
