import React from "react";
import { Link, useNavigate } from "react-router-dom";
import CreateEventForm from "./components/CreateEventForm.jsx";

export default function CreateEventPage() {
  const navigate = useNavigate();

  const handleCreate = (newEvent) => {
    console.log("TODO: send to backend", newEvent);
    navigate("/events/index");
  };

  return (
    <div className="create-event-page">
      <Link to="/events/index" className="back-link">
        ← Back to Events
      </Link>
      <CreateEventForm onCreate={handleCreate} />
    </div>
  );
}
