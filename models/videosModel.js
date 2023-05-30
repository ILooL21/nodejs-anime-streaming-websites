const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "Please enter a title "],
  },
  description: {
    type: String,
    required: [true, "Please enter a description"],
  },
  video: {
    type: String,
    required: [true, "Please enter a video "],
  },
  thumbnail: {
    type: String,
    required: [true, "Please enter a thumbnail "],
  },
  duration: {
    type: String,
    required: true,
  },
  watch: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Number,
    required: true,
  },
  views: {
    type: Number,
    default: 0,
  },
  likers: {
    type: Array,
    default: [],
  },
  dislikers: {
    type: Array,
    default: [],
  },
  comments: {
    type: Array,
    default: [],
  },
});

const videoModel = mongoose.model("videos", videoSchema);

module.exports = videoModel;
