import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Event from "./Event";

export default function EventDetail() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [roleInfo, setRoleInfo] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await fetch(`/api/event/${id}`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch event");
        const data = await res.json();

        setEvent(data.event);
        setRoleInfo({
          isHost: data.isHost,
          isAttending: data.isAttending,
          isLoggedIn: data.isLoggedIn,
        });
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [id]);

  if (loading) return <p>Loading event...</p>;
  if (error) return <p>Error: {error}</p>;
  if (!event) return <p>Event not found</p>;

  return (
    <div>
      <h2>Event Details</h2>
      <Event event={event} showFull roleInfo={roleInfo} />
    </div>
  );
}
