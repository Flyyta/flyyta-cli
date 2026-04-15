import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import React, { type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import fse from "fs-extra";
import { register } from "esbuild-register/dist/node";
import type {
  AdapterBuildContext,
  AdapterBuildResult,
  FlyytaAdapter,
  ReactRouteModule,
  RenderMode,
  RenderedRoute,
  RouteDefinition,
} from "../types";
import {
  ensureUrlTrailingSlash,
  fileExists,
  outputPathFromUrl,
  routeToManifestEntry,
  toPosixPath,
  walkDirectory,
} from "../utils";
import { pagePatternFromSegments } from "../routing";
import { buildRsbuildArtifacts } from "../runtime";

interface LoadedRouteModule {
  module: ReactRouteModule;
  templatePath: string;
}

async function loadRouteModule(filePath: string): Promise<LoadedRouteModule> {
  const { unregister } = register({
    extensions: [".ts", ".tsx"],
    target: "es2022",
    format: "cjs",
  });

  try {
    const imported = (await import(`${pathToFileURL(filePath).href}?t=${Date.now()}`)) as ReactRouteModule;
    return {
      module: imported,
      templatePath: filePath,
    };
  } finally {
    unregister();
  }
}

function routeSegmentsFromAppFile(appDir: string, filePath: string): string[] {
  const relativePath = toPosixPath(path.relative(appDir, filePath));
  const pageDir = relativePath.replace(/\/page\.(tsx|ts|jsx|js)$/i, "").replace(/page\.(tsx|ts|jsx|js)$/i, "");
  return pageDir ? pageDir.split("/").filter(Boolean) : [];
}

function isPageFile(filePath: string): boolean {
  return /page\.(tsx|ts|jsx|js)$/i.test(filePath);
}

function resolveRouteUrl(segments: string[], params: Record<string, string> = {}): string {
  const resolvedSegments = segments.map((segment) => {
    if (segment.startsWith("[") && segment.endsWith("]")) {
      return params[segment.slice(1, -1)] || segment;
    }
    return segment;
  });

  const joined = resolvedSegments.filter(Boolean).join("/");
  return joined ? `/${joined}/` : "/";
}

function wrapHtml(document: {
  title: string;
  body: string;
  appHtml: string;
  canonicalUrl: string;
  siteName: string;
}): string {
  return [
    "<!DOCTYPE html>",
    "<html lang=\"en\">",
    "  <head>",
    "    <meta charset=\"UTF-8\" />",
    "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />",
    `    <title>${document.title}</title>`,
    `    <link rel=\"canonical\" href=\"${document.canonicalUrl}\" />`,
    "  </head>",
    "  <body>",
    `    <div id=\"root\">${document.appHtml}</div>`,
    document.body,
    `    <script>window.__FLYYTA__ = ${JSON.stringify({ siteName: document.siteName })};</script>`,
    "  </body>",
    "</html>",
  ].join("\n");
}

function RootLayout(props: { children: ReactNode; siteName: string }): ReactElement {
  return React.createElement("div", { className: "flyyta-app" }, [
    React.createElement("header", { key: "header" }, React.createElement("a", { href: "/" }, props.siteName)),
    React.createElement("main", { key: "main" }, props.children),
  ]);
}

export async function renderReactRoute(
  context: AdapterBuildContext,
  route: RouteDefinition
): Promise<RenderedRoute | null> {
  if (!route.sourcePath) {
    return null;
  }

  const loaded = await loadRouteModule(route.sourcePath);
  const module = loaded.module;
  const props = module.loader
    ? await module.loader({
        params: route.params || {},
        config: context.config,
        content: context.content,
      })
    : {};

  const Page = module.default;
  const layoutFile =
    context.config.react.rootLayout ||
    (fileExists(path.join(context.config.paths.appDir, "layout.tsx"))
      ? path.join(context.config.paths.appDir, "layout.tsx")
      : undefined);
  let LayoutComponent: ((props: { children: ReactNode; config: typeof context.config }) => ReactElement) | undefined =
    module.Layout;

  if (!LayoutComponent && layoutFile) {
    const loadedLayout = await loadRouteModule(layoutFile);
    LayoutComponent = loadedLayout.module.default as unknown as typeof LayoutComponent;
  }

  const pageElement = React.createElement(Page, props);
  const appTree = LayoutComponent
    ? React.createElement(LayoutComponent as any, { config: context.config }, pageElement)
    : React.createElement(RootLayout as any, { siteName: context.config.site.name }, pageElement);
  const html =
    route.renderMode === "server"
      ? renderToString(appTree)
      : renderToStaticMarkup(appTree);

  return {
    route,
    outputPath: route.outputPath || outputPathFromUrl(route.urlPath),
    contents: wrapHtml({
      title: route.title || context.config.site.name,
      body: route.renderMode === "hybrid" || route.renderMode === "client"
        ? "<script type=\"module\" src=\"/__flyyta__/client-entry.js\"></script>"
        : "",
      appHtml: html,
      canonicalUrl: new URL(route.urlPath.replace(/^\//, ""), ensureUrlTrailingSlash(context.config.site.url)).toString(),
      siteName: context.config.site.name,
    }),
  };
}

export const reactAdapter: FlyytaAdapter = {
  kind: "react",
  async discoverRoutes(context: AdapterBuildContext): Promise<RouteDefinition[]> {
    const appDir = context.config.paths.appDir;
    if (!fileExists(appDir)) {
      return [];
    }

    const files = (await walkDirectory(appDir)).filter(isPageFile);
    const routes: RouteDefinition[] = [];

    for (const filePath of files) {
      const loaded = await loadRouteModule(filePath);
      const segments = routeSegmentsFromAppFile(appDir, filePath);
      const routeMeta = loaded.module.route || {};
      const renderMode: RenderMode =
        routeMeta.render || (segments.some((segment) => segment.startsWith("[") && segment.endsWith("]")) ? "server" : "static");
      const { pattern, paramNames } = pagePatternFromSegments(segments);

      if (paramNames.length > 0 && (renderMode === "static" || renderMode === "hybrid" || renderMode === "client")) {
        const staticParams = loaded.module.generateStaticParams
          ? await loaded.module.generateStaticParams({
              config: context.config,
              content: context.content,
            })
          : [];
        for (const params of staticParams) {
          const urlPath = resolveRouteUrl(segments, params);
          routes.push({
            id: `app:${toPosixPath(path.relative(appDir, filePath))}:${JSON.stringify(params)}`,
            kind: "app",
            renderMode,
            sourcePath: filePath,
            urlPath,
            outputPath: outputPathFromUrl(urlPath),
            params,
            title: routeMeta.title,
          });
        }
        continue;
      }

      routes.push({
        id: `app:${toPosixPath(path.relative(appDir, filePath))}`,
        kind: "app",
        renderMode,
        sourcePath: filePath,
        urlPath: resolveRouteUrl(segments),
        outputPath: renderMode === "server" ? undefined : outputPathFromUrl(resolveRouteUrl(segments)),
        pattern,
        title: routeMeta.title,
      });
    }

    return routes;
  },
  async build(context: AdapterBuildContext, routes: RouteDefinition[]): Promise<AdapterBuildResult> {
    const renderedRoutes: RenderedRoute[] = [];
    await fse.remove(context.config.paths.outDir);
    await fse.ensureDir(context.config.paths.outDir);

    if (fileExists(context.config.paths.publicDir)) {
      await fse.copy(context.config.paths.publicDir, context.config.paths.outDir);
    }

    for (const route of routes) {
      context.graph.connect(route.id, route.sourcePath || route.urlPath);
      if (route.renderMode === "server") {
        continue;
      }

      const rendered = await renderReactRoute(context, route);
      if (rendered) {
        renderedRoutes.push(rendered);
      }
    }

    const supplementalFiles = [
      {
        outputPath: "route-manifest.json",
        contents: JSON.stringify(routes.map(routeToManifestEntry), null, 2),
      },
      {
        outputPath: "server-manifest.json",
        contents: JSON.stringify(
          routes
            .filter((route) => route.renderMode === "server" || route.renderMode === "hybrid")
            .map((route) => ({
              id: route.id,
              sourcePath: route.sourcePath,
              urlPath: route.urlPath,
              renderMode: route.renderMode,
            })),
          null,
          2
        ),
      },
    ];

    if (routes.some((route) => route.renderMode === "hybrid" || route.renderMode === "client")) {
      await buildRsbuildArtifacts({
        rootDir: context.config.rootDir,
        appDir: context.config.paths.appDir,
        outDir: context.config.paths.outDir,
        clientPort: context.config.dev.clientPort,
        logger: context.logger,
      });
    }

    return {
      routes: renderedRoutes,
      supplementalFiles,
    };
  },
};
