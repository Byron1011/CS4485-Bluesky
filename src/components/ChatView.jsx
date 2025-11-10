import { useState } from "react";
import { useParams, Link } from "react-router-dom";

export default function ChatView() {
  const { username } = useParams();
  const [messages, setMessages] = useState([
    { sender: "me", text: `Hello, ${username}!` },
    { sender: username, text: "Hi! How can I help you?" },
  ]);
  const [input, setInput] = useState("");

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages([...messages, { sender: "me", text: input }]);
    setInput("");
  };

  return (
    <div className="chat-view">
      <Link to="/" className="back-link">
        ← Back to Chats
      </Link>
      <h2 className="chat-username">{username}</h2>

      <div className="chat-box">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`message ${
              msg.sender === "me" ? "sent" : "received"
            }`}
          >
            {msg.text}
          </div>
        ))}
      </div>

      <div className="input-container">
        <input
          type="text"
          placeholder="Type a message..."
          className="message-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button onClick={sendMessage} className="send-btn">
          Send
        </button>
      </div>
    </div>
  );
}
