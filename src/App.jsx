import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import EventsPage from "./pages/EventsPage";
import CreateEventPage from "./pages/CreateEventPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/events" replace />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/create" element={<CreateEventPage />} />
      </Routes>
    </Router>
  );
}
