import test from "node:test";
import assert from "node:assert/strict";
import path from "path";
import { spawnSync } from "child_process";

const cliPath = path.join(__dirname, "../src/cli.ts");

function runCli(args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", cliPath, ...args], {
    encoding: "utf8",
  });
}

test("CLI exposes create, build, dev, serve, and start help", () => {
  for (const command of ["create", "build", "dev", "serve", "start"]) {
    const result = runCli([command, "--help"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, new RegExp(command));
  }
});
