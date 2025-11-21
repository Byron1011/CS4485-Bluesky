import AnalyticsCache from "./analyticsCacheSchema.js";

export default async function getAnalyticsCache(key) {
  const doc = await AnalyticsCache.findOne({ key }).lean();
  return doc?.data || null;
}
