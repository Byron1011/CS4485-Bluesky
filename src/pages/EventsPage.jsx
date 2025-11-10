import React from "react";
import EventsList from "../components/EventsList";
import { Link } from "react-router-dom";
import { useEvents } from "../context/EventsContext";

export default function EventsPage() {
const { events, joinEvent, leaveEvent, clearEvents } = useEvents();

return ( <div className="page-wrapper"> <div className="events-header"> <h1>Events</h1> <div className="events-actions"> <Link to="/create" className="create-button">
+ Create Event </Link>
<button
onClick={clearEvents}
className="clear-button"
disabled={events.length === 0}
>
Clear All </button> </div> </div>


  <EventsList events={events} onJoin={joinEvent} onLeave={leaveEvent} />
</div>


);
}
