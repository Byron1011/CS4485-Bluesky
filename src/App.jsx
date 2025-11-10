import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ChatIndex from "./pages/ChatIndex";
import ChatView from "./components/ChatView";
import "./index.css";

export default function App() {
  return (
    <Router>
      <div className="app-container">
        <header className="header">
          <h1>Natural Disaster Tracking</h1>
          <button className="login-btn">Login</button>
        </header>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<ChatIndex />} />
            <Route path="/chat/:username" element={<ChatView />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
