import { useEffect } from "react";

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function isTypingInEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return EDITABLE_TAGS.has(target.tagName) || target.isContentEditable;
}

/**
 * Shortcut global "N" untuk buka dialog tambah data (transaksi/akun), tanpa
 * modifier — pola "n for new" seperti Gmail/Linear. Diabaikan saat user
 * sedang mengetik di input/textarea/select/contentEditable supaya tidak
 * mengganggu pengetikan biasa.
 */
export function useCreateShortcut(onTrigger: () => void) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "n" && event.key !== "N") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingInEditable(event.target)) return;

      event.preventDefault();
      onTrigger();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onTrigger]);
}
