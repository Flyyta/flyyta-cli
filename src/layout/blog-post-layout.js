const path = require("path");

const configPath = path.join(process.cwd(), "config");
const config = require(configPath);
//Single Blog Post Template
const singleBlogTemplate = (data) => `
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="${data.attributes.description}" />
        <link rel="stylesheet" href="/assets/styles/flyyta.light.css">
        <link rel="stylesheet" href="/assets/styles/highlights.css">
        <link rel="stylesheet" href="/assets/styles/main.css">
        <title>${data.attributes.title}</title>
    </head>
    <body>
        <div class="flyyta">
            <header>
                <a href="/">Go back home</a>
                <p>—</p>
            </header>

            <div class="content">
                <h1>${data.attributes.title}</h1>
                <p>${new Date(
                  parseInt(data.attributes.date)
                ).toDateString()}</p>
                <hr />
                ${data.body}
            </div>

            <footer>
                ${`<p>© ${new Date().getFullYear()} {siteAuthorName}, Find the code on <a href="github.com/Flyyta">GitHub</a></p>`}
            </footer>
        </div>
    </body>
</html>
`;
module.exports = singleBlogTemplate;
