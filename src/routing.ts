import path from "path";
import type { LoadedContent, NormalizedConfig, RouteDefinition } from "./types";
import { chunkArray, ensureTrailingSlash, outputPathFromUrl, toPosixPath, walkDirectory } from "./utils";

export async function planLegacyRoutes(config: NormalizedConfig, content: LoadedContent): Promise<RouteDefinition[]> {
  const files = await walkDirectory(config.paths.sourceDir);
  const templateFiles = files.filter((filePath) =>
    config.templates.pageExtensions.includes(path.extname(filePath).toLowerCase())
  );
  const listPageAbsolute = path.resolve(
    config.rootDir,
    config.collections.posts.listPage.fileDir,
    config.collections.posts.listPage.fileName
  );
  const routes: RouteDefinition[] = [];
  const paginatedPosts = config.features.pagination
    ? chunkArray(content.posts, config.collections.posts.perPage)
    : [content.posts];

  for (const templatePath of templateFiles) {
    const relativePath = toPosixPath(path.relative(config.paths.sourceDir, templatePath));
    if (relativePath.split("/").some((segment) => segment.startsWith("_") || segment === "partials")) {
      continue;
    }

    const normalized = relativePath.replace(/\.(njk|html|md)$/i, "");
    const urlPath = normalized === "index" ? "/" : ensureTrailingSlash(`/${normalized}`);
    routes.push({
      id: `page:${relativePath}`,
      kind: "page",
      renderMode: "static",
      urlPath,
      outputPath: outputPathFromUrl(urlPath),
      sourcePath: templatePath,
    });

    if (path.resolve(templatePath) === listPageAbsolute && paginatedPosts.length > 1) {
      for (let pageNumber = 2; pageNumber <= paginatedPosts.length; pageNumber += 1) {
        const pageUrl = urlPath === "/" ? `/page/${pageNumber}/` : `${urlPath}page/${pageNumber}/`;
        routes.push({
          id: `page:${relativePath}:page:${pageNumber}`,
          kind: "page",
          renderMode: "static",
          urlPath: ensureTrailingSlash(pageUrl),
          outputPath: outputPathFromUrl(pageUrl),
          sourcePath: templatePath,
          context: { pageNumber },
        });
      }
    }
  }

  for (const post of content.posts) {
    routes.push({
      id: `post:${post.slug}`,
      kind: "post",
      renderMode: "static",
      urlPath: post.urlPath,
      outputPath: outputPathFromUrl(post.urlPath),
      sourcePath: post.layout,
      context: { postId: post.id },
    });
  }

  if (config.features.tagPages) {
    for (const tag of content.collections.tags) {
      const urlPath = `${ensureTrailingSlash(config.collections.posts.tagBasePath)}${tag.slug}/`;
      routes.push({
        id: `tag:${tag.slug}`,
        kind: "taxonomy",
        renderMode: "static",
        urlPath,
        outputPath: outputPathFromUrl(urlPath),
        context: { taxonomy: "tag", slug: tag.slug },
      });
    }
  }

  if (config.features.categoryPages) {
    for (const category of content.collections.categories) {
      const urlPath = `${ensureTrailingSlash(config.collections.posts.categoryBasePath)}${category.slug}/`;
      routes.push({
        id: `category:${category.slug}`,
        kind: "taxonomy",
        renderMode: "static",
        urlPath,
        outputPath: outputPathFromUrl(urlPath),
        context: { taxonomy: "category", slug: category.slug },
      });
    }
  }

  if (config.features.archivePage) {
    const urlPath = ensureTrailingSlash(config.collections.posts.archiveBasePath);
    routes.push({
      id: "archive:index",
      kind: "archive",
      renderMode: "static",
      urlPath,
      outputPath: outputPathFromUrl(urlPath),
    });
  }

  if (config.features.auto404) {
    routes.push({
      id: "system:404",
      kind: "not-found",
      renderMode: "static",
      urlPath: "/404/",
      outputPath: "404.html",
    });
  }

  return routes;
}

export function pagePatternFromSegments(segments: string[]): { pattern: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];
  const regexSegments = segments.map((segment) => {
    if (segment.startsWith("[") && segment.endsWith("]")) {
      const name = segment.slice(1, -1);
      paramNames.push(name);
      return "([^/]+)";
    }
    return segment;
  });

  return {
    pattern: new RegExp(`^/${regexSegments.filter(Boolean).join("/")}/?$`),
    paramNames,
  };
}
