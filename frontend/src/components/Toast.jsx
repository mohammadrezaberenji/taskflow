import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import Icon from "./Icon";

const ToastContext = createContext(null);
const DISMISS_AFTER_MS = 4000;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (type, message) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-3), { id, type, message }]);
      setTimeout(() => dismiss(id), type === "error" ? DISMISS_AFTER_MS * 1.5 : DISMISS_AFTER_MS);
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      success: (message) => show("success", message),
      error: (message) => show("error", message),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`} role={toast.type === "error" ? "alert" : "status"}>
            <Icon name={toast.type === "error" ? "alert" : "checkCircle"} size={18} />
            <span className="toast-message">{toast.message}</span>
            <button type="button" className="icon-btn icon-btn-sm" onClick={() => dismiss(toast.id)} aria-label="Dismiss">
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
