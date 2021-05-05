const fm = require("front-matter");
const fs = require("fs");
const marked = require("./marked");
const path = require("path");
const util = require("util");

const configPath = path.join(process.cwd(), "config");
const config = require(configPath);
const singleBlogTemplate = require("./layout/blog-post-layout");
const postLayout = config.postsLayout.postsdir;
const readFile = util.promisify(fs.readFile);

//Function to read file asynchronously
const readFileAsync = async (filename) => {
  return readFile(`${postLayout}/${filename}`);
};

//Read and process markdown file
const createPost = (postPath) => {
  const data = fs.readFileSync(
    `${config.postPath.postsdir}/${postPath}.md`,
    "utf8"
  );
  const content = fm(data);
  content.body = marked(content.body);
  content.path = postPath;
  return content;
};

//Build blog posts
const Regex = /\{(.*?)\}/g;
// const postRegex = /\\?{{(.+?)}}/gs;

const convertMarkdowntoHtml = (finalMarkup, regex = Regex, post) => {
  const changes = finalMarkup.matchAll(regex);
  while (true) {
    const change = changes.next();
    if (change.done) break;
    let [replacement, prop] = change.value;

    if (
      prop.includes("title") ||
      prop.includes("description") ||
      prop.includes("body")
    ) {
      if (post) {
        if (prop.includes("body", post?.body)) {
          finalMarkup = finalMarkup.replace(replacement, post?.body);
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
      }
    } else {
      finalMarkup = finalMarkup.replace(replacement, config[prop]);
    }
  }
  return finalMarkup;
};

const convertRegularRegex = async (markupFromExternalFile, files) => {
  let finalMarkup,
    result = null;
  try {
    const resp = await readFileAsync(files[0]);
    markupFromExternalFile = resp.toString("utf-8");
    finalMarkup = markupFromExternalFile;
    result = convertMarkdowntoHtml(finalMarkup, Regex, null);
    return result;
  } catch (error) {
    console.log(error);
  }
};

const createPosts = async (posts) => {
  let markupFromExternalFile, finalMarkup;
  const files = await fs.promises.readdir(postLayout);
  finalMarkup = await convertRegularRegex(markupFromExternalFile, files);
  posts.forEach((post) => {
    let newMarkup = null;
    if (!fs.existsSync(`${config.postPath.outdir}/${post.path}`))
      fs.mkdirSync(`${config.postPath.outdir}/${post.path}`);
    newMarkup = convertMarkdowntoHtml(finalMarkup, Regex, post);
    fs.writeFile(
      `${config.postPath.outdir}/${post.path}/index.html`,
      newMarkup,
      (e) => {
        if (e) throw e;
      }
    );
  });
};

module.exports = {
  createPost: createPost,
  createPosts: createPosts,
};
