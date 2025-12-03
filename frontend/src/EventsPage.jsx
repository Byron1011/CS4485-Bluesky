import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import EventsList from "./components/EventsList.jsx";
import { useAuth } from "./AuthContext.jsx";
import { useNotifications } from "./NotificationContext.jsx";
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

export default function EventsPage() {
  useEnsureTheme();
  const { user } = useAuth();
  const { notify } = useNotifications();
  const currentUserId = user?._id || user?.id;
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const attendingCount = events.filter(e => e.isAttending).length;
  const hostingCount = events.filter(e => e.isHost).length;
  
  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/event/all", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("error fetching events");
      const data = await res.json();
      setEvents(
        data.map((event) => ({
          ...event,
          isHost:
            currentUserId &&
            (event.host?._id === currentUserId || event.host === currentUserId),
          isAttending: 
            currentUserId &&
            event.attendees?.some(
                (a) => a?._id === currentUserId || a === currentUserId
              ),
      }))
    );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

    useEffect(() => {
      //if (!currentUserId) return;      // user 로딩 끝난 뒤에만 실행
      fetchEvents();
    }, [currentUserId]);

  const handleJoin = async (id) => {
    if (!currentUserId) {
      notify({
        type: "error",
        text: "You must be logged in to join an event.",
      });
      return;
    }

    try {
      const res = await fetch(`/api/event/${id}/join`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to join event");

      notify({
        type: "success",
        text: "You joined the event.",
      });

      fetchEvents();
    } catch (err) {
      console.error(err);
      notify({
        type: "error",
        text: err.message || "Could not join this event.",
      });
    }
  };

  const handleLeave = async (id) => {
    if (!currentUserId) { //safe
      notify({
        type: "error",
        text: "You must be logged in to update your attendance.",
      });
      return;
    }

    try {
      const res = await fetch(`/api/event/${id}/leave`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to leave event");

      notify({
        type: "success",
        text: "You left the event.",
      });

      fetchEvents();
    } catch (err) {
      console.error(err);
      notify({
        type: "error",
        text: err.message || "Could not leave this event.",
      });
    }
  };

  const handleDelete = async (id) => {
    if (!currentUserId) {
      notify({
        type: "error",
        text: "You must be logged in to delete an event.",
      });
      return;
    }

    try {
      const res = await fetch(`/api/event/${id}/cancel`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to delete event");

      notify({
        type: "success",
        text: "Event deleted.",
      });

      fetchEvents();
    } catch (err) {
      console.error(err);
      notify({
        type: "error",
        text: err.message || "Could not delete this event.",
      });
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="app">
          <div className="fullscreen-center">
            <span className="spinner" aria-label="Loading" />
            <span style={{ marginLeft: 10 }}>Loading events…</span>
          </div>

          <footer className="site-footer" aria-label="Footer">
            <img src={logoUrl} alt="BlueSky Crisis Intel logo" className="footer-logo" />
            <div className="footer-mark">Crisis &amp; Disaster Dashboard</div>
          </footer>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="page">
        <div className="app">
          <div className="fullscreen-center">
            <div className="error-card" role="alert">
              <strong>Couldn’t load events.</strong>
              <div style={{ marginTop: 6 }}>{String(error)}</div>
            </div>
          </div>

          <footer className="site-footer" aria-label="Footer">
            <img src={logoUrl} alt="BlueSky Crisis Intel logo" className="footer-logo" />
            <div className="footer-mark">Crisis &amp; Disaster Dashboard</div>
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="events-header">
        <h1>Events</h1>

        <div className="events-stats">
          <p>Hosting: {hostingCount}</p>
          <p>Attending: {attendingCount}</p>
          <p>Total Events: {events.length}</p>
        </div>

        {currentUserId && (
          <Link to="/events/new" className="create-button">
            Create Event
          </Link>
        )}
      </div>
      <EventsList
        events={events}
        onJoin={handleJoin}
        onLeave={handleLeave}
        onDelete={handleDelete}
      />

      <footer className="site-footer" aria-label="Footer">
                <img src={logoUrl} alt="BlueSky Crisis Intel logo" className="footer-logo" />
                <div className="footer-mark">Crisis &amp; Disaster Dashboard</div>
      </footer>
    </div>
  );
}
