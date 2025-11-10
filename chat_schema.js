import mongoose from "mongoose";

const chatSchema = new mongoose.Schema({
  
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
    
    messages: [{ type: mongoose.Schema.Types.ObjectId, ref: "Message", default: [] }]
}, { timestamps: true });

export default mongoose.model("Chat", chatSchema);