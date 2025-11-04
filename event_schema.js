import mongoose from "mongoose";

const eventSchema = new mongoose.Schema({

  eventName: { type: String, required: true },

  eventDate: { type: Date, required: true },

  description: { type: String, required: true },

  //ref to User schema
  host: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },

  attendees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: []
  }],

  location: {
    type: {
      type: String,
      enum: ["Point"],
      required: true
    },
    coordinates: {
      type: [Number],
      required: true
    }
    },

  createdAt: { type: Date, default: Date.now },

  updatedAt: { type: Date, default: Date.now },

});

// Create geospatial index for location-based queries
eventSchema.index({ location: "2dsphere" });

// Update the updatedAt 
eventSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model("Event", eventSchema);