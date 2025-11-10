import React from "react";
import CreateEventForm from "../components/CreateEventForm";
import { Link, useNavigate } from "react-router-dom";
import { useEvents } from "../context/EventsContext";

export default function CreateEventPage() {
const { addEvent } = useEvents();
const navigate = useNavigate();

const handleCreate = (newEvent) => {
addEvent(newEvent);
navigate("/events");
};

return ( <div className="create-event-page"> <Link to="/events" className="back-link">
← Back to Events </Link> <CreateEventForm onCreate={handleCreate} /> </div>
);
}
