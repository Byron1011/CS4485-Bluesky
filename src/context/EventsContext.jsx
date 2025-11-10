import React, { createContext, useContext, useState, useEffect } from "react";

const EventsContext = createContext();

export function EventsProvider({ children }) {
  const [events, setEvents] = useState(() => {
    // Load from localStorage on initial mount
    const saved = localStorage.getItem("events");
    return saved ? JSON.parse(saved) : [];
  });

  // Persist whenever events change
  useEffect(() => {
    localStorage.setItem("events", JSON.stringify(events));
  }, [events]);

  const addEvent = (newEvent) => {
    setEvents((prev) => [...prev, newEvent]);
  };

  const joinEvent = (id) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              ATTENDEES: Math.min(e.ATTENDEES + 1, e.MAX_ATTENDEES),
              USER_ATTENDING: true,
            }
          : e
      )
    );
  };

  const leaveEvent = (id) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, ATTENDEES: Math.max(e.ATTENDEES - 1, 0), USER_ATTENDING: false }
          : e
      )
    );
  };

  const clearEvents = () => {
    setEvents([]);
    localStorage.removeItem("events");
  };

  return (
    <EventsContext.Provider
      value={{ events, addEvent, joinEvent, leaveEvent, clearEvents }}
    >
      {children}
    </EventsContext.Provider>
  );
}

export function useEvents() {
  return useContext(EventsContext);
}
