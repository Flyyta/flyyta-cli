import fs from "fs";
import path from "path";
import nunjucks from "nunjucks";
import type {
  AdapterBuildContext,
  BuildOutputRoute,
  FlyytaAdapter,
  PostRecord,
  RouteDefinition,
} from "../types";
import { planLegacyRoutes } from "../routing";

function transformLegacyPlaceholders(templateSource: string): string {
  return templateSource
    .replace(/\{siteName\}/g, "{{ site.name }}")
    .replace(/\{siteHeading\}/g, "{{ site.heading }}")
    .replace(/\{siteDescription\}/g, "{{ site.description }}")
    .replace(/\{siteAuthorName\}/g, "{{ site.author.name }}")
    .replace(/\{siteAuthorWebsite\}/g, "{{ site.author.website }}")
    .replace(/\{siteAuthorDescription\}/g, "{{ site.author.description }}")
    .replace(/\{title\}/g, "{{ page.title }}")
    .replace(/\{description\}/g, "{{ page.description }}")
    .replace(/\{date\}/g, "{{ page.date }}")
    .replace(/\{body\}/g, "{{ page.body | safe }}")
    .replace(/\{posts\}/g, "{{ postsMarkup | safe }}");
}

function createEnvironment(templatesRoot: string): nunjucks.Environment {
  const loader = new nunjucks.FileSystemLoader(templatesRoot, {
    noCache: true,
  });
  return new nunjucks.Environment(loader, {
    autoescape: false,
    throwOnUndefined: false,
  });
}

function createLegacyContext(
  context: AdapterBuildContext,
  route: RouteDefinition,
  post?: PostRecord,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  return {
    site: context.config.site,
    config: context.config,
    page: {
      title: post?.title || route.metadata?.title || context.config.site.name,
      description:
        post?.description ||
        (typeof route.metadata?.description === "string" ? route.metadata.description : context.config.site.description),
      date: post?.formattedDate || "",
      body: post?.content || "",
      slug: post?.slug,
      urlPath: route.urlPath,
    },
    content: context.content,
    posts: context.content.posts,
    ...extra,
  };
}

async function renderTemplate(
  templatePath: string,
  templateSource: string,
  locals: Record<string, unknown>
): Promise<string> {
  const templatesRoot = path.dirname(templatePath);
  const env = createEnvironment(templatesRoot);
  const compiled = transformLegacyPlaceholders(templateSource);
  return new Promise<string>((resolve, reject) => {
    env.renderString(compiled, locals, (error, output) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(output);
    });
  });
}

function createPostsMarkup(posts: PostRecord[]): string {
  return posts
    .map(
      (post) =>
        `<article><h2><a href="${post.urlPath}">${post.title}</a></h2><p>${post.description || post.excerpt}</p></article>`
    )
    .join("\n");
}

function paginatePosts(posts: PostRecord[], perPage: number): PostRecord[][] {
  if (perPage <= 0) {
    return [posts];
  }
  const pages: PostRecord[][] = [];
  for (let index = 0; index < posts.length; index += perPage) {
    pages.push(posts.slice(index, index + perPage));
  }
  return pages;
}

async function buildLegacyPages(
  context: AdapterBuildContext,
  routes: RouteDefinition[]
): Promise<BuildOutputRoute[]> {
  const output: BuildOutputRoute[] = [];
  const routeIds = new Set(routes.map((route) => route.id));

  for (const route of routes) {
    context.graph.connect(route.filePath, route.outputPath);

    if (route.id.startsWith("post:")) {
      const post = context.content.posts.find((entry) => entry.slug === route.metadata?.slug);
      if (!post) {
        continue;
      }
      const templatePath = post.layout || context.config.paths.singlePostTemplatePath;
      const templateSource = await fs.promises.readFile(templatePath, "utf8");
      context.graph.connect(post.sourcePath, templatePath);
      output.push({
        route,
        outputPath: route.outputPath,
        contents: await renderTemplate(
          templatePath,
          templateSource,
          createLegacyContext(context, route, post, {
            postsMarkup: createPostsMarkup(context.content.posts),
          })
        ),
      });
      continue;
    }

    const templateSource = await fs.promises.readFile(route.filePath, "utf8");
    output.push({
      route,
      outputPath: route.outputPath,
      contents: await renderTemplate(
        route.filePath,
        templateSource,
        createLegacyContext(context, route, undefined, {
          postsMarkup: createPostsMarkup(context.content.posts),
        })
      ),
    });
  }

  const listTemplateSource = await fs.promises.readFile(context.config.paths.listTemplatePath, "utf8");
  const listRouteId = "legacy:post-list";
  if (!routeIds.has(listRouteId)) {
    const pages = paginatePosts(context.content.posts, context.config.collections.posts.perPage);
    pages.forEach(async (posts, index) => {
      const urlPath = index === 0 ? "/blog/" : `/blog/page/${index + 1}/`;
      const route: RouteDefinition = {
        id: `${listRouteId}:${index + 1}`,
        pattern: urlPath,
        urlPath,
        outputPath: path.posix.join(urlPath.replace(/^\//, ""), "index.html"),
        filePath: context.config.paths.listTemplatePath,
        renderMode: "static",
        sourceType: "template",
        metadata: {
          pageNumber: index + 1,
        },
      };
      output.push({
        route,
        outputPath: route.outputPath,
        contents: await renderTemplate(
          context.config.paths.listTemplatePath,
          listTemplateSource,
          createLegacyContext(context, route, undefined, {
            postsMarkup: createPostsMarkup(posts),
            posts,
            pagination: {
              currentPage: index + 1,
              totalPages: pages.length,
            },
          })
        ),
      });
    });
  }

  return output.sort((left, right) => left.route.urlPath.localeCompare(right.route.urlPath));
}

export const legacyNunjucksAdapter: FlyytaAdapter = {
  name: "legacy-nunjucks",
  async discoverRoutes(context) {
    return planLegacyRoutes(context.config, context.content);
  },
  async build(context, routes) {
    const renderedRoutes = await buildLegacyPages(context, routes);
    return {
      routes: renderedRoutes,
      supplementalFiles: [],
    };
  },
};
