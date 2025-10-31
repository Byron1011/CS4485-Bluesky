import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

import User from "./user_schema.js";


// For use of cookies
import cookieParser from 'cookie-parser';

import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;

// funciton to create signed token for a given user
function generateSignedToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    JWT_SECRET_KEY,
    { expiresIn: "24h" }
  );
}

// Middleware to ensure request contains valid signed token (user logged in)
function isLoggedIn(req, res, next) {

  console.log(req.cookies);

  const token = req.cookies.token || (req.headers.authorization?.split(" ")[1]);
  if (!token) {
    res.redirect("/login");
    return;
  }

  try {
    console.log(token);
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    res.redirect("/login");
  }
}




// Middleware to see if request comes from a logged in Admin
function isAdmin(req, res, next) {

  // In case isLoggedIn middleware was not used before

  isLoggedIn(req, res, (err) => {
    if (err) return; // verifyToken already sent response on error

    // If verifyToken succeeded:
    if (req.user?.role !== "admin") {
      return res.send("admin access required");
    }

    res.send("You have reached the highest level.");
  });
}

const app = express();
const PORT = process.env.PORT;


import path from "path";
import { fileURLToPath } from "url";

// be able to parse JSON from requests
app.use(express.json());

// use cookie parser middleware
app.use(cookieParser());

// CUSTOM MIDDLEWARE that ensures the dark_theme attribute always exists (false by default).
// Note, not an actual boolean but a string
app.use((req, res, next) => {
  if (!req.cookies.dark_theme) {

    res.cookie("dark_theme", "false", {
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
      httpOnly: false,
      sameSite: "lax"
    });

    req.cookies.dark_theme = "false";

  }


  next();
});


app.use(cors());

// Needed if using ES modules:
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



// Tell app where to find React files
app.use(express.static(path.join(__dirname, "/auth_demo/dist")));


//****** MongoDB Atlas connection function ******
async function startDB() {
  try {


    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB')

    app.listen(PORT, () => {
      console.log(`Server started at: http://localhost:${PORT}`);

    });
  } catch (err) {
    console.error(' DB Connection failed: ', err);
    process.exit(1);
  }
}

startDB();

// REGISTER and LOGIN routes
app.post("/register", async (req, res) => {
  try {

    console.log(req.body)
    const { username, password, role } = req.body;

    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({ username, passwordHash, role });
    await user.save();

    console.log(user);

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Login
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    console.log(req.body);

    const user = await User.findOne({ username: username });


    if (!user) return res.status(404).json({ error: "User not found" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid password" });

    const token = generateSignedToken(user);

    res.cookie("token", token, {
      httpOnly: true,      // JS can't access it
      secure: false,       // true if using https
      sameSite: "strict",  // prevents CSRF
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });



    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
  });

  console.log("got here");
  res.send("Logged out successfully");
});

// route that required user to be logged in
app.get("/protected", isLoggedIn, async(req, res, next) => {
    console.log("All roads lead to Rome");
    res.send("Made it to the secret!");
})

// route that requires ADMIN level access
app.get("/sensitive", isAdmin, async(req, res, next) => {

});

// serve react index file for all other requests not handled
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "/auth_demo/dist", "index.html"));
});