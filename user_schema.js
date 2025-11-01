import mongoose from "mongoose";

const userSchema = new mongoose.Schema({

  username: { type: String, required: true, unique: true },

  passwordHash: { type: String, required: true },

  role: { type: String, enum: ["user", "admin"], default: "user" },
  
  eventsHosting: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Event'
  }],

  eventsAttending: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Event'
  }],
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }

});

// Update the updatedAt 
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model("User", userSchema);
