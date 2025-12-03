import React, { useState, useRef } from "react";
import { useNotifications } from "../NotificationContext";

const PLACEHOLDER_IMAGE = "/src/assets/image.png";

// Geocode address using Nominatim. to allow address input that converts to lat/lon
async function geocodeAddress(address) {
  const encoded = encodeURIComponent(address);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=1`;
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'BlueSky-Crisis-Intel-App' // Required by Nominatim
    }
  });
  
  if (!response.ok) {
    throw new Error("Geocoding service unavailable");
  }
  
  const data = await response.json();
  
  if (!data || data.length === 0) {
    throw new Error("Address not found. Please try a more specific address.");
  }
  
  return {
    lat: parseFloat(data[0].lat),
    lon: parseFloat(data[0].lon),
    displayName: data[0].display_name
  };
}

export default function CreateEventForm({ onCreate }) {
  const [form, setForm] = useState({
    TITLE: "",
    ADDRESS: "",
    CITY: "",
    STATE: "",
    ZIP: "",
    DESCRIPTION: "",
    START_TIME: "",
    END_TIME: "",
    MAX_ATTENDEES: "",
    IMAGE: "",
  });

  const { notify } = useNotifications();
  const [useFile, setUseFile] = useState(false);
  const [message, setMessage] = useState("");
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodedAddress, setGeocodedAddress] = useState(null);
  const fileInputRef = useRef(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));

    // Clear geocoded address when address fields change
    if (["ADDRESS", "CITY", "STATE", "ZIP"].includes(name)) {
      setGeocodedAddress(null);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file (png, jpg, webp, etc).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, IMAGE: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  // Build full address string
  const buildFullAddress = () => {
    const parts = [
      form.ADDRESS,
      form.CITY,
      form.STATE,
      form.ZIP
    ].filter(Boolean);
    return parts.join(", ");
  };

  // Preview/verify address
  const handleVerifyAddress = async () => {
    const fullAddress = buildFullAddress();
    
    if (!fullAddress.trim()) {
      setMessage("Please enter an address to verify.");
      return;
    }

    setIsGeocoding(true);
    setMessage("");

    try {
      const result = await geocodeAddress(fullAddress);
      setGeocodedAddress(result);
      setMessage(`✓ Address found: ${result.displayName}`);
    } catch (err) {
      setMessage(`✗ ${err.message}`);
      setGeocodedAddress(null);
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    //changed a lot of messages here because thought they would notify. dont think its fully working
    //still using browser messages due to required attributes
    if (!form.TITLE || !form.ADDRESS || !form.START_TIME || !form.END_TIME) {
      notify({
        type: "error",
        text: "Please fill in all required fields (Title, Address, Start Time, End Time)."
      });
      return;
    }

    if (new Date(form.END_TIME) <= new Date(form.START_TIME)) {
      notify({
        type: "error",
        text: "End Time must be after Start Time."
      });
      return;
    }

    setIsGeocoding(true);
    notify({
        type: "info",
        text: "Looking up address..."
      });
    //setMessage("Looking up address..."); //took away messages like this replaced wtih notify

    try {
      // Geocode the address if not already done
      let coordinates = geocodedAddress;
      if (!coordinates) {
        const fullAddress = buildFullAddress();
        coordinates = await geocodeAddress(fullAddress);
      }

      const eventData = {
        eventName: form.TITLE,
        description: form.DESCRIPTION,
        eventDate: form.START_TIME,
        location: {
          type: "Point",
          coordinates: [coordinates.lon, coordinates.lat],
        },
        address: buildFullAddress(), 
        image: form.IMAGE || undefined,
        maxAttendees: form.MAX_ATTENDEES ? Number(form.MAX_ATTENDEES) : undefined,
      };

      const response = await fetch("/api/event/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventData),
        credentials: "include",
      });

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        notify({
          type: "error",
          text: data.error || "Failed to create event"
        });
        return;
      }

      onCreate?.(data);

      // Reset form
      setForm({
        TITLE: "",
        ADDRESS: "",
        CITY: "",
        STATE: "",
        ZIP: "",
        DESCRIPTION: "",
        START_TIME: "",
        END_TIME: "",
        MAX_ATTENDEES: "",
        IMAGE: "",
      });
      setUseFile(false);
      setGeocodedAddress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

    } catch (err) {
      setMessage(`Error: ${err.message}`);
      notify({
        type: "error",
        text: err.message || "Something went wrong while creating the event."
      });
    } finally {
      setIsGeocoding(false);
    }
  };

  return ( //add noValidate on the line below to only use notifications instead of browser
    <form onSubmit={handleSubmit} className="event-form"> 
      <h2>Create Event</h2>

      <div className="form-group">
        <label className="form-label">Event Title *</label>
        <input
          type="text"
          name="TITLE"
          value={form.TITLE}
          onChange={handleChange}
          placeholder="Enter event title"
          required
          className="form-input"
        />
      </div>

      {/* Address Section */}
      <div className="form-section">
        <label className="form-label section-label">Event Location *</label>
        
        <input
          type="text"
          name="ADDRESS"
          value={form.ADDRESS}
          onChange={handleChange}
          placeholder="Street Address (e.g., 123 Main St)"
          required
          className="form-input"
        />

        <div className="address-row">
          <input
            type="text"
            name="CITY"
            value={form.CITY}
            onChange={handleChange}
            placeholder="City"
            className="form-input"
          />
          <input
            type="text"
            name="STATE"
            value={form.STATE}
            onChange={handleChange}
            placeholder="State"
            className="form-input form-input--short"
          />
          <input
            type="text"
            name="ZIP"
            value={form.ZIP}
            onChange={handleChange}
            placeholder="ZIP"
            className="form-input form-input--short"
          />
        </div>

        <button
          type="button"
          onClick={handleVerifyAddress}
          disabled={isGeocoding}
          className="verify-btn"
        >
          {isGeocoding ? "Verifying..." : "Verify Address"}
        </button>

        {geocodedAddress && (
          <div className="address-verified">
            ✓ Location verified
          </div>
        )}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Start Time:* Month/Day/Year, Time: AM or PM </label>
          <input
            type="datetime-local"
            name="START_TIME"
            value={form.START_TIME}
            onChange={handleChange}
            required
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label className="form-label">End Time:* </label>
          <input
            type="datetime-local"
            name="END_TIME"
            value={form.END_TIME}
            onChange={handleChange}
            required
            className="form-input"
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Max Attendees (optional)</label>
        <input
          type="number"
          name="MAX_ATTENDEES"
          value={form.MAX_ATTENDEES}
          onChange={handleChange}
          placeholder="Leave blank for unlimited"
          min={1}
          className="form-input"
        />
      </div>

      <div className="form-group">
        <label className="form-label">Description (optional)</label>
        <textarea
          name="DESCRIPTION"
          value={form.DESCRIPTION}
          onChange={handleChange}
          placeholder="Describe your event..."
          className="form-textarea"
        />
      </div>

      {/* Image Section */}
      <div className="image-section">
        <div className="image-preview">
          <img
            src={form.IMAGE || PLACEHOLDER_IMAGE}
            alt="Preview"
            style={{ width: "160px", height: "160px" }}
            className="preview-img"
          />
        </div>

        <div className="image-controls">
          <label className="form-label">Event Image (optional)</label>

          <div className="input-toggle">
            {useFile ? (
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="file-input"
              />
            ) : (
              <input
                type="text"
                name="IMAGE"
                value={form.IMAGE}
                onChange={handleChange}
                placeholder="Image URL"
                className="form-input"
              />
            )}
          </div>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={useFile}
              onChange={(e) => {
                const next = e.target.checked;
                setUseFile(next);
                if (!next && fileInputRef.current) fileInputRef.current.value = "";
                if (next) setForm((prev) => ({ ...prev, IMAGE: "" }));
              }}
            />
            Upload from this computer
          </label>
        </div>
      </div>

      {message && (
        <p className={`status-text ${message.startsWith("✓") || message.includes("success") ? "success" : message.startsWith("✗") || message.startsWith("Error") ? "error" : ""}`}>
          {message}
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="submit-button" disabled={isGeocoding}>
          {isGeocoding ? "Creating..." : "Create Event"}
        </button>
      </div>
    </form>
  );
}
