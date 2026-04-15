import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import fse from "fs-extra";
import packageJson from "../package.json";
import { scaffoldProject } from "../src/create";
import { createLogger } from "../src/utils";

test("scaffoldProject pins the generated app to the matching flyyta version", async (t) => {
  const rootDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "flyyta-create-"));
  t.after(async () => {
    await fse.remove(rootDir);
  });

  await scaffoldProject({
    rootDir,
    directory: "my-app",
    template: "blog",
    git: false,
    logger: createLogger({ silent: true }),
  });

  const appPackageJson = JSON.parse(
    await fs.promises.readFile(path.join(rootDir, "my-app", "package.json"), "utf8"),
  ) as { dependencies?: Record<string, string> };

  assert.equal(appPackageJson.dependencies?.flyyta, packageJson.version);
});
