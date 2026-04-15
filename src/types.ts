export type RenderMode = "static" | "server" | "hybrid" | "client";

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  success(message: string): void;
  debug(message: string): void;
}

export interface NormalizedConfig {
  adapter: "legacy-nunjucks" | "react";
  rootDir: string;
  compatibility: {
    legacyProject: boolean;
    placeholderSyntax: boolean;
  };
  site: {
    name: string;
    heading: string;
    description: string;
    url: string;
    language: string;
    author: {
      name: string;
      description: string;
      website: string;
    };
  };
  paths: {
    rootDir: string;
    contentDir: string;
    sourceDir: string;
    outDir: string;
    publicDir: string;
    appDir: string;
    singlePostTemplatePath: string;
    listTemplatePath: string;
  };
  collections: {
    posts: {
      enabled: boolean;
      permalink: string;
      perPage: number;
      listPage: {
        fileName: string;
        fileDir: string;
      };
      tagBasePath: string;
      categoryBasePath: string;
      archiveBasePath: string;
    };
  };
  markdown: {
    allowHtml: boolean;
    sanitize: boolean;
    codeHighlighting: boolean;
  };
  dev: {
    port: number;
    clientPort: number;
  };
  features: {
    rss: boolean;
    sitemap: boolean;
    robotsTxt: boolean;
    tagPages: boolean;
    categoryPages: boolean;
    archivePage: boolean;
    pagination: boolean;
    assetFingerprinting: boolean;
    searchIndex: boolean;
    auto404: boolean;
  };
  react: {
    enabled: boolean;
    appDir: string;
    entryClient?: string;
    entryServer?: string;
    rootLayout?: string;
  };
  templates: {
    autoescape: boolean;
    pageExtensions: string[];
  };
  hooks: FlyytaHookMap;
  plugins: Array<string | Record<string, unknown>>;
  rawConfig: Record<string, unknown>;
}

export interface PostRecord {
  id: string;
  sourcePath: string;
  relativePath: string;
  slug: string;
  title: string;
  description: string;
  date: Date | null;
  formattedDate: string;
  tags: string[];
  categories: string[];
  draft: boolean;
  layout: string;
  content: string;
  rawContent: string;
  excerpt: string;
  wordCount: number;
  urlPath: string;
  outputPath: string;
  attributes: Record<string, unknown>;
}

export interface TaxonomyRecord {
  name: string;
  slug: string;
  posts: PostRecord[];
}

export interface LoadedContent {
  posts: PostRecord[];
  collections: {
    posts: PostRecord[];
    tags: TaxonomyRecord[];
    categories: TaxonomyRecord[];
    archives: Array<{ year: string; posts: PostRecord[] }>;
  };
}

export interface RouteDefinition {
  id: string;
  pattern: string;
  urlPath: string;
  outputPath: string;
  filePath: string;
  renderMode: RenderMode;
  sourceType: "template" | "markdown" | "component" | "content";
  metadata?: Record<string, unknown>;
}

export interface BuildOutputRoute {
  route: RouteDefinition;
  outputPath: string;
  contents: string;
}

export interface BuildPayload {
  config: NormalizedConfig;
  content: LoadedContent;
  graph: BuildGraphLike;
  routes: BuildOutputRoute[];
  supplementalFiles: Array<{ outputPath: string; contents: string }>;
}

export type BuildResult = BuildPayload;

export interface DependencyGraph {
  edges: Map<string, Set<string>>;
  reverseEdges: Map<string, Set<string>>;
}

export interface BuildGraphLike {
  connect(from: string, to: string): void;
  dependentsOf(node: string): string[];
  dependenciesOf(node: string): string[];
  serialize(): Record<string, string[]>;
}

export interface AdapterBuildContext {
  config: NormalizedConfig;
  content: LoadedContent;
  logger: Logger;
  graph: BuildGraphLike;
}

export interface FlyytaAdapter {
  name: string;
  discoverRoutes(context: AdapterBuildContext): Promise<RouteDefinition[]>;
  build(
    context: AdapterBuildContext,
    routes: RouteDefinition[]
  ): Promise<Pick<BuildPayload, "routes" | "supplementalFiles">>;
}

export type FlyytaHookMap = Partial<{
  onConfig: (config: NormalizedConfig) => NormalizedConfig | Promise<NormalizedConfig>;
  onContentLoaded: (content: LoadedContent) => LoadedContent | Promise<LoadedContent>;
  onRoutesGenerated: (routes: RouteDefinition[]) => RouteDefinition[] | Promise<RouteDefinition[]>;
  onBeforeWrite: (payload: BuildPayload) => BuildPayload | Promise<BuildPayload>;
  onBuildComplete: (payload: BuildResult) => BuildResult | Promise<BuildResult>;
}>;

export interface RouteModuleContext {
  params: Record<string, string>;
  config: NormalizedConfig;
  content: LoadedContent;
}

export interface ReactRouteMetadata {
  render?: RenderMode;
  title?: string;
  description?: string;
  runtime?: "node";
}

export interface ReactRouteModule {
  default: (props?: unknown) => unknown;
  route?: ReactRouteMetadata;
  loader?: (context: RouteModuleContext) => Promise<unknown> | unknown;
  generateStaticParams?: (context: Omit<RouteModuleContext, "params">) => Promise<Array<Record<string, string>>> | Array<Record<string, string>>;
  Layout?: (props: { children: unknown; data?: unknown; params: Record<string, string> }) => unknown;
}
