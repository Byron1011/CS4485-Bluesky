import React from "react";
import { Users, MapPin, Clock } from "lucide-react";

function formatDate(isoString) {
const date = new Date(isoString);
const options = {
weekday: "short",
month: "short",
day: "numeric",
hour: "numeric",
minute: "2-digit",
};
return date.toLocaleString(undefined, options);
}

const PLACEHOLDER_IMAGE = "/src/assets/image.png";

export default function EventsList({ events, onJoin, onLeave }) {
if (!events || events.length === 0) {
return <p className="no-events">No events yet.</p>;
}

return ( <div className="events-list">
{events.map((event) => ( <div key={event.id} className="event-card">
<img
src={event.IMAGE || PLACEHOLDER_IMAGE}
style={{ width: "160px", height: "160px" }}  
alt={event.TITLE}
className="event-image"
/> <div className="event-info"> <h2 className="event-title">{event.TITLE}</h2> <p className="event-location"> <MapPin size={16} className="icon" /> {event.LOCATION} </p>
{event.DESCRIPTION && <p className="event-description">{event.DESCRIPTION}</p>} <p className="event-time"> <Clock size={16} className="icon" /> {formatDate(event.START_TIME)} – {formatDate(event.END_TIME)} </p> <p className="event-attendees"> <Users size={16} className="icon" /> {event.ATTENDEES}/{event.MAX_ATTENDEES} attending </p>
<button
className={event.USER_ATTENDING ? "leave-button" : "join-button"}
onClick={() => event.USER_ATTENDING ? onLeave(event.id) : onJoin(event.id)}
disabled={!event.USER_ATTENDING && event.ATTENDEES >= event.MAX_ATTENDEES}
>
{event.USER_ATTENDING ? "Leave" : "Join"} </button> </div> </div>
))} </div>
);
}
