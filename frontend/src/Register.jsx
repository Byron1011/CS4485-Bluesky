import { useState, useEffect } from "react";
import FlashMessage from "./FlashMessage";

export default function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({ username: false, password: false });
  const [errors, setErrors] = useState({ username: "", password: "" });
  const [isValid, setIsValid] = useState(false);
  const [flash, setFlash] = useState({ message: "", type: "" });
  
  const showFlash = (msg, type = "info") => setFlash({ message: msg, type });
  const clearFlash = () => setFlash({ message: "", type: "" });


  // --- Validation logic ---
  useEffect(() => {
    const newErrors = { username: "", password: "" };
    let valid = true;

    if (touched.username) {
      if (username.trim().length === 0) {
        newErrors.username = "Username cannot be empty";
        valid = false;
      } else if (username.trim().length < 4) {
        newErrors.username = "Username must be at least 4 characters long";
        valid = false;
      }
    }

    if (touched.password) {
      if (password.trim().length === 0) {
        newErrors.password = "Password cannot be empty";
        valid = false;
      } else if (password.trim().length < 4) {
        newErrors.password = "Password must be at least 4 characters long";
        valid = false;
      }
    }

    if (username.trim().length < 4 || password.trim().length < 4) valid = false;

    setErrors(newErrors);
    setIsValid(valid);
  }, [username, password, touched]);

  const handleBlur = (field) => {
    setTouched({ ...touched, [field]: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch("/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password, role: "user" }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        showFlash("Could not register the user", "error");
        return;
      }

      showFlash("Welcome aboard! You have been registered successfully", "success");
      // Optionally redirect here: navigate("/login")
    } catch (err) {
      showFlash("Could not connect to server", "error");
      console.log(err);
    }
  };

  return (

    <>
      <FlashMessage
              message={flash.message}
              type={flash.type}
              onClose={clearFlash}
            />

        <div className="image-card-container">
      <div className="card-img" id="register-img"></div>

      <div className="form-card-container">
        <form className="form-card" onSubmit={handleSubmit}>
          <h2>Register</h2>

          {/* USERNAME FIELD */}
          <div className="input-group">
            {touched.username && errors.username ? (
              <p className="error-text">{errors.username}</p>
            ) : (
              <p className="error-text hidden-text">placeholder</p>
            )}
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => handleBlur("username")}
              className={touched.username && errors.username ? "invalid" : ""}
            />
          </div>

          {/* PASSWORD FIELD */}
          <div className="input-group">
            {touched.password && errors.password ? (
              <p className="error-text">{errors.password}</p>
            ) : (
              <p className="error-text hidden-text">placeholder</p>
            )}
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => handleBlur("password")}
              className={touched.password && errors.password ? "invalid" : ""}
            />
          </div>

          <button type="submit" disabled={!isValid}>
            Register
          </button>
        </form>
      </div>
    </div>
    </>
    
  );
}
