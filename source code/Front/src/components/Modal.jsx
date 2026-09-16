import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
// Stack of open dialogs: only the topmost one reacts to keyboard events
const openDialogs = [];

export default function Modal({ title, subtitle, onClose, children, footer, size = "md", closeDisabled = false }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const closeDisabledRef = useRef(closeDisabled);

  useEffect(() => {
    onCloseRef.current = onClose;
    closeDisabledRef.current = closeDisabled;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const dialog = dialogRef.current;
    openDialogs.push(dialog);
    const first = dialog?.querySelector("[data-autofocus]") || dialog?.querySelector(FOCUSABLE);
    first?.focus();

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (openDialogs[openDialogs.length - 1] !== dialog) return;
      if (event.key === "Escape" && !closeDisabledRef.current) {
        onCloseRef.current();
      }
      if (event.key === "Tab" && dialog) {
        const items = [...dialog.querySelectorAll(FOCUSABLE)].filter((el) => !el.disabled);
        if (items.length === 0) return;
        const firstItem = items[0];
        const lastItem = items[items.length - 1];
        if (event.shiftKey && document.activeElement === firstItem) {
          event.preventDefault();
          lastItem.focus();
        } else if (!event.shiftKey && document.activeElement === lastItem) {
          event.preventDefault();
          firstItem.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      openDialogs.splice(openDialogs.indexOf(dialog), 1);
      document.body.style.overflow = originalOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !closeDisabled) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={`modal modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="modal-header">
          <div className="modal-heading">
            <h2 id={titleId} className="modal-title">
              {title}
            </h2>
            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} disabled={closeDisabled} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
