import fs from "fs";
import path from "path";
import nunjucks from "nunjucks";
import fse from "fs-extra";
import type {
  AdapterBuildContext,
  AdapterBuildResult,
  FlyytaAdapter,
  LoadedContent,
  NormalizedConfig,
  PostRecord,
  RenderedRoute,
  RouteDefinition,
} from "../types";
import {
  chunkArray,
  ensureLeadingSlash,
  ensureTrailingSlash,
  ensureUrlTrailingSlash,
  fileExists,
  formatDate,
  outputPathFromUrl,
  routeToManifestEntry,
  stripLeadingDotSlash,
  toPosixPath,
  walkDirectory,
} from "../utils";
import { planLegacyRoutes } from "../routing";

const SAFE_LEGACY_KEYS = new Set(["body", "posts", "pagination", "content"]);

function transformLegacyPlaceholders(source: string): string {
  return source.replace(/\{+\s*([a-zA-Z0-9_.-]+)\s*\}+/g, (match, key) => {
    if (match.startsWith("{{") || match.startsWith("{%")) {
      return match;
    }
    const safeSuffix = SAFE_LEGACY_KEYS.has(key) || key.endsWith("Html") ? " | safe" : "";
    return `{{ legacy.${key}${safeSuffix} }}`;
  });
}

function createEnvironment(config: NormalizedConfig, assetManifest: Record<string, string>): nunjucks.Environment {
  const searchPaths = [
    config.rootDir,
    config.paths.sourceDir,
    path.dirname(config.paths.singlePostTemplatePath),
    path.dirname(config.paths.listTemplatePath),
  ].filter((candidate) => fileExists(candidate));

  const environment = new nunjucks.Environment(new nunjucks.FileSystemLoader(searchPaths, { noCache: true }), {
    autoescape: config.templates.autoescape,
    throwOnUndefined: false,
  });

  environment.addFilter("date", (value: string | number | Date | null) => formatDate(value));
  environment.addGlobal("asset", (targetPath: string) => {
    const normalized = ensureLeadingSlash(stripLeadingDotSlash(targetPath));
    return assetManifest[normalized] || normalized;
  });

  return environment;
}

function createLegacyContext(
  config: NormalizedConfig,
  post?: PostRecord,
  extras: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    siteName: config.site.name,
    siteHeading: config.site.heading,
    siteDescription: config.site.description,
    siteUrl: config.site.url,
    siteAuthorName: config.site.author.name,
    siteAuthorDescription: config.site.author.description,
    siteAuthorWebsite: config.site.author.website,
    title: post?.title || "",
    description: post?.description || "",
    date: post?.formattedDate || "",
    path: post?.urlPath?.replace(/^\/+|\/+$/g, "") || "",
    body: post?.content || "",
    ...extras,
  };
}

async function renderTemplate(
  environment: nunjucks.Environment,
  config: NormalizedConfig,
  templatePath: string,
  context: Record<string, unknown>
): Promise<string> {
  const source = await fs.promises.readFile(templatePath, "utf8");
  const compiled = config.compatibility.placeholderSyntax ? transformLegacyPlaceholders(source) : source;
  return environment.renderString(compiled, context);
}

function buildPaginationMarkup(baseUrl: string, pageNumber: number, pageCount: number): string {
  if (pageCount <= 1) {
    return "";
  }

  const items = Array.from({ length: pageCount }, (_, index) => {
    const page = index + 1;
    const url =
      page === 1
        ? ensureTrailingSlash(baseUrl)
        : baseUrl === "/"
          ? `/page/${page}/`
          : `${ensureTrailingSlash(baseUrl)}page/${page}/`;

    return page === pageNumber ? `<strong>${page}</strong>` : `<a href="${url}">${page}</a>`;
  });

  return `<nav aria-label="Pagination"><div>${items.join(" ")}</div></nav>`;
}

async function copyPublicAssets(config: NormalizedConfig): Promise<Record<string, string>> {
  const manifest: Record<string, string> = {};
  if (!fileExists(config.paths.publicDir)) {
    return manifest;
  }

  await fse.ensureDir(config.paths.outDir);
  const files = await walkDirectory(config.paths.publicDir);
  for (const filePath of files) {
    const relativePath = path.relative(config.paths.publicDir, filePath);
    const outPath = path.join(config.paths.outDir, relativePath);
    await fse.ensureDir(path.dirname(outPath));
    await fse.copyFile(filePath, outPath);
    manifest[`/${toPosixPath(relativePath)}`] = `/${toPosixPath(relativePath)}`;
  }

  return manifest;
}

function taxonomyMarkup(content: LoadedContent, slug: string, taxonomy: "tag" | "category"): string {
  const list = taxonomy === "tag" ? content.collections.tags : content.collections.categories;
  const entry = list.find((item) => item.slug === slug);
  if (!entry) {
    return "<main><h1>Not found</h1></main>";
  }
  return `<!DOCTYPE html><html><body><main><h1>${entry.name}</h1><ul>${entry.posts
    .map((post) => `<li><a href="${post.urlPath}">${post.title}</a></li>`)
    .join("")}</ul></main></body></html>`;
}

function archiveMarkup(content: LoadedContent): string {
  return `<!DOCTYPE html><html><body><main><h1>Archive</h1>${content.collections.archives
    .map((archive) => `<section><h2>${archive.year}</h2><ul>${archive.posts
      .map((post) => `<li><a href="${post.urlPath}">${post.title}</a></li>`)
      .join("")}</ul></section>`)
    .join("")}</main></body></html>`;
}

function notFoundMarkup(): string {
  return "<!DOCTYPE html><html><body><main><h1>Not found</h1><p><a href=\"/\">Return home</a></p></main></body></html>";
}

function sitemapMarkup(config: NormalizedConfig, routes: RenderedRoute[]): string {
  const urls = routes
    .map((entry) => new URL(entry.route.urlPath.replace(/^\//, ""), ensureUrlTrailingSlash(config.site.url)).toString())
    .map((url) => `<url><loc>${url}</loc></url>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

function rssMarkup(config: NormalizedConfig, content: LoadedContent): string {
  const items = content.posts
    .slice(0, 20)
    .map((post) => {
      const url = new URL(post.urlPath.replace(/^\//, ""), ensureUrlTrailingSlash(config.site.url)).toString();
      return `<item><title>${post.title}</title><link>${url}</link><description>${post.description || post.excerpt}</description></item>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${config.site.name}</title><link>${config.site.url}</link>${items}</channel></rss>`;
}

export const legacyNunjucksAdapter: FlyytaAdapter = {
  kind: "legacy-nunjucks",
  async discoverRoutes(context: AdapterBuildContext): Promise<RouteDefinition[]> {
    return planLegacyRoutes(context.config, context.content);
  },
  async build(context: AdapterBuildContext, routes: RouteDefinition[]): Promise<AdapterBuildResult> {
    const { config, content, graph } = context;
    await fse.remove(config.paths.outDir);
    await fse.ensureDir(config.paths.outDir);
    const assetManifest = await copyPublicAssets(config);
    const environment = createEnvironment(config, assetManifest);
    const listPageAbsolute = path.resolve(
      config.rootDir,
      config.collections.posts.listPage.fileDir,
      config.collections.posts.listPage.fileName
    );
    const pageChunks = chunkArray(content.posts, config.collections.posts.perPage);
    const renderedRoutes: RenderedRoute[] = [];

    for (const route of routes) {
      graph.connect(route.id, route.sourcePath || route.urlPath);

      if (route.kind === "page" && route.sourcePath) {
        const pageNumber = Number(route.context?.pageNumber || 1);
        const isListPage = path.resolve(route.sourcePath) === listPageAbsolute;
        const pagePosts = isListPage ? pageChunks[pageNumber - 1] || [] : content.posts;
        const pageCount = isListPage ? Math.max(pageChunks.length, 1) : 1;
        const postsHtml = isListPage
          ? (
              await Promise.all(
                pagePosts.map((post) =>
                  renderTemplate(environment, config, config.paths.listTemplatePath, {
                    site: config.site,
                    post,
                    legacy: createLegacyContext(config, post),
                  })
                )
              )
            ).join("\n")
          : "";

        renderedRoutes.push({
          route,
          outputPath: route.outputPath || outputPathFromUrl(route.urlPath),
          contents: await renderTemplate(environment, config, route.sourcePath, {
            site: config.site,
            posts: pagePosts,
            collections: content.collections,
            page: {
              title: config.site.name,
              canonicalUrl: new URL(route.urlPath.replace(/^\//, ""), ensureUrlTrailingSlash(config.site.url)).toString(),
            },
            postsHtml,
            paginationHtml: buildPaginationMarkup(
              route.urlPath === "/" ? "/" : route.urlPath.replace(/page\/\d+\/$/, ""),
              pageNumber,
              pageCount
            ),
            legacy: createLegacyContext(config, undefined, {
              posts: postsHtml,
              pagination: buildPaginationMarkup(
                route.urlPath === "/" ? "/" : route.urlPath.replace(/page\/\d+\/$/, ""),
                pageNumber,
                pageCount
              ),
            }),
          }),
        });
        continue;
      }

      if (route.kind === "post" && route.context?.postId) {
        const post = content.posts.find((entry) => entry.id === route.context?.postId);
        if (!post) {
          continue;
        }
        renderedRoutes.push({
          route,
          outputPath: route.outputPath || outputPathFromUrl(route.urlPath),
          contents: await renderTemplate(environment, config, post.layout, {
            site: config.site,
            post,
            page: {
              title: post.title,
              canonicalUrl: new URL(route.urlPath.replace(/^\//, ""), ensureUrlTrailingSlash(config.site.url)).toString(),
            },
            legacy: createLegacyContext(config, post),
          }),
        });
        continue;
      }

      if (route.kind === "taxonomy") {
        renderedRoutes.push({
          route,
          outputPath: route.outputPath || outputPathFromUrl(route.urlPath),
          contents: taxonomyMarkup(
            content,
            String(route.context?.slug || ""),
            route.context?.taxonomy === "category" ? "category" : "tag"
          ),
        });
        continue;
      }

      if (route.kind === "archive") {
        renderedRoutes.push({
          route,
          outputPath: route.outputPath || outputPathFromUrl(route.urlPath),
          contents: archiveMarkup(content),
        });
        continue;
      }

      renderedRoutes.push({
        route,
        outputPath: route.outputPath || "404.html",
        contents: notFoundMarkup(),
      });
    }

    const supplementalFiles = [
      {
        outputPath: "route-manifest.json",
        contents: JSON.stringify(routes.map(routeToManifestEntry), null, 2),
      },
    ];

    if (config.features.sitemap) {
      supplementalFiles.push({ outputPath: "sitemap.xml", contents: sitemapMarkup(config, renderedRoutes) });
    }
    if (config.features.rss) {
      supplementalFiles.push({ outputPath: "rss.xml", contents: rssMarkup(config, content) });
    }
    if (config.features.robotsTxt) {
      supplementalFiles.push({
        outputPath: "robots.txt",
        contents: `User-agent: *\nAllow: /\nSitemap: ${new URL("sitemap.xml", ensureUrlTrailingSlash(config.site.url)).toString()}\n`,
      });
    }
    if (config.features.searchIndex) {
      supplementalFiles.push({
        outputPath: "search-index.json",
        contents: JSON.stringify(
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
        ),
      });
    }

    return {
      routes: renderedRoutes,
      supplementalFiles,
    };
  },
};
