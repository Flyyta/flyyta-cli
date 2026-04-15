import type { ReactElement, ReactNode } from "react";

export type RenderMode = "static" | "server" | "hybrid" | "client";
export type AdapterKind = "legacy-nunjucks" | "react";

export interface Logger {
  info(message: string): void;
  success(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  debug(message: string): void;
}

export interface FlyytaHookMap {
  onConfig?: FlyytaHook<NormalizedConfig>;
  onContentLoaded?: FlyytaHook<LoadedContent>;
  onRoutesGenerated?: FlyytaHook<RouteDefinition[]>;
  onBeforeWrite?: FlyytaHook<BuildPayload>;
  onBuildComplete?: FlyytaHook<BuildResult>;
}

export type FlyytaHook<TPayload> =
  | ((payload: TPayload) => Promise<TPayload | void> | TPayload | void)
  | Array<(payload: TPayload) => Promise<TPayload | void> | TPayload | void>;

export interface FlyytaPlugin extends FlyytaHookMap {}

export interface AuthorDetails {
  name: string;
  description: string;
  website: string;
}

export interface SiteDetails {
  name: string;
  heading: string;
  description: string;
  url: string;
  language: string;
  author: AuthorDetails;
}

export interface PathConfig {
  rootDir: string;
  contentDir: string;
  sourceDir: string;
  outDir: string;
  publicDir: string;
  appDir: string;
  singlePostTemplatePath: string;
  listTemplatePath: string;
}

export interface ReactFrameworkConfig {
  enabled: boolean;
  appDir: string;
  entryClient?: string;
  entryServer?: string;
  rootLayout?: string;
}

export interface PostCollectionConfig {
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
}

export interface NormalizedConfig {
  adapter: AdapterKind;
  rootDir: string;
  compatibility: {
    legacyProject: boolean;
    placeholderSyntax: boolean;
  };
  site: SiteDetails;
  paths: PathConfig;
  collections: {
    posts: PostCollectionConfig;
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
  react: ReactFrameworkConfig;
  templates: {
    autoescape: boolean;
    pageExtensions: string[];
  };
  hooks: FlyytaHookMap;
  plugins: Array<FlyytaPlugin | string>;
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
  kind: "page" | "post" | "taxonomy" | "archive" | "not-found" | "app";
  renderMode: RenderMode;
  urlPath: string;
  outputPath?: string;
  sourcePath?: string;
  pattern?: RegExp;
  params?: Record<string, string>;
  meta?: Record<string, unknown>;
  title?: string;
  context?: Record<string, unknown>;
}

export interface RenderedRoute {
  route: RouteDefinition;
  contents: string;
  outputPath: string;
}

export interface SupplementalFile {
  outputPath: string;
  contents: string;
}

export interface BuildPayload {
  config: NormalizedConfig;
  routes: RenderedRoute[];
  supplementalFiles: SupplementalFile[];
  content: LoadedContent;
  graph: BuildGraphLike;
}

export interface BuildResult extends BuildPayload {}

export interface DependencyGraph {
  edges: Map<string, Set<string>>;
  reverseEdges: Map<string, Set<string>>;
}

export interface BuildGraphLike {
  state: DependencyGraph;
  connect(from: string, to: string): void;
  dependentsOf(node: string): string[];
  dependenciesOf(node: string): string[];
  serialize(): Record<string, string[]>;
}

export interface RouteModuleContext {
  params: Record<string, string>;
  config: NormalizedConfig;
  content: LoadedContent;
}

export interface ReactRouteModule {
  default: (props: Record<string, unknown>) => ReactElement;
  loader?: (context: RouteModuleContext) => Promise<Record<string, unknown>> | Record<string, unknown>;
  generateStaticParams?: (
    context: Omit<RouteModuleContext, "params">
  ) => Promise<Array<Record<string, string>>> | Array<Record<string, string>>;
  route?: {
    render?: RenderMode;
    title?: string;
    path?: string;
  };
  Layout?: (props: { children: ReactNode; config: NormalizedConfig }) => ReactElement;
}

export interface AdapterBuildContext {
  config: NormalizedConfig;
  content: LoadedContent;
  logger: Logger;
  graph: BuildGraphLike;
}

export interface AdapterBuildResult {
  routes: RenderedRoute[];
  supplementalFiles: SupplementalFile[];
}

export interface FlyytaAdapter {
  kind: AdapterKind;
  discoverRoutes(context: AdapterBuildContext): Promise<RouteDefinition[]>;
  build(context: AdapterBuildContext, routes: RouteDefinition[]): Promise<AdapterBuildResult>;
}
