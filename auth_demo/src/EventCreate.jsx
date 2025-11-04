import { useState } from "react";

export default function EventCreate() {
    const [eventName, setEventName] = useState("");
    const [eventDate, setEventDate] = useState("");
    const [description, setDescription] = useState("");
    const [message, setMessage] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();

        const eventData = {
            eventName,
            eventDate,
            description,
            location: {
                type: "Point",
                coordinates: [-118.2437, 34.0522], // Los Angeles
            },
        };

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
    };

    return (
        <div>
            <h2>Create Test Event</h2>
            <form onSubmit={handleSubmit}>
                <div>
                    <label>Event Name: </label>
                    <input
                        type="text"
                        value={eventName}
                        onChange={(e) => setEventName(e.target.value)}
                        required
                    />
                </div>

                <div>
                    <label>Event Date: </label>
                    <input
                        type="date"
                        value={eventDate}
                        onChange={(e) => setEventDate(e.target.value)}
                        required
                    />
                </div>

                <div>
                    <label>Description: </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                    />
                </div>

                <button type="submit">Create Event</button>
            </form>

            {message && <p>{message}</p>}
        </div>
    );
}
