import fs from "fs";
import path from "path";
import React, { Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { register } from "esbuild-register/dist/node";
import type {
  AdapterBuildContext,
  FlyytaAdapter,
  ReactRouteModule,
  RouteDefinition,
  RouteModuleContext,
} from "../types";
import { pagePatternFromSegments } from "../routing";
import { normalizeRouteUrl, toPosixPath, walkDirectory } from "../utils";

const APP_PAGE_REGEX = /(?:^|\/)page\.(tsx|ts|jsx|js)$/;
const unregister = register({
  extensions: [".ts", ".tsx", ".js", ".jsx"],
  target: "es2022",
  jsx: "automatic",
  format: "cjs",
});

async function loadRouteModule(filePath: string): Promise<ReactRouteModule> {
  unregister;
  const loaded = (await import(filePath)) as ReactRouteModule | { default: ReactRouteModule };
  if ("default" in loaded && typeof loaded.default === "object") {
    return loaded.default as ReactRouteModule;
  }
  return loaded as ReactRouteModule;
}

function routeSegmentsFromAppFile(appDir: string, filePath: string): string[] {
  const relativePath = toPosixPath(path.relative(appDir, filePath));
  return relativePath
    .replace(/\/page\.[^.]+$/, "")
    .split("/")
    .filter(Boolean);
}

function resolveRouteUrl(segments: string[], params: Record<string, string> = {}): string {
  if (segments.length === 0) {
    return "/";
  }

  const concreteSegments = segments.map((segment) => {
    if (/^\[\.\.\.[^\]]+\]$/.test(segment)) {
      const key = segment.slice(4, -1);
      return params[key] || "";
    }
    if (/^\[[^\]]+\]$/.test(segment)) {
      const key = segment.slice(1, -1);
      return params[key] || segment;
    }
    return segment;
  });

  return normalizeRouteUrl(`/${concreteSegments.filter(Boolean).join("/")}/`);
}

function outputPathForUrl(urlPath: string): string {
  return urlPath === "/" ? "index.html" : path.posix.join(urlPath.replace(/^\//, ""), "index.html");
}

function wrapDocument(markup: string): string {
  return `<!DOCTYPE html>${markup}`;
}

export async function renderReactRoute(
  context: AdapterBuildContext,
  route: RouteDefinition,
  params: Record<string, string> = {}
): Promise<string> {
  const module = await loadRouteModule(route.filePath);
  const routeContext: RouteModuleContext = {
    params,
    config: context.config,
    content: context.content,
  };

  const data = module.loader ? await module.loader(routeContext) : undefined;
  const PageComponent = module.default;
  const LayoutComponent = module.Layout;
  const rootLayoutPath = path.join(context.config.paths.appDir, "layout.tsx");
  const RootLayout = fs.existsSync(rootLayoutPath)
    ? ((await loadRouteModule(rootLayoutPath)).default as any)
    : Fragment;

  const pageElement = React.createElement(PageComponent as any, data as any);
  const withLayout = LayoutComponent
    ? React.createElement(LayoutComponent as any, { children: pageElement, data, params } as any)
    : pageElement;
  const tree = React.createElement(RootLayout as any, {
    children: withLayout,
    data,
    params,
    route,
  } as any);

  return wrapDocument(renderToStaticMarkup(tree));
}

async function resolveStaticRouteVariants(
  context: AdapterBuildContext,
  route: RouteDefinition,
  segments: string[],
  module: ReactRouteModule
): Promise<RouteDefinition[]> {
  const hasDynamicSegments = segments.some((segment) => segment.startsWith("[") && segment.endsWith("]"));
  if (!hasDynamicSegments) {
    return [route];
  }

  if (!module.generateStaticParams) {
    if (route.renderMode === "server" || route.renderMode === "hybrid") {
      return [route];
    }
    throw new Error(`Dynamic route ${route.filePath} must export generateStaticParams or opt into server rendering`);
  }

  const paramsList = await module.generateStaticParams({
    config: context.config,
    content: context.content,
  });
  return paramsList.map((params, index) => {
    const urlPath = resolveRouteUrl(segments, params);
    return {
      ...route,
      id: `${route.id}:${index + 1}`,
      urlPath,
      outputPath: outputPathForUrl(urlPath),
      metadata: {
        ...(route.metadata || {}),
        params,
      },
    };
  });
}

export const reactAdapter: FlyytaAdapter = {
  name: "react",
  async discoverRoutes(context) {
    const appDir = context.config.paths.appDir;
    if (!fs.existsSync(appDir)) {
      return [];
    }

    const files = await walkDirectory(appDir);
    const routeFiles = files.filter((filePath) => APP_PAGE_REGEX.test(filePath));
    const discovered: RouteDefinition[] = [];

    for (const filePath of routeFiles) {
      const segments = routeSegmentsFromAppFile(appDir, filePath);
      const module = await loadRouteModule(filePath);
      const pattern = pagePatternFromSegments(segments);
      const urlPath = resolveRouteUrl(segments);
      const route: RouteDefinition = {
        id: `react:${toPosixPath(path.relative(context.config.rootDir, filePath))}`,
        pattern,
        urlPath,
        outputPath: outputPathForUrl(urlPath),
        filePath,
        renderMode: module.route?.render || "static",
        sourceType: "component",
        metadata: {
          title: module.route?.title,
          description: module.route?.description,
        },
      };
      const variants = await resolveStaticRouteVariants(context, route, segments, module);
      discovered.push(...variants);
    }

    return discovered.sort((left, right) => left.urlPath.localeCompare(right.urlPath));
  },
  async build(context, routes) {
    const staticRoutes = routes.filter((route) => route.renderMode === "static");
    const serverRoutes = routes.filter((route) => route.renderMode === "server" || route.renderMode === "hybrid");

    const renderedRoutes = await Promise.all(
      staticRoutes.map(async (route) => {
        context.graph.connect(route.filePath, route.outputPath);
        const params = (route.metadata?.params as Record<string, string> | undefined) || {};
        return {
          route,
          outputPath: route.outputPath,
          contents: await renderReactRoute(context, route, params),
        };
      })
    );

    const supplementalFiles = [] as Array<{ outputPath: string; contents: string }>;
    if (serverRoutes.length > 0) {
      supplementalFiles.push({
        outputPath: "server-manifest.json",
        contents: JSON.stringify(serverRoutes, null, 2),
      });
    }

    return {
      routes: renderedRoutes,
      supplementalFiles,
    };
  },
};
