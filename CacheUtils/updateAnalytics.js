import Post from "../post_schema.js";
import setAnalyticsCache from "./setCache.js";

async function computeCountriesOverTime(limit = 5) {
  const posts = await Post.find(
    { createdAt: { $exists: true }, coordinates: { $exists: true } },
    { createdAt: 1, coordinates: 1, _id: 0 }
  ).lean();

  if (!posts.length) return [];

    // Bounding boxes
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

  // Guess country using bounding boxes (your original function)
  const country = coord => {
    if (!Array.isArray(coord) || coord.length < 2) return null;
    const [a, b] = coord;
    const pairs = [ { lat: a, lng: b }, { lat: b, lng: a } ];
    for (const { lat, lng } of pairs) {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      for (const box of BOXES) {
        if (lat >= box[1] && lat <= box[2] && lng >= box[3] && lng <= box[4])
          return box[0];
      }
    }
    return null;
  };

  // Step 1: count all countries total
  const totals = new Map();
  const perDay = new Map();

  for (const p of posts) {
    const day = new Date(p.createdAt).toISOString().slice(0, 10);

    const c = country(Array.isArray(p.coordinates[0])
      ? p.coordinates[0]
      : p.coordinates);

    if (!c) continue;

    totals.set(c, (totals.get(c) || 0) + 1);

    const key = `${day}|${c}`;
    perDay.set(key, (perDay.get(key) || 0) + 1);
  }

  // Step 2: choose top 5 countries overall
  const top = Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([c]) => c);

  const topSet = new Set(top);

  // Step 3: produce EXACT SAME format as before
  const final = [];

  for (const [key, count] of perDay.entries()) {
    const [bucket, country] = key.split('|');
    if (!topSet.has(country)) continue;

    final.push({ bucket, country, count });
  }

  final.sort((a, b) =>
    a.bucket === b.bucket
      ? a.country.localeCompare(b.country)
      : a.bucket.localeCompare(b.bucket)
  );

  return final;
}

export default async function updateAnalytics() {
  console.log("Updating analytics cache...");

  // 1. total-posts
  const totalPosts = await Post.countDocuments();
  await setAnalyticsCache("total-posts", { total: totalPosts });

  // 2. top-types
  const topTypes = await Post.aggregate([
    { $group: { _id: "$labels.disasterType", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 }
  ]);
  await setAnalyticsCache("top-types", topTypes);

  // 3. posts-over-time
  const postsOverTime = await Post.aggregate([
    { $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }},
        count: { $sum: 1 }
    }},
    { $sort: { _id: 1 } }
  ]);
  await setAnalyticsCache("posts-over-time", postsOverTime);

  // 4. types-over-time
  const typesOverTime = await Post.aggregate([
    { $addFields: {
        _type: "$labels.disasterType",
        _day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }}
    }},
    { $match: { _type: { $ne: null, $ne: "" } } },
    { $group: { _id: { day: "$_day", type: "$_type" }, count: { $sum: 1 } } },
    { $project: { _id: 0, bucket: "$_id.day", type: "$_id.type", count: 1 } },
    { $sort: { bucket: 1, type: 1 } }
  ]);
  await setAnalyticsCache("types-over-time", typesOverTime);

  // 5. top-countries-over-time
  const topCountries = await computeCountriesOverTime();
  await setAnalyticsCache("top-countries-over-time", topCountries);

  console.log("Analytics cache updated!");
}
