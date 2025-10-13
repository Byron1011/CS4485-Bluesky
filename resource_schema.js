import mongoose from 'mongoose';

const ResourceSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    address: {
        type: String
    },
    state: {
        type: String
    },
    city: {
        type: String
    },
    
    location: {
        type: {
            type: String,
            enum: ["Point"]
        },
        coordinates: {
            type: [Number]  // long, lat
        }
    },

    website: {
        type: String
    },
    phone: {
        type: String
    }

});

ResourceSchema.index({ location: '2dsphere' });

export default mongoose.model("Resource", ResourceSchema);