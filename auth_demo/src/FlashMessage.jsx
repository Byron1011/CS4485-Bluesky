import { useEffect } from "react";
import "./FlashMessage.css";

export default function FlashMessage({ message, type = "info", onClose }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => onClose(), 2000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className={`flash flash-${type}`}>
      {message}
    </div>
  );
}
