import mongoose from 'mongoose';

const postSchema = new mongoose.Schema ({
    //unique id for each post (unique + index = prevent duplicate save)
    postId: {type: String, unique: true, index: true, required: true}, 

    //text content of post
    text: {type: String},

    //posted time
    createdAt : {type: Date, index: true, required: true},
    
    //author of post
    author: { type: String, index: true, required: true },

    //label for classification ( add more labels later [servirity, location] )
    labels: {
        disasterType: { type: String, index:true },

    },

    coordinates: {
            type: [[Number]],
            default: []
    }
    

});

postSchema.index({ text: 'text' });

postSchema.index({ 'labels.disasterType': 1 , createdAt: -1 });


export default mongoose.model('Post', postSchema);