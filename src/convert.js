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
const blogListLayout = config.blogListLayout.postsdir;
const blogListLayoutFile = config.blogListLayout.file;

//Function to read file asynchronously
const readFileAsync = async (filename) => {
  return readFile(`${moveFrom}/${filename}`);
};

const readFileAsyncLayout = async (filename) => {
  return readFile(`${blogListLayout}/${blogListLayoutFile}`);
};
const convertMarkdowntoHtml = (finalMarkup, regex = regex, post) => {
  const changes = finalMarkup.matchAll(regex);
  while (true) {
    const change = changes.next();
    if (change.done) break;
    let [replacement, prop] = change.value;

    if (
      prop.includes("title") ||
      prop.includes("description") ||
      prop.includes("body") ||
      prop.includes("date") ||
      prop.includes("path")
    ) {
      if (post) {
        if (prop.includes("body")) {
          finalMarkup = finalMarkup.replace(replacement, post?.body);
        }
        if (prop.includes("path")) {
          finalMarkup = finalMarkup.replace(replacement, post?.path);
        }
        if (prop.includes("title")) {
          finalMarkup = finalMarkup.replace(
            replacement,
            post?.attributes?.title
          );
        }
        if (prop.includes("description")) {
          finalMarkup = finalMarkup.replace(
            replacement,
            post?.attributes?.description
          );
        }
        if (prop.includes("date")) {
          finalMarkup = finalMarkup.replace(
            replacement,
            new Date(parseInt(post?.attributes?.date)).toDateString()
          );
        }
      }
    } else {
      finalMarkup = finalMarkup.replace(replacement, config[prop]);
    }
  }
  return finalMarkup;
};
const convertRegularRegex = async (markupFromExternalFile, files, posts) => {
  let finalMarkup,
    result = [];
  try {
    const resp = await readFileAsyncLayout(files);
    markupFromExternalFile = resp.toString("utf-8");
    finalMarkup = markupFromExternalFile;
    for (const post of posts) {
      result.push(convertMarkdowntoHtml(finalMarkup, regex, post));
    }
    result = result.join("");
    return result;
  } catch (error) {
    console.log(error);
  }
};

//Function to build files asynchronously
const convertFiles = async (posts) => {
  let markupFromExternalFile;
  const files = await fs.promises.readdir(moveFrom);
  for (const file of files) {
    if (file == config.mapPostsTo.fileName) {
      let mappedPosts = await convertRegularRegex(
        markupFromExternalFile,
        file,
        posts
      );
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
