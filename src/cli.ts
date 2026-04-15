#!/usr/bin/env node
import { Command } from "commander";
import packageJson from "../package.json";
import { createLogger } from "./utils";
import { buildProject, startDev } from "./framework";
import { loadConfig } from "./config";
import { scaffoldProject } from "./create";
import { startNodeServer } from "./runtime";

async function main(): Promise<void> {
  const program = new Command();

  program.name("flyyta").description(packageJson.description).version(packageJson.version);

  program
    .command("create [directory]")
    .alias("c")
    .option("-t, --template <template>", "Starter template")
    .option("--git", "Initialize a git repository")
    .option("--no-git", "Skip git initialization")
    .option("--verbose", "Enable verbose logging")
    .action(async (directory: string | undefined, options: { template?: "blog" | "portfolio" | "documentation"; git?: boolean; verbose?: boolean }) => {
      const logger = createLogger({ verbose: options.verbose });
      await scaffoldProject({
        rootDir: process.cwd(),
        directory,
        template: options.template,
        git: options.git,
        logger,
      });
    });

  program
    .command("build")
    .alias("b")
    .option("-r, --root <directory>", "Project root directory", process.cwd())
    .option("--verbose", "Enable verbose logging")
    .option("--silent", "Silence standard logging")
    .action(async (options: { root: string; verbose?: boolean; silent?: boolean }) => {
      const logger = createLogger(options);
      await buildProject(options.root, logger);
    });

  program
    .command("dev")
    .alias("d")
    .option("-r, --root <directory>", "Project root directory", process.cwd())
    .option("--verbose", "Enable verbose logging")
    .option("--silent", "Silence standard logging")
    .action(async (options: { root: string; verbose?: boolean; silent?: boolean }) => {
      const logger = createLogger(options);
      await startDev(options.root, logger);
    });

  program
    .command("start")
    .alias("s")
    .option("-r, --root <directory>", "Project root directory", process.cwd())
    .option("--verbose", "Enable verbose logging")
    .option("--silent", "Silence standard logging")
    .action(async (options: { root: string; verbose?: boolean; silent?: boolean }) => {
      const logger = createLogger(options);
      await startDev(options.root, logger);
    });

  program
    .command("serve")
    .option("-r, --root <directory>", "Project root directory", process.cwd())
    .option("--verbose", "Enable verbose logging")
    .option("--silent", "Silence standard logging")
    .action(async (options: { root: string; verbose?: boolean; silent?: boolean }) => {
      const logger = createLogger(options);
      const config = await loadConfig(options.root);
      await startNodeServer(config, logger);
    });

  await program.parseAsync(process.argv);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
