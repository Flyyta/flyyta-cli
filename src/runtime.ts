import fs from "fs";
import path from "path";
import express from "express";
import { createRsbuild } from "@rsbuild/core";
import type { NormalizedConfig, Logger, RouteDefinition, LoadedContent } from "./types";
import { reactAdapter, renderReactRoute } from "./adapters/react";
import { loadContent } from "./content";

export async function buildRsbuildArtifacts(options: {
  rootDir: string;
  appDir: string;
  outDir: string;
  logger: Logger;
}): Promise<void> {
  const { pluginReact } = (await import("@rsbuild/plugin-react")) as {
    pluginReact: () => unknown;
  };
  const rsbuild = await createRsbuild({
    cwd: options.rootDir,
    rsbuildConfig: {
      source: {
        entry: {
          app: path.join(options.appDir, "entry-client.tsx"),
        },
      },
      output: {
        distPath: {
          root: path.join(options.outDir, "client"),
        },
      },
      plugins: [pluginReact()],
    },
  });

  if (!fs.existsSync(path.join(options.appDir, "entry-client.tsx"))) {
    options.logger.debug("Skipping Rsbuild artifact build because entry-client.tsx is not present");
    return;
  }

  await rsbuild.build();
}

export async function startRsbuildDevClient(options: {
  rootDir: string;
  appDir: string;
  outDir: string;
  clientPort: number;
  logger: Logger;
}): Promise<() => Promise<void>> {
  if (!fs.existsSync(path.join(options.appDir, "entry-client.tsx"))) {
    options.logger.debug("Skipping Rsbuild dev server because entry-client.tsx is not present");
    return async () => {};
  }

  const { pluginReact } = (await import("@rsbuild/plugin-react")) as {
    pluginReact: () => unknown;
  };
  const rsbuild = await createRsbuild({
    cwd: options.rootDir,
    rsbuildConfig: {
      server: {
        port: options.clientPort,
      },
      source: {
        entry: {
          app: path.join(options.appDir, "entry-client.tsx"),
        },
      },
      output: {
        distPath: {
          root: path.join(options.outDir, "client"),
        },
      },
      plugins: [pluginReact()],
    },
  });

  const server = await rsbuild.startDevServer();
  options.logger.info(`Rsbuild client runtime listening on http://localhost:${options.clientPort}`);
  return async () => {
    await server.server.close();
  };
}

function routeToRegex(pattern: string): { regex: RegExp; keys: string[] } {
  const keys: string[] = [];
  const escaped = pattern.replace(/\//g, "\\/");
  const withParams = escaped
    .replace(/:([A-Za-z0-9_]+)\*/g, (_match, key: string) => {
      keys.push(key);
      return "(.*)";
    })
    .replace(/:([A-Za-z0-9_]+)/g, (_match, key: string) => {
      keys.push(key);
      return "([^/]+)";
    });
  return {
    regex: new RegExp(`^${withParams}$`),
    keys,
  };
}

function matchRoute(route: RouteDefinition, requestPath: string): Record<string, string> | null {
  const { regex, keys } = routeToRegex(route.pattern);
  const match = requestPath.match(regex);
  if (!match) {
    return null;
  }

  const entries = keys.map((key, index) => [key, match[index + 1]]);
  return Object.fromEntries(entries);
}

async function loadServerManifest(config: NormalizedConfig): Promise<RouteDefinition[]> {
  const manifestPath = path.join(config.paths.outDir, "server-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return [];
  }
  const rawManifest = await fs.promises.readFile(manifestPath, "utf8");
  return JSON.parse(rawManifest) as RouteDefinition[];
}

export async function startNodeServer(
  config: NormalizedConfig,
  logger: Logger
): Promise<{ close: () => Promise<void> }> {
  const app = express();
  const manifest = await loadServerManifest(config);
  const content = await loadContent(config);

  app.use(express.static(config.paths.outDir));
  if (fs.existsSync(config.paths.publicDir)) {
    app.use(express.static(config.paths.publicDir));
  }

  app.get("*", async (request, response, next) => {
    const urlPath = request.path.endsWith("/") ? request.path : `${request.path}/`;
    const route = manifest.find((candidate) => matchRoute(candidate, urlPath));
    if (!route) {
      next();
      return;
    }

    const params = matchRoute(route, urlPath) || {};
    if (config.adapter === "react") {
      const markup = await renderReactRoute(
        {
          config,
          content,
          logger,
          graph: {
            connect() {},
            dependentsOf() {
              return [];
            },
            dependenciesOf() {
              return [];
            },
            serialize() {
              return {};
            },
          },
        },
        route,
        params
      );
      response.status(200).type("html").send(markup);
      return;
    }

    const fallback = await reactAdapter.build(
      {
        config,
        content: content as LoadedContent,
        logger,
        graph: {
          connect() {},
          dependentsOf() {
            return [];
          },
          dependenciesOf() {
            return [];
          },
          serialize() {
            return {};
          },
        },
      },
      manifest
    );
    const matched = fallback.routes.find((entry) => entry.route.id === route.id);
    if (!matched) {
      response.status(404).send("Not found");
      return;
    }

    response.status(200).type("html").send(matched.contents);
  });

  app.use((_request, response) => {
    response.status(404).send("Not found");
  });

  const server = await new Promise<import("http").Server>((resolve) => {
    const instance = app.listen(config.dev.port, () => resolve(instance));
  });

  logger.info(`Flyyta runtime listening on http://localhost:${config.dev.port}`);

  return {
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}
