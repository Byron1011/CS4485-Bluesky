import AnalyticsCache from "./analyticsCacheSchema.js";

export default async function setAnalyticsCache(key, data) {
  await AnalyticsCache.updateOne(
    { key },
    { data, updatedAt: new Date() },
    { upsert: true }
  );
}
