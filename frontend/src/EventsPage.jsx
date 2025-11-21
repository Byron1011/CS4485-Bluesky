import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import EventsList from "./components/EventsList.jsx";
import { useAuth } from "./AuthContext.jsx";

export default function EventsPage() {
  const { user } = useAuth();
  const currentUserId = user?._id || user?.id;
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
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
      if (!currentUserId) return;      // user 로딩 끝난 뒤에만 실행
      fetchEvents();
    }, [currentUserId]);

  const handleJoin = async (id) => {
    await fetch(`/api/event/${id}/join`, {
      method: "POST",
      credentials: "include",
    });
    fetchEvents();
  };

  const handleLeave = async (id) => {
    await fetch(`/api/event/${id}/leave`, {
      method: "POST",
      credentials: "include",
    });
    fetchEvents();
  };

  const handleDelete = async (id) => {
    await fetch(`/api/event/${id}/cancel`, {
      method: "POST",
      credentials: "include",
    });
    fetchEvents();
  };

  if (loading) return <p className="status-text">Loading events…</p>;
  if (error) return <p className="status-text error">{error}</p>;

  return (
    <div className="page-wrapper">
      <div className="events-header">
        <h1>Events</h1>
        <div className="events-actions">
          <Link to="/events/new" className="create-button">
            + Create Event
          </Link>
        </div>
      </div>
      <EventsList
        events={events}
        onJoin={handleJoin}
        onLeave={handleLeave}
        onDelete={handleDelete}
      />
    </div>
  );
}
