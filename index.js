
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import Post from './post_schema.js';
import Resource from "./resource_schema.js";

const app = express();
const PORT = process.env.PORT;
const PYTHON_PORT = process.env.PYTHON_PORT;

import path from "path";
import { fileURLToPath } from "url";

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

start();

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
    disasterType: normalizeType(seedType)
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

  console.log(req.query);

  const resources = await Resource.find({
  location: {
    $near: {
      $geometry: { type: "Point", coordinates: [Number(req.query.long), Number(req.query.lat)] },
      $maxDistance: Number(req.query.radius * 1609.34) // meters to miles
    }
  }
  });

  console.log("at least I got here");
  console.log(resources);
  res.json({resources});

});

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
    const normalized_posts = posts.map( p => {
      const post = normalize_DB(p, q);

      return post;
    });


    // label each post
    const labeled_posts = await add_coordinates(normalized_posts);
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

    console.log("almost at the end");

    const plainResults = JSON.parse(JSON.stringify(results));

    res.json({ total: totalArr[0]?.total ?? 0, page: Number(page), pageSize: limit, results: plainResults });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});


// serve react index file for all other requests not handled
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "frontend/dist", "index.html"));
});

