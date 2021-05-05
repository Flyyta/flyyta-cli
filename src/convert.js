const fs = require("fs");
const util = require("util");
const path = require("path");

const configPath = path.join(process.cwd(), "config");
const config = require(configPath);
const readFile = util.promisify(fs.readFile);
const postMapFunction = require("./layout/index-page-posts");

const regex = /\{(.*?)\}/g;
const moveFrom = config.filePath.postsdir;
const moveTo = config.filePath.outdir;

//Function to read file asynchronously
const readFileAsync = async (filename) => {
  return readFile(`${moveFrom}/${filename}`);
};

//Function to build files asynchronously
const convertFiles = async (posts) => {
  let markupFromExternalFile;
  const files = await fs.promises.readdir(moveFrom);
  for (const file of files) {
    if (file == config.mapPostsTo.fileName) {
      let mappedPosts = postMapFunction(posts);
      config.posts = mappedPosts;
    }
    readFileAsync(file)
      .then((res) => {
        markupFromExternalFile = res.toString("utf-8");
        let finalMarkup = markupFromExternalFile;
        const changes = finalMarkup.matchAll(regex);
        while (true) {
          const change = changes.next();
          if (change.done) break;
          const [replacement, prop] = change.value;
          finalMarkup = finalMarkup.replace(replacement, config[prop]);
        }
        fs.writeFile(`${moveTo}/${file}`, finalMarkup, function (err) {
          if (err) throw err;
        });
      })
      .catch((err) => console.log(err));
  }
};

module.exports = convertFiles;
