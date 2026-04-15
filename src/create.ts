import path from "node:path";
import { readFileSync } from "node:fs";
import fse from "fs-extra";
import simpleGit from "simple-git";
import type { Logger } from "./types";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const inquirer: any = require("inquirer");

const flyytaPackage = JSON.parse(
  readFileSync(path.join(__dirname, "..", "package.json"), "utf8"),
) as { version: string };

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

function getStarter(template: keyof typeof STARTERS) {
  return STARTERS[template];
}

function assertValidTemplate(template: string | undefined): asserts template is keyof typeof STARTERS {
  if (!template || template in STARTERS) {
    return;
  }

  throw new Error(
    `Unknown starter template "${template}". Valid templates: ${Object.keys(STARTERS).join(", ")}.`
  );
}

async function syncStarterPackageJson(targetDir: string): Promise<void> {
  const packageJsonPath = path.join(targetDir, "package.json");
  const packageJson = JSON.parse(await fse.readFile(packageJsonPath, "utf8")) as {
    dependencies?: Record<string, string>;
  };
  const dependencies = packageJson.dependencies ?? {};

  packageJson.dependencies = {
    ...dependencies,
    flyyta: flyytaPackage.version,
  };

  await fse.writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
}

export async function scaffoldProject(options: {
  rootDir: string;
  directory?: string;
  template?: keyof typeof STARTERS;
  git?: boolean;
  logger: Logger;
}): Promise<void> {
  assertValidTemplate(options.template);

  const answers: {
    directory: string;
    template: keyof typeof STARTERS;
    git: boolean;
  } = {
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
      ).template as keyof typeof STARTERS,
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

  const starter = getStarter(answers.template);
  const targetDir = path.resolve(options.rootDir, answers.directory);
  if (await fse.pathExists(targetDir)) {
    throw new Error(`Directory already exists: ${targetDir}`);
  }

  await fse.copy(starter.templatePath, targetDir);
  await syncStarterPackageJson(targetDir);

  if (answers.git) {
    const git = simpleGit({ baseDir: targetDir });
    await git.init();
  }

  options.logger.success(`Created ${starter.label} starter in ${targetDir}`);
  options.logger.info(`Next steps:\n  cd ${answers.directory}\n  npm install\n  npm run dev`);
}
