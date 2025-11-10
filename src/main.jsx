import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { EventsProvider } from "./context/EventsContext";
import "./app.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <EventsProvider>
      <App />
    </EventsProvider>
  </React.StrictMode>
);
