const express = require("express");
const app = express();
const http = require("http").createServer(app);
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const fileSystem = require("fs");
const formidable = require("formidable");
const { getVideoDurationInSeconds } = require("get-video-duration");

const userModel = require("./models/usersModel");
const videoModel = require("./models/videosModel");

const expressSession = require("express-session");

const verifyUser = async (req, res, next) => {
  if (!req.session.user_id) {
    return res.status(401).send("Please Login to continue");
  }
  const user = await userModel.findOne({ _id: req.session.user_id });
  if (user.role == "Admin") {
    next();
  } else {
    return res.status(403).send("You are not allowed to access this page");
  }
};

app.use(express.json());

app.use(
  expressSession({
    key: "user_id",
    name: "name",
    secret: "User Object ID",
    resave: true,
    saveUninitialized: true,
  })
);

app.use(
  bodyParser.json({
    limit: "10000mb",
  })
);

app.use(
  bodyParser.urlencoded({
    extended: true,
    limit: "10000mb",
    parameterLimit: 100000,
  })
);

app.use("/public", express.static(__dirname + "/public"));
app.set("view engine", "ejs");

mongoose
  .connect("mongodb://127.0.0.1:27017/animeStreaming", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to Database");
  })
  .catch((err) => {
    console.log("Error connecting to Database", err);
  });

http.listen(3000, function () {
  console.log("listening on : 3000");

  app.get("/", async function (req, res) {
    const user = await userModel.findOne({ _id: req.session.user_id });
    const isAdmin = user && user.role === "Admin";
    var videos = await videoModel.find({}).sort({
      createdAt: -1,
    });
    res.render("home", {
      isLogin: req.session.user_id ? true : false,
      isAdmin: isAdmin ? true : false,
      videos: videos,
    });
  });

  app.get("/signup", function (req, res) {
    res.render("signup", {
      error: "",
      message: "",
    });
  });

  app.post("/signup", async (req, res) => {
    try {
      const users = await userModel.findOne({ email: req.body.email });
      const names = await userModel.findOne({ name: req.body.name });
      if (users || names) {
        // User already exists
        res.render("signup", {
          error: "User already exists",
          message: "",
        });
      } else {
        // User not found
        bcrypt.hash(req.body.password, 10, async (err, hash) => {
          const user = new userModel({
            name: req.body.name,
            email: req.body.email,
            password: hash,
            role: "User",
            coverPhoto: "",
          });
          await user.save();
          res.redirect("/");
        });
      }
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/login", function (req, res) {
    if (req.session.user_id) {
      res.redirect("/");
    } else {
      res.render("login", {
        message: "",
        error: "",
      });
    }
  });

  app.post("/login", async (req, res) => {
    const users = await userModel.findOne({ email: req.body.email });
    if (users) {
      bcrypt.compare(req.body.password, users.password, (err, result) => {
        if (result) {
          req.session.user_id = users._id;
          res.redirect("/");
        } else {
          res.render("login", {
            error: "Wrong Password",
            message: "",
          });
        }
      });
    } else {
      res.render("login", {
        error: "Email does not exist",
        message: "",
      });
    }
  });

  app.get("/logout", function (req, res) {
    req.session.destroy();
    res.redirect("/");
  });

  app.get("/upload", verifyUser, async function (req, res) {
    const user = await userModel.findOne({ _id: req.session.user_id });
    const isAdmin = user && user.role === "Admin";

    res.render("upload", {
      isLogin: req.session.user_id ? true : false,
      isAdmin: isAdmin ? true : false,
    });
  });

  app.post("/upload-video", async (req, res) => {
    if (req.session.user_id) {
      var formData = new formidable.IncomingForm();
      formData.maxFileSize = 1000 * 1024 * 1024;
      formData.parse(req, async (err, fields, files) => {
        var title = fields.title;
        var description = fields.description;

        var oldPathThumbnail = files.thumbnail.filepath;
        var thumbnail = "public/thumbnails/" + new Date().getTime() + "-" + files.thumbnail.originalFilename;

        fileSystem.rename(oldPathThumbnail, thumbnail, function (err) {
          if (err) {
            console.log(err);
          }
        });
        var oldPathVideo = files.video.filepath;
        var newPath = "public/videos/" + new Date().getTime() + "-" + files.video.originalFilename;
        fileSystem.rename(oldPathVideo, newPath, function (err) {
          if (err) {
            console.log(err);
          }
          var currentTime = new Date().getTime();

          getVideoDurationInSeconds(newPath).then(async (duration) => {
            var hours = Math.floor(duration / 60 / 60);
            var minutes = Math.floor(duration / 60) - hours * 60;
            var seconds = Math.floor(duration % 60);

            var video = new videoModel({
              title: title,
              description: description,
              thumbnail: thumbnail,
              video: newPath,
              duration: hours + ":" + minutes + ":" + seconds,
              watch: currentTime,
              createdAt: currentTime,
              views: 0,
              likers: [],
              dislikers: [],
              comments: [],
            });
            await video.save();
            res.redirect("/");
          });
        });
      });
    }
  });

  app.get("/watch/:id", async (req, res) => {
    const user = await userModel.findOne({ _id: req.session.user_id });
    const videos = await videoModel.findOne({ _id: req.params.id });
    const isAdmin = user && user.role === "Admin";

    if (videos == null) {
      res.send("Video does not exist");
    } else {
      await videoModel.updateOne({ _id: req.params.id }, { $inc: { views: 1 } });

      res.render("watch", {
        isLogin: req.session.user_id ? true : false,
        isAdmin: isAdmin ? true : false,
        users: user,
        video: videos,
      });
    }
  });

  app.post("/do-dislike", async (req, res) => {
    if (req.session.user_id) {
      const video = await videoModel.findOne({ _id: req.body.videoId });
      const isDisliked = video.dislikers.includes(req.session.user_id);
      const isLiked = video.likers.includes(req.session.user_id);

      if (isLiked) {
        await videoModel.updateOne({ _id: video._id }, { $pull: { likers: req.session.user_id } });
      }

      if (isDisliked) {
        res.json({ message: "You already disliked this video", status: "error" });
      } else {
        await videoModel.updateOne({ _id: video._id }, { $push: { dislikers: req.session.user_id } });
        res.json({ message: "Video disliked", status: "success" });
      }
    } else {
      res.json({ message: "You need to login first", status: "error" });
    }
  });

  app.post("/do-like", async (req, res) => {
    if (req.session.user_id) {
      const video = await videoModel.findOne({ _id: req.body.videoId });
      const isLiked = video.likers.includes(req.session.user_id);
      const isDisliked = video.dislikers.includes(req.session.user_id);

      if (isDisliked) {
        await videoModel.updateOne({ _id: video._id }, { $pull: { dislikers: req.session.user_id } });
      }

      if (isLiked) {
        res.json({ message: "You already liked this video", status: "error" });
      } else {
        await videoModel.updateOne({ _id: video._id }, { $push: { likers: req.session.user_id } });
        res.json({ message: "Video liked", status: "success" });
      }
    } else {
      res.json({ message: "You need to login first", status: "error" });
    }
  });

  app.post("/do-comments", async (req, res) => {
    if (req.session.user_id) {
      const video = await videoModel.findOne({ _id: req.body.videoId });
      const user = await userModel.findOne({ _id: req.session.user_id });
      const comment = {
        _id: new mongoose.Types.ObjectId(),
        user: {
          _id: user._id,
          name: user.name,
          coverPhoto: user.coverPhoto,
        },
        comment: req.body.comment,
        createdAt: new Date().getTime(),
      };
      await videoModel.updateOne({ _id: video._id }, { $push: { comments: comment } });
      res.json({ message: "Comment has been posted", status: "success" });
    } else {
      res.json({ message: "You need to login first", status: "error" });
    }
  });

  app.get("/search", async (req, res) => {
    const user = await userModel.findOne({ _id: req.session.user_id });
    const isAdmin = user && user.role === "Admin";
    const videos = await videoModel.find({
      title: {
        $regex: ".*" + req.query.search_query + ".*",
        $options: "i",
      },
    });
    res.render("search", {
      isLogin: req.session.user_id ? true : false,
      isAdmin: isAdmin ? true : false,
      videos: videos,
      query: req.query.search_query,
    });
  });

  app.get("/profile", async (req, res) => {
    if (req.session.user_id) {
      const user = await userModel.findOne({ _id: req.session.user_id });
      const isAdmin = user && user.role === "Admin";

      res.render("profile", {
        user: user,
        isLogin: req.session.user_id ? true : false,
        isAdmin: isAdmin ? true : false,
        error: "",
        message: "",
      });
    } else {
      res.redirect("/login");
    }
  });

  app.post("/upload_coverPhoto", async (req, res) => {
    const user = await userModel.findOne({ _id: req.session.user_id });

    if (req.body.changeCoverPhoto != "undefined") {
      var formData = new formidable.IncomingForm();
      formData.maxFileSize = 1000 * 1024 * 1024;
      formData.parse(req, async (err, fields, files) => {
        if (user.coverPhoto != "") {
          fileSystem.unlink(user.coverPhoto, (err) => {
            if (err) {
              console.log(err);
            }
          });
        }
        var oldPath = files.coverPhoto.filepath;
        var newPath = "public/coverPhotos/" + new Date().getTime() + "-" + files.coverPhoto.originalFilename;
        fileSystem.rename(oldPath, newPath, function (err) {
          if (err) {
            console.log(err);
          }
        });
        await userModel.updateOne({ _id: req.session.user_id }, { coverPhoto: newPath });
        await videoModel.updateMany({ "comments.user._id": user._id }, { $set: { "comments.$.user.coverPhoto": newPath } });
      });
    } else {
      res.redirect("/profile");
    }

    const updatedUser = await userModel.findOne({ _id: user._id });
    res.render("profile", {
      user: updatedUser,
      isLogin: req.session.user_id ? true : false,
      isAdmin: user.role === "Admin" ? true : false,
      error: "",
      message: "Profile updated successfully",
    });
  });

  app.post("/update_profile", async (req, res) => {
    const user = await userModel.findOne({ _id: req.session.user_id });
    const names = await userModel.findOne({ name: req.body.name });
    if (req.body.password == "" && req.body.name == "") {
      res.redirect("/profile");
    } else if (req.body.password == "") {
      if (!names) {
        await userModel.updateOne({ _id: user._id }, { name: req.body.name });
        await videoModel.updateMany({ "comments.user._id": user._id }, { $set: { "comments.$.user.name": req.body.name } });
      }
    } else if (req.body.name == "") {
      bcrypt.hash(req.body.password, 10, async (err, hash) => {
        await userModel.updateOne({ _id: user._id }, { password: hash });
      });
    } else if (!names) {
      bcrypt.hash(req.body.password, 10, async (err, hash) => {
        await userModel.updateOne({ _id: user._id }, { name: req.body.name, password: hash });
        await videoModel.updateMany({ "comments.user._id": user._id }, { $set: { "comments.$.user.name": req.body.name } });
      });
    }

    const updatedUser = await userModel.findOne({ _id: user._id });
    res.render("profile", {
      user: updatedUser,
      isLogin: req.session.user_id ? true : false,
      isAdmin: user.role === "Admin" ? true : false,
      error: "",
      message: "Profile updated successfully",
    });
  });

  app.get("/edit/:id", verifyUser, async (req, res) => {
    const videos = await videoModel.findOne({ _id: req.params.id });
    const user = await userModel.findOne({ _id: req.session.user_id });
    const isAdmin = user && user.role === "Admin";

    if (videos == null) {
      res.send("Video does not exist");
    } else {
      res.render("edit-video", {
        isLogin: req.session.user_id ? true : false,
        isAdmin: isAdmin ? true : false,
        video: videos,
        error: "",
        message: "",
      });
    }
  });

  app.post("/edit_video/:id", async (req, res) => {
    if (req.body.description == "" && req.body.title == "") {
      res.redirect("/edit/" + req.params.id);
    } else if (req.body.title == "") {
      await videoModel.updateOne({ _id: req.params.id }, { description: req.body.description });
    } else if (req.body.description == "") {
      await videoModel.updateOne({ _id: req.params.id }, { title: req.body.title });
    } else {
      await videoModel.updateOne({ _id: req.params.id }, { title: req.body.title, description: req.body.description });
    }

    const updatedVideo = await videoModel.findOne({ _id: req.params.id });

    res.render("edit-video", {
      video: updatedVideo,
      error: "",
      message: "Video updated successfully",
    });
  });

  app.post("/delete/:id", verifyUser, async (req, res) => {
    const video = await videoModel.findOne({ _id: req.params.id });
    fileSystem.unlink(video.thumbnail, async (err) => {
      if (err) {
        console.log(err);
      }
    });
    fileSystem.unlink(video.video, async (err) => {
      if (err) {
        console.log(err);
      }
    });
    await videoModel.deleteOne({ _id: req.params.id });
    res.redirect("/");
  });

  app.post("/delete_comment/:id", async (req, res) => {
    const video = await videoModel.findOne({ _id: req.body.videoId });
    const comment = video.comments.find((comment) => comment._id == req.params.id);

    await videoModel.updateOne({ _id: req.body.videoId }, { $pull: { comments: comment } });
    res.redirect("/watch/" + req.body.videoId);
  });

  app.post("/edit_comment/:vid/:cid", async (req, res) => {
    const video = await videoModel.findOne({ _id: req.params.vid });
    const isComment = video.comments.find((comment) => comment._id == req.params.cid);

    await videoModel.updateOne({ _id: req.params.vid, "comments._id": isComment._id }, { $set: { "comments.$.comment": req.body.edit } });
    res.redirect("/watch/" + req.params.vid);
  });
});
