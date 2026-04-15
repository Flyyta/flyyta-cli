import fs from "fs";
import path from "path";
import express from "express";
import fse from "fs-extra";
import { createRsbuild } from "@rsbuild/core";
import type { Logger, NormalizedConfig, RouteDefinition } from "./types";
import { loadContent } from "./content";
import { createBuildGraph } from "./framework-shared";
import { reactAdapter, renderReactRoute } from "./adapters/react";
import { fileExists } from "./utils";

interface RsbuildRuntimeOptions {
  rootDir: string;
  appDir: string;
  outDir: string;
  clientPort: number;
  logger: Logger;
}

async function createReactPlugin(): Promise<unknown> {
  const mod = (await import("@rsbuild/plugin-react")) as {
    pluginReact: () => unknown;
  };
  return mod.pluginReact();
}

async function ensureClientEntry(rootDir: string, appDir: string): Promise<string> {
  const preferred = path.join(appDir, "client.tsx");
  if (fileExists(preferred)) {
    return preferred;
  }

  const generatedDir = path.join(rootDir, ".flyyta");
  await fse.ensureDir(generatedDir);
  const generatedEntry = path.join(generatedDir, "client-entry.tsx");
  await fs.promises.writeFile(
    generatedEntry,
    [
      "import React from 'react';",
      "import { hydrateRoot } from 'react-dom/client';",
      "const root = document.getElementById('root');",
      "if (root && root.childNodes.length === 0) {",
      "  hydrateRoot(root, React.createElement('div', null));",
      "}",
    ].join("\n"),
    "utf8"
  );
  return generatedEntry;
}

export async function buildRsbuildArtifacts(options: RsbuildRuntimeOptions): Promise<void> {
  const entry = await ensureClientEntry(options.rootDir, options.appDir);
  const reactPlugin = await createReactPlugin();
  const rsbuild = await createRsbuild({
    cwd: options.rootDir,
    rsbuildConfig: {
      plugins: [reactPlugin],
      source: {
        entry: {
          app: entry,
        },
      },
      output: {
        distPath: {
          root: path.join(options.outDir, "__flyyta__"),
        },
        cleanDistPath: true,
      },
      tools: {
        htmlPlugin: false,
      },
      server: {
        port: options.clientPort,
      },
    } as any,
  });

  await rsbuild.build();
  options.logger.success("Built React client assets with Rsbuild");
}

export async function startRsbuildDevClient(options: RsbuildRuntimeOptions): Promise<() => Promise<void>> {
  const entry = await ensureClientEntry(options.rootDir, options.appDir);
  const reactPlugin = await createReactPlugin();
  const rsbuild = await createRsbuild({
    cwd: options.rootDir,
    rsbuildConfig: {
      plugins: [reactPlugin],
      source: {
        entry: {
          app: entry,
        },
      },
      output: {
        distPath: {
          root: path.join(options.outDir, "__flyyta__"),
        },
      },
      server: {
        port: options.clientPort,
      },
    } as any,
  });

  const server = await rsbuild.startDevServer();
  options.logger.success(`Rsbuild client dev server running on port ${options.clientPort}`);
  return async () => {
    await server.server.close();
  };
}

function extractParams(route: RouteDefinition, requestPath: string): Record<string, string> {
  if (!route.pattern) {
    return route.params || {};
  }

  const match = route.pattern.exec(requestPath);
  if (!match) {
    return {};
  }

  const sourcePath = route.sourcePath || "";
  const relative = sourcePath.includes("/app/") ? sourcePath.split("/app/")[1] : sourcePath;
  const segments = relative.replace(/\/page\.(tsx|ts|jsx|js)$/i, "").split("/").filter(Boolean);
  const dynamicSegments = segments.filter((segment) => segment.startsWith("[") && segment.endsWith("]"));
  return Object.fromEntries(dynamicSegments.map((segment, index) => [segment.slice(1, -1), match[index + 1] || ""]));
}

export async function startNodeServer(
  config: NormalizedConfig,
  logger: Logger,
  routeSource?: RouteDefinition[]
): Promise<{ close: () => Promise<void> }> {
  const app = express();
  app.use(express.static(config.paths.outDir));

  if (config.adapter === "react") {
    app.get("*", async (request, response, next) => {
      try {
        const content = await loadContent(config);
        const routes =
          routeSource ||
          (await reactAdapter.discoverRoutes({
            config,
            content,
            logger,
            graph: createBuildGraph(),
          }));
        const pathname = request.path.endsWith("/") ? request.path : `${request.path}/`;
        const matchedRoute =
          routes.find((route) => route.urlPath === pathname && route.renderMode !== "static") ||
          routes.find((route) => route.pattern?.test(pathname));

        if (!matchedRoute || matchedRoute.renderMode === "static") {
          next();
          return;
        }

        const params = extractParams(matchedRoute, pathname);
        const firstRoute = await renderReactRoute(
          {
            config,
            content,
            logger,
            graph: createBuildGraph(),
          },
          { ...matchedRoute, params }
        );
        if (!firstRoute) {
          next();
          return;
        }
        response.send(firstRoute.contents);
      } catch (error) {
        next(error);
      }
    });
  }

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const instance = app.listen(config.dev.port, () => resolve(instance));
  });

  logger.success(`Server running at http://localhost:${config.dev.port}`);
  return {
    close: async () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}
