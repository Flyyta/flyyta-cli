const fs = require("fs");
const path = require("path");
const express = require("express");
const config = require("../config");
const postMethods = require("./posts");
const convertFiles = require("./convert");

const app = express();
const port = process.env.PORT || 5000;
const publicPath = path.join(__dirname, "../public");
app.use(express.static(publicPath));

const posts = fs
  .readdirSync(config.postPath.postsdir)
  .map((post) => post.slice(0, -3))
  .map((post) => postMethods.createPost(post))
  .sort(function (a, b) {
    return b.attributes.date - a.attributes.date;
  });

if (!fs.existsSync(config.postPath.outdir))
  fs.mkdirSync(config.postPath.outdir);

postMethods.createPosts(posts);

convertFiles(posts);

app.get("/", (req, res) => {
  res.render("index");
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
