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
