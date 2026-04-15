import fs from "fs";
import path from "path";
import type { LoadedContent, NormalizedConfig, RouteDefinition } from "./types";
import { normalizeRouteUrl, slugify, toPosixPath, walkDirectory } from "./utils";

const LEGACY_PAGE_EXTENSIONS = new Set([".njk", ".html", ".md"]);

function routeSegmentsFromFile(rootDir: string, filePath: string): string[] {
  const relativePath = toPosixPath(path.relative(rootDir, filePath));
  const withoutExtension = relativePath.replace(/\.[^/.]+$/, "");
  return withoutExtension.split("/").filter(Boolean);
}

function routeUrlFromSegments(segments: string[]): string {
  const normalizedSegments = segments.filter((segment) => segment !== "index");
  if (normalizedSegments.length === 0) {
    return "/";
  }
  return normalizeRouteUrl(`/${normalizedSegments.join("/")}/`);
}

export async function planLegacyRoutes(
  config: NormalizedConfig,
  content: LoadedContent
): Promise<RouteDefinition[]> {
  const routes: RouteDefinition[] = [];
  const sourceDir = config.paths.sourceDir;

  if (fs.existsSync(sourceDir)) {
    const files = await walkDirectory(sourceDir);
    for (const filePath of files) {
      const extension = path.extname(filePath);
      if (!LEGACY_PAGE_EXTENSIONS.has(extension)) {
        continue;
      }

      const segments = routeSegmentsFromFile(sourceDir, filePath);
      const fileName = path.basename(filePath);
      const outputUrl = routeUrlFromSegments(segments);

      routes.push({
        id: `legacy:${toPosixPath(path.relative(config.rootDir, filePath))}`,
        pattern: outputUrl,
        urlPath: outputUrl,
        outputPath:
          outputUrl === "/"
            ? "index.html"
            : path.posix.join(outputUrl.replace(/^\//, ""), "index.html"),
        filePath,
        renderMode: "static",
        sourceType: extension === ".md" ? "markdown" : "template",
        metadata: {
          templateName: fileName,
        },
      });
    }
  }

  if (config.collections.posts.enabled) {
    for (const post of content.posts) {
      const normalizedUrl = normalizeRouteUrl(post.urlPath);
      routes.push({
        id: `post:${post.slug}`,
        pattern: normalizedUrl,
        urlPath: normalizedUrl,
        outputPath:
          normalizedUrl === "/"
            ? "index.html"
            : path.posix.join(normalizedUrl.replace(/^\//, ""), "index.html"),
        filePath: post.sourcePath,
        renderMode: "static",
        sourceType: "content",
        metadata: {
          slug: post.slug,
          title: post.title,
        },
      });
    }
  }

  return routes.sort((left, right) => left.urlPath.localeCompare(right.urlPath));
}

export function pagePatternFromSegments(segments: string[]): string {
  if (segments.length === 0) {
    return "/";
  }
  const normalizedSegments = segments.map((segment) => {
    if (/^\[\.\.\.[^\]]+\]$/.test(segment)) {
      return `:${segment.slice(4, -1)}*`;
    }
    if (/^\[[^\]]+\]$/.test(segment)) {
      return `:${segment.slice(1, -1)}`;
    }
    return slugify(segment, false) || segment;
  });

  return normalizeRouteUrl(`/${normalizedSegments.join("/")}/`);
}
