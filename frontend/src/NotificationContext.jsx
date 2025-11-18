import { createContext, useContext, useState, useCallback } from "react";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [items, setItems] = useState([]);

  const notify = useCallback((opts) => {
    const {
      text,
      type = "info",        // "success" | "error" | "info"
      duration = 4000,      // ms, 0 = stay until closed
    } = opts || {};

    if (!text) return;

    const id = Date.now() + Math.random();

    const item = { id, type, text };
    setItems((prev) => [...prev, item]);

    if (duration > 0) {
      setTimeout(() => {
        setItems((prev) => prev.filter((n) => n.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const remove = useCallback((id) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ items, notify, remove }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within <NotificationProvider>");
  return ctx;
}