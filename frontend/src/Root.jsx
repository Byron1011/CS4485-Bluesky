import { Routes, Route, Navigate } from "react-router-dom";
import App from "./App.jsx";    
import Login from "./Login.jsx";
import Register from "./Register.jsx";
import Protected from "./Protected.jsx";
import Analytics from "./components/Analytics.jsx";
import Topbar from "./components/TopBar.jsx";
import User from "./User.jsx";
import ChatList from "./ChatList.jsx";
import EventsPage from "./EventsPage.jsx";
import CreateEventPage from "./CreateEventPage.jsx";


export default function Root() {
  return (
    <>
      <Topbar />
      <Routes>
        {/* default → dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* pages */}
        <Route path="/chats/index" element={<ChatList />} />         {/* Dashboard page */}
        <Route path="/dashboard" element={<App />} />         {/* Dashboard page */}
        <Route path="/analytics" element={<Analytics />} />   {/* Analytics page */}
        <Route path="/events/index" element={<EventsPage />} /> {/* Events page */}
        <Route path="/events/new" element={<CreateEventPage />} /> {/* New event page */}
        <Route path="/protected" element={<Protected />} />    {/* protected page */}
        <Route path="/user" element={<User />} />           {/* user page */}

        {/* anything else → dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}