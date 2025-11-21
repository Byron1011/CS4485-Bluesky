import React from "react";
import placeholderImg from "../assets/image.png";
import { Users, MapPin, Clock } from "lucide-react";

const PLACEHOLDER_IMAGE = "/src/assets/image.png";

export default function EventsList({ events, onJoin, onLeave, onDelete }) {
  if (!events?.length) return <p className="no-events">No events yet.</p>;

  return (
    <div className="events-list">
      {events.map((event) => {
        const attendeesCount = event.attendees?.length ?? 0;

        return (
          <div key={event._id} className="event-card">
            <img
              src={event.image || placeholderImg}
              alt={event.eventName}
              style={{ width: "160px", height: "160px" }}
              className="event-image"
            />
            <div className="event-info">
              <h2 className="event-title">{event.eventName}</h2>
              <p className="event-location">
                <MapPin size={16} className="icon" />{" "}
                {event.location?.coordinates?.length === 2
                ? `lat: ${event.location.coordinates[1].toFixed(4)}, long: ${event.location.coordinates[0].toFixed(4)}`
                : "Unknown location"}
              </p>
              {event.description && (
                <p className="event-description">{event.description}</p>
              )}
              <p className="event-time">
                <Clock size={16} className="icon" />{" "}
                {event.eventDate
                  ? new Date(event.eventDate).toLocaleString()
                  : "No date"}{" "}
              </p>
              <p className="event-attendees">
                <Users size={16} className="icon" /> {attendeesCount} attending
              </p>
              <div className="actions">
                {!event.isHost && (
                  <button
                    className={event.isAttending ? "leave-button" : "join-button"}
                    onClick={() =>
                      event.isAttending ? onLeave?.(event._id) : onJoin?.(event._id)
                    }
                  >
                    {event.isAttending ? "Leave" : "Join"}
                  </button>
                )}

                {event.isHost && (
                  <button
                    className="delete-button"
                    onClick={() => onDelete?.(event._id)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
