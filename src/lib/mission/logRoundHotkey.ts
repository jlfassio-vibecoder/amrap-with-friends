/** True when Space should fire Log round (not typing, not a held/modified key). */
export function shouldHandleLogRoundHotkey(event: {
  key: string;
  code: string;
  repeat: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
}): boolean {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }

  const isSpace = event.key === ' ' || event.code === 'Space';
  if (!isSpace) {
    return false;
  }

  return !isTypingTarget(event.target);
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  // jsdom may not mirror contentEditable onto isContentEditable / the attribute.
  const contentEditableAttr = target.getAttribute('contenteditable');
  if (
    target.isContentEditable ||
    target.contentEditable === 'true' ||
    target.contentEditable === 'plaintext-only' ||
    contentEditableAttr === '' ||
    contentEditableAttr?.toLowerCase() === 'true'
  ) {
    return true;
  }

  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
