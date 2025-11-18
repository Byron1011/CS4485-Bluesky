import { useNotifications } from "./NotificationContext";

export default function Notifications() {
  const { items, remove } = useNotifications();

  if (!items.length) return null;

  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="true">
      {items.map((n) => (
        <div
          key={n.id}
          className={`toast toast--${n.type}`}
          role="status"
        >
          <span>{n.text}</span>
          <button
            type="button"
            className="toast-close"
            aria-label="Dismiss notification"
            onClick={() => remove(n.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}