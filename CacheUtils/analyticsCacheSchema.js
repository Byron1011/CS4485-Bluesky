import mongoose from "mongoose";

const analyticsCacheSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  data: { type: Object, required: true },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model("AnalyticsCache", analyticsCacheSchema);
