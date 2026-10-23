"use client";

import { useEffect } from "react";

// Input types where Enter means something else (toggle, pick a file, press).
const NON_TEXT_TYPES = ["checkbox", "radio", "file", "button", "submit", "reset", "hidden", "image", "range", "color"];

function isNavigable(el: Element | null): el is HTMLInputElement | HTMLSelectElement {
  if (el instanceof HTMLSelectElement) return !el.multiple;
  return el instanceof HTMLInputElement && !NON_TEXT_TYPES.includes(el.type);
}

function isUsable(el: HTMLInputElement | HTMLSelectElement): boolean {
  return !el.disabled && !(el as HTMLInputElement).readOnly && el.tabIndex !== -1 && el.offsetParent !== null;
}

/**
 * App-wide: Enter in a text, number, date or password box (or a dropdown) moves to the
 * next field, like Tab. Mounted once in the root layout.
 *
 * Left alone, so existing behaviour is unchanged:
 * - textareas (Enter is a new line), buttons, links, checkboxes, radios, file inputs;
 * - Shift/Ctrl/Alt/Meta + Enter, and Enter while an IME is composing;
 * - search boxes and comboboxes with a popup open (Enter picks the highlighted option);
 * - the LAST field of a <form>: Enter submits it, as before (login, search forms);
 * - the last field of a page with no <form>: nothing to move to, so nothing happens;
 * - anything inside an element marked data-enter-native, or a handler that already
 *   called preventDefault (the protocol wizard has its own).
 */
export function EnterToNext() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.defaultPrevented || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return;
      const target = e.target as HTMLElement | null;
      if (!target || !isNavigable(target) || target.closest("[data-enter-native]")) return;
      if (target.getAttribute("role") === "combobox" || target.getAttribute("aria-expanded") === "true") return;
      if (target instanceof HTMLInputElement && target.type === "search") return;

      // Move within the form, dialog or page section the field lives in.
      const scope = target.closest("form, [role='dialog'], [aria-modal='true']") ?? document.body;
      const fields = Array.from(scope.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select"))
        .filter((el) => isNavigable(el) && isUsable(el));
      const at = fields.indexOf(target);
      if (at === -1) return;

      const next = fields[at + 1];
      if (!next) return; // last field: a form submits (default), a bare page does nothing
      e.preventDefault();
      next.focus();
      if (next instanceof HTMLInputElement && ["text", "number", "search", "tel", "email", "url", "password"].includes(next.type)) {
        next.select();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
  return null;
}
