import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

import User from "./user_schema.js";
import Event from "./event_schema.js";

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
    res.status(401).json({ error: "Must log in to complete action."});
    return;
  }

  try {
    console.log(token);
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    req.user = decoded;


    next();
    return;
  } catch (err) {
    res.status(401).json({ error: "Must log in to complete action."});
  }
}

// Middleware sets req.user if logged in, but does not stop / redirect request if they are not

async function optionalAuth (req, res, next) {
  const authHeader = req.headers.authorization || req.cookies?.token;

  if (!authHeader) {
    req.user = null;
    return next(); // not logged in
  }

  try {
    // support both "Bearer <token>" and direct cookie token
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : authHeader;

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    req.user = await User.findById(decoded.id).select("_id username");
  } catch {
    req.user = null; // invalid token
  }


  if(req.user)
    console.log(`user is logged in ${req.user}`);
  else 
    console.log("User not logged in");
  next();
};


// Middleware to see if request comes from a logged in Admin
function isAdmin(req, res, next) {

  // In case isLoggedIn middleware was not used before

  isLoggedIn(req, res, (err) => {
    if (err) return; // verifyToken already sent response on error

    // If verifyToken succeeded:
    if (req.user?.role !== "admin") {
      res.status(402).json({ error: "Higher status needed to complete the request."});
    }

    next();
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

// CREATE NEW EVENT
app.post("/api/event/new", isLoggedIn, async(req, res) => {

  const user_info = req.user;

  const user = await User.findById(user_info.id);


  if(!user) {
    console.log("ruh roh")
    return
  }
  let {eventName, description, location, eventDate} = req.body;

  

  const event = new Event({
    eventName,
    description,
    location,
    eventDate,
    host : user,
    
  });


  user.eventsHosting.push(event);

  console.log("==========EVENT==========");
  console.log(event);
  console.log();

  console.log("=======================USER===============");
  console.log(user);

  await user.save();
  await event.save()


  res.status(200).json({message: "event created successfully", eventId: event.id});
});


// GET INFO FOR ONE EVENT
app.get("/api/event/:id", optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id)
      .populate("host", "username _id")
      .populate("attendees", "username _id");

    if (!event) return res.status(403).json({ error: "Event not found" });

    let isHost = false;
    let isAttending = false;
    let isLoggedIn = false;

    console.log(req.user);

    if (req.user) {
      const userId = req.user._id;
      isLoggedIn = true;
      isHost = event.host?._id.equals(userId);
      isAttending = event.attendees.some((a) => a._id.equals(userId));
    }

    res.json({
      event,
      isHost,
      isAttending,
      isLoggedIn,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch event" });
  }
});

// JOIN EVENT
app.post("/api/event/:id/join", isLoggedIn, async (req, res) => {
  const user_info = req.user;
  const userId = user_info.id;

  const user = await User.findById(userId);

  const eventId = req.params.id;
  const event = await Event.findById(eventId)
      .populate("host", "username _id")
      .populate("attendees", "username _id");

  // could not find event info 
  if (!event) {
    res.status(400).json({error: "could not find the event"});
    return;
  }

  // could not get user info
  if (!user) {
    res.status(400).json({ error : "could not find logged in user\'s information"});
    return;
  }

  // if user is already attending the event
  if(event.attendees.some((a) => a._id.equals(userId))) {
    res.status(400).json({ error : "user is already attending event, cannot join again"});
    return;
  }

  // if user is the event's host
  if(event.host?._id.equals(userId)){
    res.status(400).json({ error : "cannot join your own event!"});
    return;
  }



  user.eventsAttending.push(event);

  event.attendees.push(user);

  await user.save();
  await event.save();


  res.status(200).json({ message : "successfully joined the event" });
});

// LEAVE EVENT
app.post("/api/event/:id/leave", isLoggedIn, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });

    // Prevent host from "leaving" their own event
    if (event.host.equals(userId)) {
      return res.status(400).json({ error: "Host cannot leave their own event" });
    }

    // Remove user from event's attendees
    await Event.findByIdAndUpdate(eventId, {
      $pull: { attendees: userId },
    });

    // Optional: also remove event from user's attending list
    await User.findByIdAndUpdate(userId, {
      $pull: { eventsAttending: eventId },
    });

    res.status(200).json({ message: "You have left the event" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to leave event" });
  }
});


// app.post("/api/event/:id/leave", isLoggedIn, async (req, res) => {
//   res.status(200).json({ message : "got to LEAVE event route" });
// });

// CANCEL EVENT
app.post("/api/event/:id/cancel", isLoggedIn, async (req, res) => {
  try {
    const { id: eventId } = req.params;
    const userId = req.user.id; // From isLoggedIn middleware

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });

    // Check if the user is the host
    if (!event.host.equals(userId)) {
      return res.status(403).json({ error: "Only the host can cancel this event" });
    }

    // Remove event reference from all attendees
    if (event.attendees.length > 0) {
      await User.updateMany(
        { _id: { $in: event.attendees } },
        { $pull: { eventsAttending: event._id } }
      );
    }

    // Remove event reference from host’s eventsHosting list
    await User.findByIdAndUpdate(userId, {
      $pull: { eventsHosting: event._id },
    });

    // Finally, delete the event itself
    await Event.findByIdAndDelete(event._id);

    res.status(200).json({ message: "Event cancelled and removed successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to cancel event" });
  }
});


// app.post("/api/event/:id/cancel", isLoggedIn, async (req, res) => {
//   console.log("sneaky");
//   res.status(200).json({ message : "got to CANCEL event route" });
// });



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