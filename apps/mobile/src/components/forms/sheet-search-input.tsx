import { forwardRef, useImperativeHandle, useRef } from "react";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";

// BottomSheetTextInput TIDAK terkontrol (tanpa prop `value`) — dibaca
// lewat ref, bukan di-echo balik dari state React tiap keystroke.
// Versi terkontrol (value={search}) bikin cursor native "mundur-maju"
// sekilas saat mengetik/hapus cepat — race antara posisi cursor native
// vs value yang di-push balik dari JS. Uncontrolled menghilangkan race
// itu: native input pegang kendali karakter dan posisi cursor, JS cuma
// "mendengarkan" lewat onChangeText (di-debounce).
export interface SheetSearchInputRef {
  getValue: () => string;
}

interface SheetSearchInputProps {
  onChangeDebounced: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export const SheetSearchInput = forwardRef<SheetSearchInputRef, SheetSearchInputProps>(
  function SheetSearchInput({ onChangeDebounced, placeholder = "Cari...", autoFocus }, ref) {
    const valueRef = useRef("");
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useImperativeHandle(ref, () => ({ getValue: () => valueRef.current }));

    function handleChangeText(text: string) {
      valueRef.current = text;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => onChangeDebounced(text), 150);
    }

    return (
      <BottomSheetTextInput
        defaultValue=""
        onChangeText={handleChangeText}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="rounded-md border border-neutral-300 px-3 py-2 text-neutral-900"
      />
    );
  }
);
