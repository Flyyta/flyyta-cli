import assert from "node:assert/strict";
import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import util from "node:util";

type CommandOptions = {
  cwd: string;
  env?: NodeJS.ProcessEnv;
};

type RunningCommand = {
  process: ReturnType<typeof spawn>;
  output: string[];
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

function start(command: string, args: string[], options: CommandOptions): RunningCommand {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output: string[] = [];

  child.stdout.on("data", (chunk) => {
    output.push(String(chunk));
  });
  child.stderr.on("data", (chunk) => {
    output.push(String(chunk));
  });

  return { process: child, output };
}

async function getAvailablePort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not determine an available port."));
        return;
      }
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(address.port);
      });
    });
    server.on("error", reject);
  });
}

async function waitForHttp(url: string, expectedText: string, timeoutMs = 30000): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const body = await response.text();
        if (body.includes(expectedText)) {
          return;
        }
      }
    } catch {
      // Server is still booting.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${url} to serve content containing "${expectedText}".`);
}

async function stop(running: RunningCommand): Promise<void> {
  if (running.process.exitCode !== null) {
    return;
  }

  running.process.kill("SIGTERM");
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      running.process.kill("SIGKILL");
      resolve();
    }, 5000);

    running.process.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
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
    const appPackageJson = JSON.parse(
      await fs.promises.readFile(path.join(appDir, "package.json"), "utf8"),
    ) as { dependencies?: Record<string, string> };
    assert.equal(
      appPackageJson.dependencies?.flyyta,
      packageJson.version,
      "Expected created app to pin the matching flyyta version",
    );
    const servePort = await getAvailablePort();
    const devPort = await getAvailablePort();
    const clientPort = await getAvailablePort();
    const configPath = path.join(appDir, "config.ts");
    const configSource = await fs.promises.readFile(configPath, "utf8");
    await fs.promises.writeFile(
      configPath,
      configSource.replace(
        "  react: {\n    appDir: \"./app\",\n  },\n};",
        `  react: {\n    appDir: "./app",\n  },\n  dev: {\n    port: ${servePort},\n    clientPort: ${clientPort},\n  },\n};`,
      ),
      "utf8",
    );
    const dependencies = appPackageJson.dependencies ?? {};
    appPackageJson.dependencies = {
      ...dependencies,
      flyyta: packageSpec,
    };
    await fs.promises.writeFile(
      path.join(appDir, "package.json"),
      `${JSON.stringify(appPackageJson, null, 2)}\n`,
      "utf8",
    );

    run("npm", ["install"], { cwd: appDir });
    run("npm", ["run", "build"], { cwd: appDir });
    const serveProcess = start("npm", ["run", "serve"], { cwd: appDir });
    try {
      await waitForHttp(`http://127.0.0.1:${servePort}/`, "Latest posts");
    } finally {
      await stop(serveProcess);
    }

    await fs.promises.writeFile(
      configPath,
      (
        await fs.promises.readFile(configPath, "utf8")
      ).replace(`port: ${servePort}`, `port: ${devPort}`),
      "utf8",
    );
    const devProcess = start("npm", ["run", "dev"], { cwd: appDir });
    try {
      await waitForHttp(`http://127.0.0.1:${devPort}/`, "Latest posts");
    } finally {
      await stop(devProcess);
    }

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
