import test from "node:test";
import assert from "node:assert/strict";
import os from "os";
import path from "path";
import fs from "fs";
import fse from "fs-extra";
import { buildProject } from "../src/framework";
import { createLogger } from "../src/utils";

async function prepareFixture(fixtureName: string): Promise<string> {
  const sourceDir = path.join(__dirname, "fixtures", fixtureName);
  const targetDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), `flyyta-${fixtureName}-`));
  await fse.copy(sourceDir, targetDir);
  await fse.ensureSymlink(path.join(process.cwd(), "node_modules"), path.join(targetDir, "node_modules"));
  return targetDir;
}

function silentLogger() {
  return createLogger({ silent: true });
}

test("buildProject preserves legacy Flyyta projects through the compatibility adapter", async (t) => {
  const rootDir = await prepareFixture("legacy-blog");
  t.after(async () => {
    await fse.remove(rootDir);
  });

  const result = await buildProject(rootDir, silentLogger());
  const publicDir = path.join(rootDir, "public");
  const indexHtml = await fs.promises.readFile(path.join(publicDir, "index.html"), "utf8");

  assert.match(indexHtml, /Second Legacy Post/);
  assert.equal(result.config.adapter, "legacy-nunjucks");
  assert.ok(await fse.pathExists(path.join(publicDir, "second-post/index.html")));
  assert.ok(await fse.pathExists(path.join(publicDir, "route-manifest.json")));
});

test("buildProject renders a React adapter fixture with static and server manifests", async (t) => {
  const rootDir = await prepareFixture("react-app");
  t.after(async () => {
    await fse.remove(rootDir);
  });

  const result = await buildProject(rootDir, silentLogger());
  const distDir = path.join(rootDir, "dist");
  const indexHtml = await fs.promises.readFile(path.join(distDir, "index.html"), "utf8");
  const blogHtml = await fs.promises.readFile(path.join(distDir, "blog/hello-world/index.html"), "utf8");
  const serverManifest = await fs.promises.readFile(path.join(distDir, "server-manifest.json"), "utf8");

  assert.equal(result.config.adapter, "react");
  assert.match(indexHtml, /React Home/);
  assert.match(blogHtml, /hello-world/);
  assert.match(serverManifest, /ssr/);
  assert.ok(await fse.pathExists(path.join(distDir, "route-manifest.json")));
  assert.ok(!(await fse.pathExists(path.join(distDir, "ssr/index.html"))));
});
