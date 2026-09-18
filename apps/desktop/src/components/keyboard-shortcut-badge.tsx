export function KeyboardShortcutBadge({ shortcut }: { shortcut: string }) {
  return (
    <kbd className="rounded border border-current/30 bg-black/10 px-1.5 py-0.5 font-mono text-xs opacity-80 dark:bg-white/10">
      {shortcut}
    </kbd>
  );
}
