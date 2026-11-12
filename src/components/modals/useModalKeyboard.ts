import { type RefObject, useEffect, useRef } from "react";

export interface ModalKeyboardOptions {
  onEscape?: () => void;
  onDefaultEnter?: () => void;
  shortcuts?: Record<string, (() => void) | undefined>;
}

const FOCUSABLE_SELECTOR = [
  "button:not(:disabled)",
  "[href]",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function getVisibleFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el.getClientRects().length > 0,
  );
}

function isTextInputElement(target: HTMLElement | null): boolean {
  if (!target) {
    return false;
  }
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

/**
 * Provides full desktop keyboard accessibility for modal dialogs:
 * - Auto-focuses `[data-autofocus="true"]` (or first focusable control) on mount without scrolling.
 * - Restores focus to the previously focused trigger element on unmount.
 * - Traps `Tab` / `Shift+Tab` strictly inside the modal dialog.
 * - Cycles `[data-modal-option="true"]` buttons with `ArrowDown` / `ArrowUp`.
 * - Dispatches `Escape`, single-key `shortcuts` (`1`..`3`), and fallback `Enter`/`Space`.
 */
export function useModalKeyboard(
  dialogRef: RefObject<HTMLDialogElement | null>,
  options: ModalKeyboardOptions,
): void {
  const optionsRef = useRef<ModalKeyboardOptions>(options);
  optionsRef.current = options;

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (dialog) {
      const preferred =
        dialog.querySelector<HTMLElement>('[data-autofocus="true"]:not(:disabled)') ??
        getVisibleFocusableElements(dialog)[0];
      preferred?.focus({ preventScroll: true });
    }

    return () => {
      if (previousFocused?.isConnected) {
        previousFocused.focus({ preventScroll: true });
      }
    };
  }, [dialogRef]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      const dialog = dialogRef.current;
      if (!dialog) {
        return;
      }

      if (event.key === "Tab") {
        const focusables = getVisibleFocusableElements(dialog);
        if (focusables.length === 0) {
          event.preventDefault();
          return;
        }

        const active = document.activeElement as HTMLElement | null;
        const currentIndex = active ? focusables.indexOf(active) : -1;

        if (event.shiftKey) {
          if (currentIndex <= 0) {
            event.preventDefault();
            focusables[focusables.length - 1]?.focus({ preventScroll: true });
          }
        } else if (currentIndex === -1 || currentIndex === focusables.length - 1) {
          event.preventDefault();
          focusables[0]?.focus({ preventScroll: true });
        }
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const optionButtons = Array.from(
          dialog.querySelectorAll<HTMLElement>('[data-modal-option="true"]:not(:disabled)'),
        );
        const candidates =
          optionButtons.length > 0 ? optionButtons : getVisibleFocusableElements(dialog);
        if (candidates.length > 0) {
          event.preventDefault();
          const active = document.activeElement as HTMLElement | null;
          const currentIndex = active ? candidates.indexOf(active) : -1;
          const nextIndex =
            event.key === "ArrowDown"
              ? currentIndex < 0
                ? 0
                : (currentIndex + 1) % candidates.length
              : currentIndex <= 0
                ? candidates.length - 1
                : currentIndex - 1;
          candidates[nextIndex]?.focus({ preventScroll: true });
        }
        return;
      }

      const { onEscape, onDefaultEnter, shortcuts } = optionsRef.current;

      if (event.key === "Escape" && onEscape) {
        event.preventDefault();
        event.stopPropagation();
        onEscape();
        return;
      }

      const target = event.target as HTMLElement | null;
      if (isTextInputElement(target)) {
        return;
      }

      const shortcutAction = shortcuts?.[event.key] ?? shortcuts?.[event.key.toLowerCase()];
      if (shortcutAction) {
        event.preventDefault();
        event.stopPropagation();
        shortcutAction();
        return;
      }

      if ((event.key === "Enter" || event.key === " ") && onDefaultEnter) {
        if (target && (target.tagName === "BUTTON" || target.tagName === "A")) {
          return;
        }
        event.preventDefault();
        onDefaultEnter();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dialogRef]);
}
