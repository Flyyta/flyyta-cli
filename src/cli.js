#!/usr/bin/env node
const program = require("commander");
const { prompt } = require("inquirer");
const simpleGit = require("simple-git");
const chalk = require("chalk");
const shell = require("shelljs");
const emoji = require("node-emoji");
const fs = require("fs");
const path = require("path");
const express = require("express");
const Spinner = require("cli-spinner").Spinner;

const option = {
  baseDir: process.cwd(),
};
const git = simpleGit(option);
const spinnerText = new Spinner("Crafting your project.. %s");
spinnerText.setSpinnerString(0);
const spinnerText2 = new Spinner("Installing the required dependencies.. %s");
spinnerText2.setSpinnerString(1);
const createProjectQuestions = [
  {
    type: "input",
    name: "project_name",
    message: "Enter Project Name : ",
    default: "my-amazing-website",
  },
  {
    type: "list",
    name: "template",
    message: "Select the template you want to build with today :",
    choices: ["Blank", "Blog", "Portfolio"],
  },
  {
    type: "list",
    name: "gitinit",
    message: "Do you want to initialise a git repository ?",
    choices: ["Yes", "No"],
  },
];

program
  .version("1.0.0")
  .description("A CLI Tool to create, build and deploy Flyyta Projects");

//Create Flyyta Project
program
  .command("create")
  .alias("c")
  .description("Create Flyyta Project")
  .action(() => {
    prompt(createProjectQuestions).then((answers) => {
      spinnerText.start();
      switch (answers.template) {
        case "Blank":
          const dir = `./${answers.project_name}`;
          let gitinit;
          if (!fs.existsSync(dir)) fs.mkdirSync(dir);
          if (answers.gitinit == "Yes") gitinit = `&& git init`;
          else gitinit = "";
          git
            .clone("https://github.com/Flyyta/Flyyta-Blog.git", `${dir}`)
            .then((res) => {
              spinnerText.stop(true);
              console.log(
                chalk.green(
                  `${emoji.get(
                    "heavy_check_mark"
                  )} Successfully Created Project`
                )
              );
              spinnerText2.start();
              shell.exec(`cd ${dir} && npm install && rm -rf .git ${gitinit}`);
              spinnerText2.stop(true);
              console.log(
                chalk.green(
                  `${emoji.get(
                    "heavy_check_mark"
                  )} Successfully Installed Dependencies`
                )
              );
              console.log(chalk.green(`Next Steps ${emoji.get("arrow_down")}`));
              console.log(
                chalk.green(
                  `${emoji.get("arrow_right")}  cd ${
                    answers.project_name
                  }\n${emoji.get("arrow_right")}  npm run dev\n`
                )
              );
              console.log(
                chalk.green(
                  `Create something wonderful ! ${emoji.get("heart")}`
                )
              );
            })
            .catch((err) => {
              console.log(
                chalk.red("\nAn Error Occurred while creating your project!")
              );
              process.exit(1);
            });
          break;
        case "Blog":
          return console.log("Blog project will be created here");
        case "Portfolio":
          return console.log("Portfolio project will be created here");
        default:
          return {};
      }
    });
  });

// Start Project
program
  .command("start")
  .alias("s")
  .description("Start Flyyta Project ")
  .action(() => {
    const postMethods = require("./posts");
    const convertFiles = require("./convert");
    const configPath = path.join(process.cwd(), "config");
    const config = require(configPath);
    const app = express();
    const port = process.env.PORT || 5000;
    const publicPath = path.join(process.cwd(), "public");
    const postPath = path.join(process.cwd(), config.postPath.postsdir);
    app.use(express.static(publicPath));
    try {
      const posts = fs
        .readdirSync(postPath)
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
        console.log(chalk.green(`Server is listening on port ${port}`));
      });
    } catch (error) {
      console.log(
        chalk.red(`The folder ${config.postPath.postsdir} does not exists !`)
      );
      process.exit(1);
    }
  });

// Build Project
program
  .command("build")
  .alias("b")
  .description("Build Flyyta Project ")
  .action(() => {
    console.log(process.cwd());
  });

program.parse(process.argv);
