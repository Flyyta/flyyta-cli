import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import util from "node:util";

type CommandOptions = {
  cwd: string;
  env?: NodeJS.ProcessEnv;
};

function run(command: string, args: string[], options: CommandOptions): string {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    throw new Error(
      [`Command failed: ${command} ${args.join(" ")}`, stdout, stderr].filter(Boolean).join("\n\n")
    );
  }

  return result.stdout;
}

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  const packageJson = JSON.parse(
    await fs.promises.readFile(path.join(repoRoot, "package.json"), "utf8")
  ) as { name: string; version: string };
  const tarballName = `${packageJson.name.replace(/^@/, "").replaceAll("/", "-")}-${packageJson.version}.tgz`;
  const tarballPath = path.join(repoRoot, tarballName);
  const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), "flyyta-pack-smoke-"));
  const distDir = path.join(repoRoot, "dist");
  const distExisted = fs.existsSync(distDir);

  try {
    run("npm", ["pack"], { cwd: repoRoot });

    const packageSpec = `file:${tarballPath}`;
    run("npx", ["--yes", "--package", packageSpec, "flyyta", "create", "smoke-app", "--template", "blog", "--no-git"], {
      cwd: tempRoot,
    });

    const appDir = path.join(tempRoot, "smoke-app");
    assert.ok(fs.existsSync(path.join(appDir, "config.ts")), "Expected starter config.ts to be created");

    run("npm", ["install"], { cwd: appDir });
    run("npx", ["--yes", "--package", packageSpec, "flyyta", "build", "--root", appDir], {
      cwd: tempRoot,
    });

    assert.ok(fs.existsSync(path.join(appDir, "dist", "index.html")), "Expected smoke build output to exist");
    console.log("Packaged CLI smoke test passed.");
  } finally {
    await fs.promises.rm(tempRoot, { recursive: true, force: true });
    await fs.promises.rm(tarballPath, { force: true });
    if (!distExisted) {
      await fs.promises.rm(distDir, { recursive: true, force: true });
    }
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : util.inspect(error));
  process.exit(1);
});
