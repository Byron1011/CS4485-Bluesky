import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({

  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  content: { type: String, required: true, trim: true },
  
  chat: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", required: true }

}, { timestamps: true });

export default mongoose.model("Message", messageSchema);