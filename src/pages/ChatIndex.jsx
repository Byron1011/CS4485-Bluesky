import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ChatList from "../components/ChatList";

const mockChats = ["John Doe", "Jane Smith", "Robert Brown"];

export default function ChatIndex() {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const filtered = mockChats.filter((name) =>
    name.toLowerCase().includes(search.toLowerCase())
  );

  const startChat = () => {
    if (search.trim()) navigate(`/chat/${encodeURIComponent(search)}`);
  };

  const openChat = (username) => {
    navigate(`/chat/${encodeURIComponent(username)}`);
  };

  return (
    <div className="chat-index">
      <div className="search-container">
        <input
          type="text"
          placeholder="Search by username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <button onClick={startChat} className="chat-btn">
          Chat
        </button>
      </div>

      <h2 className="section-title">Chats</h2>
      <ChatList chats={filtered} onSelectChat={openChat} />
    </div>
  );
}
