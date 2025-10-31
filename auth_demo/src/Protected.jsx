import { useState } from "react";
import FlashMessage from "./FlashMessage";

export default function LogoutTest() {
  const [flash, setFlash] = useState({ message: "", type: "" });

  const showFlash = (msg, type = "info") => setFlash({ message: msg, type });
  const clearFlash = () => setFlash({ message: "", type: "" });

  const handleLogout = async () => {
    try {
      const res = await fetch("/logout", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        showFlash(data.error || "Logout failed", "error");
        return;
      }

      showFlash(data.message || "Logged out successfully", "success");
    } catch (err) {
      showFlash("Could not connect to server", "error");
    }
  };

  return (
    <div className="logout-test">
      <FlashMessage message={flash.message} type={flash.type} onClose={clearFlash} />
      <h2>Logout Test</h2>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}
