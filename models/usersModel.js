const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please enter your name!"],
  },
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    default: "",
  },
  coverPhoto: {
    type: String,
    default: "",
  },
});

const userModel = mongoose.model("users", userSchema);

module.exports = userModel;
