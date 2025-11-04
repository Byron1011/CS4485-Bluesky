import { useState, useEffect } from "react";
import FlashMessage from "./FlashMessage";


export default function Login() {

  
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

    // button enabled only when both inputs are valid and not empty
    if (username.trim().length < 4 || password.trim().length < 4) valid = false;

    setErrors(newErrors);
    setIsValid(valid);
  }, [username, password, touched]);

const handleSubmit = async (e) => {
  e.preventDefault();

  try {
    const response = await fetch("/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
      credentials: "include",
    });

    const data = await response.json();

    if (!response.ok) {
      showFlash("Could not log in user. Either username or password is incorrect", "error");
      return;
    }

    showFlash("Log in successful!", "success");
    // you can redirect here:
    // navigate("/dashboard")  <-- if using react-router-dom

  } catch (err) {
    console.error("Network error:", err);
    alert("Could not connect to the server");
  }
};


  const handleBlur = (field) => {
    setTouched({ ...touched, [field]: true });
  };

  return (
    <>
    <FlashMessage
        message={flash.message}
        type={flash.type}
        onClose={clearFlash}
      />

      <div className="image-card-container">

      

      <div className="form-card-container">
        <form className="form-card" onSubmit={handleSubmit}>
          <h2>Login</h2>

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
            Login
          </button>
        </form>
      </div>

      <div className="card-img" id="login-img"></div>
    </div>

    </>
  );
}
