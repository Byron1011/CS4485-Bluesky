import React, { useState, useRef } from "react";

const PLACEHOLDER_IMAGE = "/src/assets/image.png";

export default function CreateEventForm({ onCreate }) {
const [form, setForm] = useState({
TITLE: "",
LOCATION: "",
DESCRIPTION: "",
START_TIME: "",
END_TIME: "",
MAX_ATTENDEES: "",
IMAGE: "",
});

const [useFile, setUseFile] = useState(false);
const fileInputRef = useRef(null);

const handleChange = (e) => {
const { name, value } = e.target;
setForm((prev) => ({ ...prev, [name]: value }));
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

const handleSubmit = (e) => {
e.preventDefault();
if (!form.TITLE || !form.LOCATION || !form.START_TIME || !form.END_TIME) {
alert("Please fill in all required fields.");
return;
}
if (new Date(form.END_TIME) <= new Date(form.START_TIME)) {
alert("End Time must be after Start Time.");
return;
}


onCreate({
  id: Date.now(),
  ...form,
  ATTENDEES: 0,
  MAX_ATTENDEES: parseInt(form.MAX_ATTENDEES) || 10,
  USER_ATTENDING: false,
});

setForm({
  TITLE: "",
  LOCATION: "",
  DESCRIPTION: "",
  START_TIME: "",
  END_TIME: "",
  MAX_ATTENDEES: "",
  IMAGE: "",
});

setUseFile(false);
if (fileInputRef.current) fileInputRef.current.value = "";


};

return ( <form onSubmit={handleSubmit} className="event-form"> <h2>Create Event</h2>


  <input
    type="text"
    name="TITLE"
    value={form.TITLE}
    onChange={handleChange}
    placeholder="Title"
    required
    className="form-input"
  />

  <input
    type="text"
    name="LOCATION"
    value={form.LOCATION}
    onChange={handleChange}
    placeholder="Location"
    required
    className="form-input"
  />

  <label>Start Time</label>
  <input
    type="datetime-local"
    name="START_TIME"
    value={form.START_TIME}
    onChange={handleChange}
    required
    className="form-input"
  />

  <label>End Time</label>
  <input
    type="datetime-local"
    name="END_TIME"
    value={form.END_TIME}
    onChange={handleChange}
    required
    className="form-input"
  />

  <input
    type="number"
    name="MAX_ATTENDEES"
    value={form.MAX_ATTENDEES}
    onChange={handleChange}
    placeholder="Max Attendees"
    min={1}
    className="form-input"
  />

  <textarea
    name="DESCRIPTION"
    value={form.DESCRIPTION}
    onChange={handleChange}
    placeholder="Description (optional)"
    className="form-textarea"
  />

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
      <label>Upload Image ( .png, .jpg, .webp )</label>

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
        This Computer
      </label>
    </div>
  </div>

  <div className="form-actions">
    <button type="submit" className="submit-button">
      Create Event
    </button>
  </div>
</form>


);
}
