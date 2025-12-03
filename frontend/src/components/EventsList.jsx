import React from "react";
import placeholderImg from "../assets/image.png";
import { Users, MapPin, Clock } from "lucide-react";

export default function EventsList({ events, onJoin, onLeave, onDelete }) {
  if (!events?.length) {
    return (
      <div className="events-list-container">
        <p className="no-events">
          No events yet. Be the first to create one!
        </p>
      </div>
    );
  }

  return (
    <div className="events-list-container">
      <div className="events-list">
        {events.map((event) => {
          const attendeesCount = event.attendees?.length ?? 0;

          // Format location: prefer address
          const locationText = event.address 
            ? event.address
            : event.location?.coordinates?.length === 2
              ? `${event.location.coordinates[1].toFixed(4)}, ${event.location.coordinates[0].toFixed(4)}`
              : "Location TBD";

          return (
            <div key={event._id} className="event-card">
              <img
                src={event.image || placeholderImg}
                alt={event.eventName}
                className="event-image"
              />
              <div className="event-info">
                <h2 className="event-title">{event.eventName}</h2>
                
                <p className="event-location">
                  <MapPin size={16} className="icon" />
                  <span>{locationText}</span>
                </p>
                
                {event.description && (
                  <p className="event-description">{event.description}</p>
                )}
                
                <p className="event-time">
                  <Clock size={16} className="icon" />
                  <span>
                    {event.eventDate
                      ? new Date(event.eventDate).toLocaleString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })
                      : "Date TBD"}
                  </span>
                </p>
                
                <p className="event-attendees">
                  <Users size={16} className="icon" />
                  <span>{attendeesCount} attending</span>
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
                      Delete Event
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
