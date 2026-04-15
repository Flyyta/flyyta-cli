import path from "path";
import fse from "fs-extra";
import simpleGit from "simple-git";
import type { Logger } from "./types";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const inquirer: any = require("inquirer");

function starterRoot(): string {
  // Emitted beside dist/create.js → ../starters; same relative layout when running from src via tsx
  return path.resolve(__dirname, "../starters");
}

export const STARTERS = {
  blog: {
    name: "blog",
    label: "React Blog",
    description: "React-first blog starter with SSR/SSG-ready route components.",
    templatePath: path.join(starterRoot(), "react-blog"),
  },
  portfolio: {
    name: "portfolio",
    label: "React Portfolio",
    description: "Portfolio starter with SSR-ready app routes.",
    templatePath: path.join(starterRoot(), "react-portfolio"),
  },
  documentation: {
    name: "documentation",
    label: "React Documentation",
    description: "Documentation starter with markdown content and React routes.",
    templatePath: path.join(starterRoot(), "react-documentation"),
  },
} as const;

export async function scaffoldProject(options: {
  rootDir: string;
  directory?: string;
  template?: keyof typeof STARTERS;
  git?: boolean;
  logger: Logger;
}): Promise<void> {
  const answers = {
    directory:
      options.directory ||
      (
        await inquirer.prompt([
          {
            type: "input",
            name: "directory",
            message: "Project directory",
            default: "my-flyyta-app",
          },
        ])
      ).directory,
    template:
      options.template ||
      (
        await inquirer.prompt([
          {
            type: "list",
            name: "template",
            message: "Choose a starter",
            choices: Object.values(STARTERS).map((starter) => ({
              name: `${starter.label} (${starter.description})`,
              value: starter.name,
            })),
          },
        ])
      ).template,
    git:
      typeof options.git === "boolean"
        ? options.git
        : (
            await inquirer.prompt([
              {
                type: "confirm",
                name: "git",
                message: "Initialize a git repository?",
                default: true,
              },
            ])
          ).git,
  };

  const starter = STARTERS[answers.template as keyof typeof STARTERS];
  const targetDir = path.resolve(options.rootDir, answers.directory);
  if (await fse.pathExists(targetDir)) {
    throw new Error(`Directory already exists: ${targetDir}`);
  }

  await fse.copy(starter.templatePath, targetDir);

  if (answers.git) {
    const git = simpleGit({ baseDir: targetDir });
    await git.init();
  }

  options.logger.success(`Created ${starter.label} starter in ${targetDir}`);
  options.logger.info(`Next steps:\n  cd ${answers.directory}\n  npm install\n  npx flyyta dev`);
}
