const NATIVE_TEXT_EDIT_KEYS = new Set(['a', 'c', 'v', 'x']);

function isInputElement(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export function isInputFocused(e?: KeyboardEvent): boolean {
  if (e && isInputElement(e.target as Element)) return true;
  return isInputElement(document.activeElement);
}

export function isNativeTextCommand(e: KeyboardEvent): boolean {
  if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return false;
  return NATIVE_TEXT_EDIT_KEYS.has(e.key.toLowerCase());
}
