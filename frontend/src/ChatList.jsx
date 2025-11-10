import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:3000"; // adjust if needed for production

export default function ChatList() {
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    useEffect(async () => {
        // Initial fetch of existing chats

        /*
    
        try {
                const response = await fetch("/api/event/new", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(eventData),
                    credentials: "include",
                });
    
    
                // NOTE: This is where redirect to login happens
                if (response.status === 401) {
                    // user is not authorized
                    window.location.href = "/login";
                    return;
                }
    
                const data = await response.json();
    
                if (!response.ok) {
                    setMessage(`Error: ${data.error || "Failed to create event"}`);
                } else {
    
                    setMessage("Created Event!")
                    console.log(data.eventId);
                }
            } catch (err) {
                setMessage(`Request failed: ${err.message}`);
            }
    
        */
        const response = await fetch("/api/chats",
            {
                credentials: "include",
                method: "GET",
                headers: { "Content-Type": "application/json" },
            })

            if (response.status === 401) {
                    // user is not authorized
                    window.location.href = "/login";
                    return;
                }
            const data = await response.json();

            if (!response.ok) {
                    console.log(`ERROR: ${data.error}`);
                } else {
    
                    console.log("mi bomba!");
                    console.log(data);
                }
            // .then((res) => {
            //     if (!res.ok) throw new Error("Failed to load chats");

            //     const data = res.json();

            //     console.log(data);

            //     return data;
            // })
            // .then((data) => {
            //     setChats(data);
            //     setLoading(false);
            // })
            // .catch((err) => {
            //     setError(err.message);
            //     setLoading(false);
            // });

        // Connect to WebSocket
        const socket = io(SOCKET_URL, { withCredentials: true });

        // When a new chat is added
        socket.on("chat-added", (newChat) => {
            setChats((prev) => [...prev, newChat]);
        });

        // When chats are updated (new message, etc.)
        socket.on("chat-updated", (updatedChats) => {
            setChats(updatedChats);
        });

        socket.on("disconnect", () => {
            console.warn("Socket disconnected");
        });

        socket.on("dummy-event", (data) => {
            console.log(data.message);
        });

        // Cleanup on unmount
        return () => {
            socket.disconnect();
        };
    }, []);

    const handleSelectChat = (chatId) => {
        navigate(`/chat/${chatId}`);
    };

    if (loading) {
        return (
            <div className="chat-page">
                <h2>Loading chats...</h2>
                <ul className="chat-list">
                    {[...Array(5)].map((_, i) => (
                        <li key={i} className="chat-item skeleton">
                            <div className="skeleton-text"></div>
                        </li>
                    ))}
                </ul>
            </div>
        );
    }

    if (error) {
        return (
            <div className="chat-page">
                <h2>Error loading chats</h2>
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div className="chat-page">
            <h2>Your Conversations</h2>
            <ul className="chat-list">
                {chats.map((chat) => (
                    <li
                        key={chat._id || chat.id || chat.username}
                        className="chat-item"
                        onClick={() =>
                            handleSelectChat(chat._id || chat.id || chat.username)
                        }
                    >
                        {chat.name || chat.username || "Unnamed Chat"}
                    </li>
                ))}
            </ul>
        </div>
    );
}
