import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import Post from './post_schema.js';
import Resource from "./resource_schema.js";

// For use of cookies
import cookieParser from 'cookie-parser';
import User from "./user_schema.js";

import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import Chat from "./chat_schema.js";
import Message from "./message_schema.js";

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
const PYTHON_PORT = process.env.PYTHON_PORT;

import path from "path";
import { fileURLToPath } from "url";

// be able to parse JSON from requests
app.use(express.json());

// use cookie parser middleware
app.use(cookieParser());

// CUSTOM MIDDLEWARE that ensures the dark_theme attribute always exists (false by default).
// Note, not an actual boolean but a string
app.use((req, res, next) => {
  if(!req.cookies.dark_theme) {
    
    res.cookie("dark_theme", "false", {
      maxAge : 1000 * 60 * 60 * 24 * 365, // 1 year
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
app.use(express.static(path.join(__dirname, "/frontend/dist")));


//****** MongoDB Atlas connection function ******
async function start(){
  try{

    // NOTE todo UNCOMMENT
    
    await mongoose.connect (process.env.MONGO_URI);
    console.log('Connected to DB')

    // Create TTL index: automatically delete posts 14 days after 'createdAt'
    const ttlDays = 14;
    const ttlSeconds = ttlDays * 24 * 60 * 60;

    // Ensure index exists on the 'createdAt' field
    await Post.collection.createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: ttlSeconds }
    );

    console.log(`TTL index created on Post.createdAt (expires after ${ttlDays} days)`);
    
    app.listen(PORT, () => {
    console.log(`Server started at: http://localhost:${PORT}`);
    // console.log(`Search & Save: /search-save?q=<disaster type> &limit= <~100>`)
    // console.log(`EXAMPLE:  /search-save?q=flood&limit=50`);
    // console.log(`List: /posts?type= <disaster type> &from=<date from>T00:00Z&to=<date to>T23:59:59.999Z`)
    // console.log(`EXAMPLE:  /posts?type=earthquake&from=2025-10-03T00:00Z&to=2025-10-04T23:59:59.999Z`);
    });
  }catch(err) {
      console.error(' DB Connection failed: ', err);
      process.exit(1);
  }
}

//start();

//**********************************************
// Normalize disaster type
// ex)
// floods, flooding -> flood
// quakes, earthquakes -> earthquake
// wildfire, wildfires -> wildfire
function normalizeType(s) {
  const m = String(s || '').trim().toLowerCase();
  // Floods
  if (['flooding','floods','flood', "flash flood", "flash floods"].includes(m)) return 'flood';

  // Earthquakes
  if (['quakes','earthquakes','quake', 'earthquake'].includes(m)) return 'earthquake';

  // Wildfires
  if (['wildfires','bushfire','forest fire','forest fires', 'whildfire'].includes(m)) return 'wildfire';

  // Hurricanes / Tropical Storms
  if (['hurricane', 'hurricanes', 'cyclone', 'cyclones', 'typhoon', 'typhoons', 'tropical storm', 'tropical storms'].includes(m)) return 'hurricane';

  // Tornadoes
  if (['tornado', 'tornadoes', 'twister', 'twisters'].includes(m)) return 'tornado';

  // Storms / Severe Weather
  if (['storm', 'storms', 'thunderstorm', 'thunderstorms', 'hailstorm', 'hailstorms', 'blizzard', 'blizzards', 'ice storm', 'ice storms'].includes(m)) return 'storm';

  // Drought / Heatwave
  if (['drought', 'droughts', 'heatwave', 'heat wave', 'heatwaves', 'heat waves'].includes(m)) return 'heatwave';

  // Landslides / Mudslides
  if (['landslide', 'landslides', 'mudslide', 'mudslides', 'rockslide', 'rockslides'].includes(m)) return 'landslide';

  // Volcanoes
  if (['volcano', 'volcanoes', 'eruption', 'eruptions'].includes(m)) return 'volcano';

  // Avalanche
  if (['avalanche', 'avalanches'].includes(m)) return 'avalanche';

  // Fire (non-wildfire)
  if (['fire', 'fires', 'building fire', 'structure fire', 'chemical fire'].includes(m)) return 'fire';

  // Explosion / Collapse
  if (['explosion', 'explosions', 'blast', 'blasts', 'building collapse', 'bridge collapse'].includes(m)) return 'explosion';

  // Accidents (transport)
  if (['plane crash', 'plane crashes', 'airplane crash', 'train derailment', 'shipwreck', 'ferry sinking', 'car crash', 'traffic accident', 'road accident', 'pileup', 'collision'].includes(m)) return 'accident';

  // Disease / Health Emergencies
  if (['outbreak', 'epidemic', 'pandemic', 'virus', 'infection', 'cholera', 'ebola', 'covid', 'covid-19'].includes(m)) return 'disease';

  // Conflict / Violence
  if (['shooting', 'shootings', 'attack', 'attacks', 'bombing', 'bombings', 'terrorism', 'terrorist', 'riot', 'riots', 'protest violence'].includes(m)) return 'violence';

  // Default / unrecognized
  return m;
}

function normalizeSeverity(s) {
  const m = String(s || '').trim().toLowerCase();
  if(["severe"].includes(m)) return 'severe';
  if(["moderate"].includes(m)) return 'moderate';
  if(["low"].includes(m)) return 'low';
  if(["unknown"].includes(m)) return 'unknown';
}

//**********************************************
//Shapes post into the document to upsert into DB
//seedType: original search keyword

const normalize_DB = (p,seedType) => ({
  postId: p?.uri,
  text: p?.record?.text ?? '',
  createdAt: p?.record?.createdAt,
  author: p?.author?.displayName?.trim()
     || p?.author?.handle?.trim()
     || p?.author?.did?.trim()
     || 'unknown',
   labels: {
    disasterType: normalizeType(seedType),
    severity: normalizeSeverity(seedType)
  },
  seedType
})



//**********************************************
// Code to reduces 403, 429 error from Bluesky
async function fetchSearch({ q, limit = 10, cursor }) {
  const endpoints = [
    'https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts',
    'https://api.bsky.app/xrpc/app.bsky.feed.searchPosts', 
  ];

  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
    'Origin': 'https://public.api.bsky.app',
    'Referer': 'https://public.api.bsky.app/',
    'Cache-Control': 'no-cache'
  };

  let last = null;

  for (const base of endpoints) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const url = new URL(base);
      url.searchParams.set('q', q);
      url.searchParams.set('limit', String(Math.min(limit, 100)));
      if (cursor) url.searchParams.set('cursor', cursor);

      const resp = await fetch(url, { headers });
      if (resp.ok) return resp.json();

      const body = await resp.text().catch(() => '');
      last = { status: resp.status, body };

      if (resp.status === 403 || resp.status === 429 || resp.status >= 500) {
        await new Promise(r => setTimeout(r, 250 * Math.pow(2, attempt))); 
        continue;
      }
      
      break;
    }
  }

  const e = new Error('upstream_failed');
  e.details = last;
  throw e;
}


app.get("/resources", async(req, res) => {
  // will be provided long + lat in request, query DB and serve resources that are within a certian threshold
  // of those coordinates

  console.log("wag1");

  const resources = await Resource.find({
  location: {
    $near: {
      $geometry: { type: "Point", coordinates: [Number(req.query.long), Number(req.query.lat)] },
      $maxDistance: Number(req.query.radius * 1609.34) // miles to meters
    }
  }
  });

  console.log(resources);

  res.json({resources});

});

async function filterDisasterPosts(posts) {
  try {
    const response = await fetch(`http://localhost:${PYTHON_PORT}/predict_disaster`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: posts.map(p => p.text) }),
    });

    if (!response.ok) {
      console.error(`Flask disaster API returned ${response.status}`);
      return posts; // fallback: keep all
    }

    const data = await response.json();
    const labels = data.labels || [];
    const scores = data.scores || [];
    const severities = data.severities || [];

    // Define criterion: LABEL_1 considered disaster (adjust if model uses different label)
    const filtered = posts.filter((p, i) => {
      const label = (labels[i] || '').toString().toLowerCase();
      const score = Number(scores[i] ?? 0);
      const severity = (severities[i] || 'test severity').toString().toLowerCase();
      // uncomment this line if you need to see severities in the console
      //console.log('Severity: ', severity); 
      // Adjust threshold as needed. Keep if label suggests disaster and score >= 0.8
      return (label === 'label_1' || label.includes('disaster')) && score >= 0.8;
    });

    const renormalized_posts = filtered.map((p, i) => ({
      ...p,
      labels: {
        ...p.labels,
        severity: severities[i] || "none"
      }
    }));

    console.log(`Filtered ${posts.length - filtered.length} non-disaster posts.`);
    return renormalized_posts;

  } catch (err) {
    console.error("Error calling Flask disaster classifier:", err);
    return posts; // fallback
  }
}

//**********************************************
//Search and Save to db
app.get('/search-save', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
   
    const limit  = Math.min(Number(req.query.limit) || 40, 100);
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;

    const data = await fetchSearch({ q, limit, cursor });
    const posts = data.posts ?? [];
    if (!posts.length) return res.json({ saved: 0, cursor: data.cursor ?? null });

    // BlueSky gives weird objects, normalize so they only contain what we want
    const normalized_posts = posts.map( p => normalize_DB(p, q));

    // filter posts before labeling
    const relevant_posts = await filterDisasterPosts(normalized_posts);

    // label each post
    const labeled_posts = await add_coordinates(relevant_posts);
    console.log(labeled_posts);

    // change post to JSON, see what it looks like

    if(labeled_posts == null){
      throw new Error("Could not label posts");
    }

    const ops = labeled_posts.map(doc => {


      return {
        updateOne: {
          filter: { postId: doc.postId },
          update: {
          $set: {
            text: doc.text,
            author: doc.author,
            createdAt: doc.createdAt,
            labels: doc.labels,
            seedType: doc.seedType,
            coordinates: doc.coordinates,
            updatedAt: new Date()
          },
          $setOnInsert: { ingestedAt: new Date() }
          },
          upsert: true
        }
      };
    });


    const r = await Post.bulkWrite(ops, { ordered: false });
    // respond with json of posts, TODO change to some other response
    res.json({
      saved: (r.upsertedCount || 0) + (r.modifiedCount || 0),
      cursor: data.cursor ?? null,
      meta: { fetched: posts.length, query: q }
    });
  } catch (err) {
    console.error('UPSTREAM/DB ERROR:', err);
    res.status(502).json({ error: err.message });
  }
});

// TESTING python server
app.get("/api/ner", async (req, res) => {
  const raw_posts = [
    {
      username: "sso1",
      text: "I need help in an undisclosed location"
    },
    {
      username: "sso2",
      text: "There is an earthquake in Tokyo, Japan"
    },
    {
      username: "sso3",
      text: "There is a wildfire heading towards Richardson, Texas"
    }
  ];



  try {
    // Wait for the Flask server’s response
    const response = await fetch(`http://localhost:${PYTHON_PORT}/ner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_posts })
    });

    // error handler
    if (!response.ok) {
      throw new Error(`Flask server returned ${response.status}`);
    }

    // wait for text to be labeled
    const result = await response.json();

    // display on front end
    res.json({ success: true, result });
  } catch (err) {
    console.error("NER request failed:", err);
    res.status(500).json({ error: "NER service unavailable" });
  }
});

async function add_coordinates(raw_posts){

  try {
    // Wait for the Flask server’s response

    const controller = new AbortController();

    // Wait up to 3 minutes (180000 ms)
    const timeout = setTimeout(() => controller.abort(), 180000);

    const response = await fetch(`http://localhost:${PYTHON_PORT}/ner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_posts }),
      signal: controller.signal,

    });

    clearTimeout(timeout);

    // error handler
    if (!response.ok) {
      throw new Error(`Flask server returned ${response.status}`);
    }

    // wait for text to be labeled
    const result = await response.json();
    return result.posts;

  } catch (err) {
    console.error("NER request failed:", err);
    return null
  }


}



//filtered search from db
app.get('/posts', async (req, res) => {
  try {
    const { type, types, from, to, page = 1, pageSize = 50 } = req.query;
    let disasterTypes = [];
    if (types) disasterTypes = String(types).split(',').map(s => s.trim()).filter(Boolean);
    else if (type) disasterTypes = [String(type).trim()];

    const q = {};
    if (from || to) {
      q.createdAt = {};
      if (from) q.createdAt.$gte = new Date(from);
      if (to)   q.createdAt.$lte = new Date(to);
    }
    if (disasterTypes.length) q['labels.disasterType'] = { $in: disasterTypes };

    const limit = Math.min(Number(pageSize) || 50, 200);
    const skip  = (Math.max(1, Number(page)) - 1) * limit;

    const pipeline = [
      { $match: q },
      { $sort: { createdAt: -1 } },
      {
        $project: {
          _id: 0,                    
          postId: 1,
          text: 1,
          createdAt: 1,
          author: 1,
          disasterType: '$labels.disasterType',
          coordinates: 1,
        }
      },
      { $skip: skip },
      { $limit: limit }
    ];

    const [results, totalArr] = await Promise.all([
      Post.aggregate(pipeline),
      Post.aggregate([{ $match: q }, { $count: 'total' }])
    ]);


    const plainResults = JSON.parse(JSON.stringify(results));

    res.json({ total: totalArr[0]?.total ?? 0, page: Number(page), pageSize: limit, results: plainResults });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Top 5 disaster types by post count
app.get('/analytics/top-types', async (req, res) => {
  try {
    const results = await Post.aggregate([
      {
        $group: {
          _id: "$labels.disasterType",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error" });
  }
});

app.get("/analytics/posts-over-time", async (req, res) => {
  try {
    const results = await Post.aggregate([
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error" });
  }
});

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

// Countries with most disasters (by posts)
app.get('/analytics/top-countries-over-time', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 5, 12));
    const days  = Number(req.query.days) || null;

    const match = {};
    if (days) {
      const cutoff = new Date();
      cutoff.setUTCDate(cutoff.getUTCDate() - days);
      match.createdAt = { $gte: cutoff };
    }

    // Get posts with coordinates
    const docs = await Post.find(match, {
      createdAt: 1,
      coordinates: 1,
      _id: 0
    }).lean();

    if (!docs.length) return res.json([]);

    // Bounding boxes for approximate country detection
    const BOXES = [
      ["United States",   24.5, 49.5, -125, -66],
      ["Canada",          41.7, 83.1, -141, -52],
      ["Mexico",          14.5, 32.7, -118, -86],
      ["Brazil",         -34.0,  6.0,  -74, -34],
      ["United Kingdom",  49.9, 60.9,  -8.7, 1.8],
      ["France",          41.3, 51.2,  -5.5, 9.6],
      ["Germany",         47.2, 55.1,   5.5, 15.5],
      ["Spain",           36.0, 43.8,  -9.5, 3.5],
      ["Italy",           36.5, 47.3,   6.6, 18.6],
      ["India",            6.5, 35.7,  68.1, 97.4],
      ["China",           18.0, 53.6,  73.5,134.8],
      ["Japan",           24.0, 46.0, 123.0,146.0],
      ["South Korea",     33.0, 38.8, 124.6,131.9],
      ["Australia",      -44.0,-10.0, 112.9,154.0],
      ["New Zealand",    -47.7,-34.3, 166.0,179.0],
      ["South Africa",   -35.0,-22.0,  16.0, 33.0],
      ["Russia",          41.2, 81.9,  19.6,180.0],
      ["Turkey",          35.8, 42.1,  26.0, 45.0],
      ["Indonesia",      -11.0,  6.1,  95.0,141.0],
      ["Philippines",      4.6, 21.1, 116.9,126.6],
    ];

    const inBox = (lat, lng, box) =>
      lat >= box[1] && lat <= box[2] && lng >= box[3] && lng <= box[4];

    const guessCountry = (coord) => {
      if (!Array.isArray(coord) || coord.length < 2) return null;
      const [a, b] = coord;
      const pairs = [
        { lat: a, lng: b },
        { lat: b, lng: a },
      ];
      for (const { lat, lng } of pairs) {
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        for (const box of BOXES) {
          if (inBox(lat, lng, box)) return box[0];
        }
      }
      return null;
    };

    // Aggregate counts by day + country
    const counts = new Map();
    const totals = new Map();

    for (const d of docs) {
      const day = new Date(d.createdAt);
      if (Number.isNaN(day.getTime())) continue;
      const dayKey = day.toISOString().slice(0, 10);

      let ctry = null;
      if (Array.isArray(d.coordinates) && d.coordinates.length) {
        // Handle nested coordinate arrays
        const coord = Array.isArray(d.coordinates[0])
          ? d.coordinates[0]
          : d.coordinates;
        ctry = guessCountry(coord);
      }
      if (!ctry) continue;

      const key = `${dayKey}|${ctry}`;
      counts.set(key, (counts.get(key) || 0) + 1);
      totals.set(ctry, (totals.get(ctry) || 0) + 1);
    }

    // Get top countries
    const top = Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([c]) => c);
    const topSet = new Set(top);

    // Build final output
    const out = [];
    for (const [key, count] of counts.entries()) {
      const [bucket, country] = key.split('|');
      if (!topSet.has(country)) continue;
      out.push({ bucket, country, count });
    }

    out.sort((a, b) =>
      a.bucket === b.bucket
        ? a.country.localeCompare(b.country)
        : a.bucket.localeCompare(b.bucket)
    );

    return res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error" });
  }
});

// Types over time (date × disasterType) for stacked area chart
app.get('/analytics/types-over-time', async (req, res) => {
  try {
    const results = await Post.aggregate([
      {
        $addFields: {
          _type: "$labels.disasterType",
          _day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
        }
      },
      { $match: { _type: { $ne: null, $ne: "" } } },
      { $group: { _id: { day: "$_day", type: "$_type" }, count: { $sum: 1 } } },
      { $project: { _id: 0, bucket: "$_id.day", type: "$_id.type", count: 1 } },
      { $sort: { bucket: 1, type: 1 } }
    ]);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error" });
  }
});

app.get("/me", async (req, res) => {
  try {
    const token = req.cookies?.token || (req.headers.authorization?.split(" ")[1]);
    if (!token) return res.json({ user: null });

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const { id } = decoded || {};
    if (!id) return res.json({ user: null });

    const user = await User.findById(id).select("username role").lean();
    if (!user) return res.json({ user: null });

    return res.json({ user });
  } catch {
    return res.json({ user: null });
  }
});

//**********************************************
// Create a new chat
app.post('/api/chat/new', async (req, res) => {
  try {
    const { userIds } = req.body;

    // Validate userIds array exists and has at least 2 users
    if (!Array.isArray(userIds) || userIds.length < 2) {
      return res.status(400).json({ error: "Must provide at least 2 user IDs" });
    }

    // Verify all user IDs are valid
    const users = await User.find({ _id: { $in: userIds } });
    if (users.length !== userIds.length) {
      return res.status(404).json({ error: "One or more user IDs are invalid" });
    }

    // Create new chat
    const chat = new Chat({
      users: userIds,
      messages: []
    });
    await chat.save();

    // Add chat reference to all users
    await User.updateMany(
      { _id: { $in: userIds } },
      { $push: { chats: chat._id } }
    );

    res.status(201).json({ chatId: chat._id });
  } catch (err) {
    console.error("Error creating chat:", err);
    res.status(500).json({ error: "Failed to create chat" });
  }
});

app.get('/api/users/search', async (req, res) => {
  try {
    const { prefix } = req.query;

    if (!prefix || typeof prefix !== 'string') {
      return res.status(400).json({ error: "Prefix is required" });
    }

    // Find users whose username starts with the prefix (case-insensitive)
    // Return full user documents (excluding sensitive passwordHash)
    const usersMatching = await User.find({
      username: { $regex: `^${prefix}`, $options: 'i' }
    })
    .select('-passwordHash') // Exclude password hash for security
    .lean();

    res.status(200).json({ usersMatching });
  } catch (err) {
    console.error("Error searching users:", err);
    res.status(500).json({ error: "Failed to search users" });
  }
});


// serve react index file for all other requests not handled
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "frontend/dist", "index.html"));
});

// This part may not work with all the login/logout stuff, we'll see.
// Auto-refresh disaster data every 5 minutes
const DISASTER_TYPES = [
  "flood",
  "earthquake",
  "hurricane",
  "tornado",
  "storm",
  "heatwave",
  "wildfire"
];

// Helper to trigger a /search-save call for each disaster type
let isRefreshing = false; // queue-safety flag

async function refreshAllDisasterData() {
  if (isRefreshing) {
    console.log(`[AUTO-UPDATE] Skipping — previous refresh still running`);
    return;
  }

  isRefreshing = true;
  console.log(`[AUTO-UPDATE] Starting data refresh at ${new Date().toISOString()}`);

  for (const type of DISASTER_TYPES) {
    try {
      const url = `http://localhost:${PORT}/search-save?q=${encodeURIComponent(type)}&limit=25`;
      const resp = await fetch(url);
      const data = await resp.json();
      console.log(`[AUTO-UPDATE] ${type}: Saved ${data.saved} posts`);
    } catch (err) {
      console.error(`[AUTO-UPDATE] Failed to refresh ${type}:`, err.message);
    }

    // Delay 5 seconds between each disaster type to avoid API throttling
    await new Promise(r => setTimeout(r, 5000));
  }

  console.log(`[AUTO-UPDATE] Completed refresh at ${new Date().toISOString()}`);
  isRefreshing = false;
}

// Start the app and schedule the updater
start().then(() => {
  console.log(`\nApp and DB initialized successfully`);

  // Run immediately on startup
  refreshAllDisasterData();

  // Then repeat every 15 minutes
  setInterval(refreshAllDisasterData, 15 * 60 * 1000);
});
