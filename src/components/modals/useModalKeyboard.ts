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
 * Provides full desktop keyboard & screen-reader modal isolation:
 * - Blocks held-key `event.repeat` auto-repeat storms (`preventDefault` on `Enter`/`Space`/`Tab`).
 * - Marks background sibling regions `inert` while mounted so assistive tech & focus stay inside.
 * - Auto-focuses `[data-autofocus="true"]` (or first focusable control) on mount without scrolling.
 * - Restores focus to the previously focused trigger element on unmount.
 * - Traps `Tab` / `Shift+Tab` and stray `focusin` strictly inside the modal dialog.
 * - Cycles `[data-modal-option="true"]` buttons with `ArrowDown`/`ArrowRight` & `ArrowUp`/`ArrowLeft`.
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

    const inertTargets: HTMLElement[] = [];
    if (dialog?.parentElement) {
      for (const child of Array.from(dialog.parentElement.children)) {
        if (
          child instanceof HTMLElement &&
          child !== dialog &&
          child.tagName !== "DIALOG" &&
          child.getAttribute("data-testid") !== "achievement-toast" &&
          !child.inert
        ) {
          inertTargets.push(child);
          child.inert = true;
        }
      }
    }

    const focusInitial = () => {
      if (!dialog) {
        return;
      }
      const preferred =
        dialog.querySelector<HTMLElement>('[data-autofocus="true"]:not(:disabled)') ??
        getVisibleFocusableElements(dialog)[0];
      preferred?.focus({ preventScroll: true });
    };

    focusInitial();

    const handleFocusIn = (event: FocusEvent) => {
      const currentDialog = dialogRef.current;
      if (!currentDialog) {
        return;
      }
      const target = event.target;
      if (target instanceof Node && !currentDialog.contains(target)) {
        const preferred =
          currentDialog.querySelector<HTMLElement>('[data-autofocus="true"]:not(:disabled)') ??
          getVisibleFocusableElements(currentDialog)[0];
        preferred?.focus({ preventScroll: true });
      }
    };

    document.addEventListener("focusin", handleFocusIn);

    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      for (const el of inertTargets) {
        el.inert = false;
      }
      if (previousFocused?.isConnected) {
        previousFocused.focus({ preventScroll: true });
      }
    };
  }, [dialogRef]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        if (event.key === "Enter" || event.key === " " || event.key === "Tab") {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      const dialog = dialogRef.current;
      if (!dialog) {
        return;
      }

      if (event.key === "Tab") {
        const focusables = getVisibleFocusableElements(dialog);
        event.preventDefault();
        event.stopPropagation();
        if (focusables.length === 0) {
          return;
        }

        const active =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const currentIndex = active && dialog.contains(active) ? focusables.indexOf(active) : -1;

        const nextIndex = event.shiftKey
          ? currentIndex <= 0
            ? focusables.length - 1
            : currentIndex - 1
          : currentIndex < 0 || currentIndex >= focusables.length - 1
            ? 0
            : currentIndex + 1;

        focusables[nextIndex]?.focus({ preventScroll: true });
        return;
      }

      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "ArrowRight" ||
        event.key === "ArrowLeft"
      ) {
        const optionButtons = Array.from(
          dialog.querySelectorAll<HTMLElement>('[data-modal-option="true"]:not(:disabled)'),
        );
        const candidates =
          optionButtons.length > 0 ? optionButtons : getVisibleFocusableElements(dialog);
        if (candidates.length > 0) {
          event.preventDefault();
          event.stopPropagation();
          const active =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
          const currentIndex = active ? candidates.indexOf(active) : -1;
          const moveForward = event.key === "ArrowDown" || event.key === "ArrowRight";
          const nextIndex = moveForward
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
        event.stopPropagation();
        onDefaultEnter();
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [dialogRef]);
}
