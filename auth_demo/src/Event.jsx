import { useState } from "react";

/**
 * Event component
 * Props:
 *  - event: object (event data)
 *  - showFull: boolean (whether to show detailed info)
 *  - roleInfo: { isHost: bool, isAttending: bool, isLoggedIn: bool }
 */
export default function Event({ event, showFull = false, roleInfo = {} }) {
  const [localEvent, setLocalEvent] = useState(event);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  if (!localEvent) return null;

  const { isHost, isAttending, isLoggedIn } = roleInfo;

  const handleAction = async (action) => {
    try {
      setLoading(true);
      setMessage("");

      // Redirect to login if not logged in
      if (!isLoggedIn && action !== "login") {
        window.location.href = "/login";
        return;
      }

      if (action === "login") {
        window.location.href = "/login";
        return;
      }

      let endpoint = "";
      if (action === "join") endpoint = `/api/event/${localEvent._id}/join`;
      if (action === "leave") endpoint = `/api/event/${localEvent._id}/leave`;
      if (action === "delete") endpoint = `/api/event/${localEvent._id}/delete`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");

      setMessage(data.message || "Success");

      // Update UI based on action
      if (action === "join") {
        setLocalEvent({
          ...localEvent,
          attendees: [...localEvent.attendees, { username: "You" }],
        });
      } else if (action === "leave") {
        setLocalEvent({
          ...localEvent,
          attendees: localEvent.attendees.filter((a) => a.username !== "You"),
        });
      } else if (action === "delete") {
        setTimeout(() => {
          window.location.href = "/events";
        }, 1000);
      }
    } catch (err) {
      console.error(err);
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Determine button label and action
  let buttonText = "";
  let buttonAction = "";

  if (!isLoggedIn) {
    buttonText = "Log in to join";
    buttonAction = "login";
  } else if (isHost) {
    buttonText = "Cancel Event";
    buttonAction = "delete";
  } else if (isAttending) {
    buttonText = "Leave Event";
    buttonAction = "leave";
  } else {
    buttonText = "Join Event";
    buttonAction = "join";
  }

  return (
    <div>
      <h3>{localEvent.eventName}</h3>

      {showFull && (
        <>
          <p>
            <strong>Date:</strong>{" "}
            {new Date(localEvent.eventDate).toLocaleDateString()}
          </p>
          <p>
            <strong>Description:</strong> {localEvent.description}
          </p>
        </>
      )}

      <p>
        <strong>Host:</strong> {localEvent.host?.username || "Unknown"}
      </p>

      {showFull && (
        <p>
          <strong>Attendees:</strong>{" "}
          {localEvent.attendees.length > 0
            ? localEvent.attendees.map((a) => a.username).join(", ")
            : "None yet"}
        </p>
      )}

      <button onClick={() => handleAction(buttonAction)} disabled={loading}>
        {loading ? "Processing..." : buttonText}
      </button>

      {message && <p>{message}</p>}

      {!showFull && (
        <a href={`/event/show/${localEvent._id}`}>View details</a>
      )}
    </div>
  );
}
