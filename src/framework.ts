import path from "path";
import fs from "fs";
import fse from "fs-extra";
import chokidar from "chokidar";
import type {
  BuildPayload,
  BuildResult,
  FlyytaAdapter,
  FlyytaHookMap,
  LoadedContent,
  Logger,
  NormalizedConfig,
} from "./types";
import { loadConfig } from "./config";
import { loadContent } from "./content";
import { createBuildGraph } from "./framework-shared";
import { legacyNunjucksAdapter } from "./adapters/legacy-nunjucks";
import { reactAdapter } from "./adapters/react";
import { startNodeServer, startRsbuildDevClient } from "./runtime";

async function runHook<TPayload>(
  hooks: FlyytaHookMap,
  name: keyof FlyytaHookMap,
  payload: TPayload
): Promise<TPayload> {
  const handlers = hooks[name];
  if (!handlers) {
    return payload;
  }

  const list = Array.isArray(handlers) ? handlers : [handlers];
  let currentPayload = payload;
  for (const handler of list as Array<(value: unknown) => unknown>) {
    const nextPayload = await handler(currentPayload as unknown);
    if (typeof nextPayload !== "undefined") {
      currentPayload = nextPayload as TPayload;
    }
  }

  return currentPayload;
}

function resolveAdapter(config: NormalizedConfig): FlyytaAdapter {
  return config.adapter === "react" ? reactAdapter : legacyNunjucksAdapter;
}

function createXmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function ensureSupplementalFile(
  payload: BuildPayload,
  outputPath: string,
  contents: string
): void {
  if (payload.supplementalFiles.some((entry) => entry.outputPath === outputPath)) {
    return;
  }

  payload.supplementalFiles.push({ outputPath, contents });
}

async function writeBuildOutputs(payload: BuildPayload): Promise<void> {
  for (const route of payload.routes) {
    const destinationPath = path.join(payload.config.paths.outDir, route.outputPath);
    await fse.ensureDir(path.dirname(destinationPath));
    await fs.promises.writeFile(destinationPath, route.contents, "utf8");
  }

  for (const supplementalFile of payload.supplementalFiles) {
    const destinationPath = path.join(payload.config.paths.outDir, supplementalFile.outputPath);
    await fse.ensureDir(path.dirname(destinationPath));
    await fs.promises.writeFile(destinationPath, supplementalFile.contents, "utf8");
  }
}

export async function buildProject(
  rootDir: string,
  logger: Logger,
  providedConfig?: NormalizedConfig
): Promise<BuildResult> {
  let config = providedConfig || (await loadConfig(rootDir));
  config = await runHook(config.hooks, "onConfig", config);

  let content: LoadedContent = await loadContent(config);
  content = await runHook(config.hooks, "onContentLoaded", content);

  const graph = createBuildGraph();
  const adapter = resolveAdapter(config);
  let routes = await adapter.discoverRoutes({
    config,
    content,
    logger,
    graph,
  });
  routes = await runHook(config.hooks, "onRoutesGenerated", routes);

  let payload: BuildPayload = {
    config,
    content,
    graph,
    ...(await adapter.build(
      {
        config,
        content,
        logger,
        graph,
      },
      routes
    )),
  };

  if (config.features.sitemap) {
    ensureSupplementalFile(
      payload,
      "sitemap.xml",
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${payload.routes
        .map((route) => {
          const absoluteUrl = new URL(
            route.route.urlPath.replace(/^\//, ""),
            config.site.url.endsWith("/") ? config.site.url : `${config.site.url}/`
          ).toString();
          return `<url><loc>${createXmlEscape(absoluteUrl)}</loc></url>`;
        })
        .join("")}</urlset>`
    );
  }

  if (config.features.rss) {
    ensureSupplementalFile(
      payload,
      "rss.xml",
      `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${createXmlEscape(
        config.site.name
      )}</title>${content.posts
        .slice(0, 20)
        .map((post) => {
          const absoluteUrl = new URL(
            post.urlPath.replace(/^\//, ""),
            config.site.url.endsWith("/") ? config.site.url : `${config.site.url}/`
          ).toString();
          return `<item><title>${createXmlEscape(post.title)}</title><link>${createXmlEscape(
            absoluteUrl
          )}</link><description>${createXmlEscape(post.description || post.excerpt)}</description></item>`;
        })
        .join("")}</channel></rss>`
    );
  }

  if (config.features.robotsTxt) {
    ensureSupplementalFile(
      payload,
      "robots.txt",
      `User-agent: *\nAllow: /\nSitemap: ${new URL(
        "sitemap.xml",
        config.site.url.endsWith("/") ? config.site.url : `${config.site.url}/`
      ).toString()}\n`
    );
  }

  if (config.features.searchIndex) {
    ensureSupplementalFile(
      payload,
      "search-index.json",
      JSON.stringify(
        content.posts.map((post) => ({
          title: post.title,
          description: post.description,
          excerpt: post.excerpt,
          url: post.urlPath,
          tags: post.tags,
          categories: post.categories,
        })),
        null,
        2
      )
    );
  }

  payload = await runHook(config.hooks, "onBeforeWrite", payload);
  await writeBuildOutputs(payload);
  const completed = await runHook(config.hooks, "onBuildComplete", payload);
  logger.success(`Built ${completed.routes.length} routes into ${config.paths.outDir}`);
  return completed;
}

export async function startDev(rootDir: string, logger: Logger): Promise<{ close: () => Promise<void> }> {
  const config = await loadConfig(rootDir);
  let result = await buildProject(rootDir, logger, config);
  let closeClient = async (): Promise<void> => {};

  if (config.adapter === "react") {
    const hasClientRoutes = result.routes.some(
      (route) => route.route.renderMode === "client" || route.route.renderMode === "hybrid"
    );
    if (hasClientRoutes) {
      closeClient = await startRsbuildDevClient({
        rootDir,
        appDir: config.paths.appDir,
        outDir: config.paths.outDir,
        clientPort: config.dev.clientPort,
        logger,
      });
    }
  }

  const server = await startNodeServer(config, logger);
  const watcher = chokidar.watch(
    [
      path.join(rootDir, "config.ts"),
      path.join(rootDir, "config.js"),
      path.join(rootDir, "config.cjs"),
      config.paths.contentDir,
      config.paths.sourceDir,
      config.paths.appDir,
      config.paths.publicDir,
    ],
    {
      ignoreInitial: true,
    }
  );

  watcher.on("all", async (_eventName, changedPath) => {
    const dependents = result.graph.dependentsOf(changedPath);
    if (dependents.length > 0) {
      logger.debug(`Impacted graph nodes: ${dependents.join(", ")}`);
    }
    logger.info(`Rebuilding because ${changedPath} changed`);
    result = await buildProject(rootDir, logger);
  });

  return {
    close: async () => {
      await watcher.close();
      await closeClient();
      await server.close();
    },
  };
}
