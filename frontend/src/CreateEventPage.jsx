import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import CreateEventForm from "./components/CreateEventForm.jsx";
import { useNotifications } from "./NotificationContext";
import logoUrl from './assets/logo.png';


function useEnsureTheme() {
    useEffect(() => {
        const cookie = document.cookie || "";
        const isDark = /(?:^|;\s*)dark_theme=true(?:;|$)/.test(cookie);
        const root = document.documentElement;
        if (isDark) root.classList.add("dark-theme");
        else root.classList.remove("dark-theme");
    }, []);
}

export default function CreateEventPage() {
  useEnsureTheme();
  const navigate = useNavigate();
  const { notify } = useNotifications();

  const handleCreate = (newEvent) => {
    notify({
      type: "success",
      text: "Event created successfully!"
    });
    navigate("/events/index");
  };

  return (
    <div className="create-event-page">
      <Link to="/events/index" className="back-link">
        ← Back to Events
      </Link>
      <CreateEventForm onCreate={handleCreate} />

      <footer className="site-footer" aria-label="Footer">
                <img src={logoUrl} alt="BlueSky Crisis Intel logo" className="footer-logo" />
                <div className="footer-mark">Crisis &amp; Disaster Dashboard</div>
      </footer>
    </div>
  );
}