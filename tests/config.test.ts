import test from "node:test";
import assert from "node:assert/strict";
import path from "path";
import { loadConfig } from "../src/config";

test("loadConfig normalizes a legacy config", async () => {
  const rootDir = path.join(__dirname, "fixtures/legacy-blog");
  const config = await loadConfig(rootDir);

  assert.equal(config.adapter, "legacy-nunjucks");
  assert.equal(config.compatibility.legacyProject, true);
  assert.equal(path.basename(config.paths.contentDir), "content");
  assert.equal(path.basename(config.paths.singlePostTemplatePath), "blog.html");
});

test("loadConfig supports TypeScript React configs", async () => {
  const rootDir = path.join(__dirname, "fixtures/react-app");
  const config = await loadConfig(rootDir);

  assert.equal(config.adapter, "react");
  assert.equal(path.basename(config.paths.appDir), "app");
  assert.equal(config.react.enabled, true);
});
