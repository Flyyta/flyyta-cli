import path from "path";
import createJiti from "jiti";
import { z } from "zod";
import type { NormalizedConfig } from "./types";
import { fileExists } from "./utils";

const schema = z.object({
  adapter: z.enum(["legacy-nunjucks", "react"]),
  rootDir: z.string(),
  compatibility: z.object({
    legacyProject: z.boolean(),
    placeholderSyntax: z.boolean(),
  }),
  site: z.object({
    name: z.string(),
    heading: z.string(),
    description: z.string(),
    url: z.string(),
    language: z.string(),
    author: z.object({
      name: z.string(),
      description: z.string(),
      website: z.string(),
    }),
  }),
  paths: z.object({
    rootDir: z.string(),
    contentDir: z.string(),
    sourceDir: z.string(),
    outDir: z.string(),
    publicDir: z.string(),
    appDir: z.string(),
    singlePostTemplatePath: z.string(),
    listTemplatePath: z.string(),
  }),
  collections: z.object({
    posts: z.object({
      enabled: z.boolean(),
      permalink: z.string(),
      perPage: z.number().int().min(1),
      listPage: z.object({
        fileName: z.string(),
        fileDir: z.string(),
      }),
      tagBasePath: z.string(),
      categoryBasePath: z.string(),
      archiveBasePath: z.string(),
    }),
  }),
  markdown: z.object({
    allowHtml: z.boolean(),
    sanitize: z.boolean(),
    codeHighlighting: z.boolean(),
  }),
  dev: z.object({
    port: z.number().int().min(1),
    clientPort: z.number().int().min(1),
  }),
  features: z.object({
    rss: z.boolean(),
    sitemap: z.boolean(),
    robotsTxt: z.boolean(),
    tagPages: z.boolean(),
    categoryPages: z.boolean(),
    archivePage: z.boolean(),
    pagination: z.boolean(),
    assetFingerprinting: z.boolean(),
    searchIndex: z.boolean(),
    auto404: z.boolean(),
  }),
  react: z.object({
    enabled: z.boolean(),
    appDir: z.string(),
    entryClient: z.string().optional(),
    entryServer: z.string().optional(),
    rootLayout: z.string().optional(),
  }),
  templates: z.object({
    autoescape: z.boolean(),
    pageExtensions: z.array(z.string()),
  }),
  hooks: z.record(z.string(), z.any()).default({}),
  plugins: z.array(z.union([z.string(), z.record(z.string(), z.any())])).default([]),
  rawConfig: z.record(z.string(), z.unknown()),
});

function resolveConfigFile(rootDir: string): string {
  for (const candidate of ["config.ts", "config.js", "config.cjs", "config.mjs"]) {
    const absolutePath = path.join(rootDir, candidate);
    if (fileExists(absolutePath)) {
      return absolutePath;
    }
  }
  throw new Error(`Could not find Flyyta config in ${rootDir}`);
}

function normalizeConfig(rootDir: string, rawConfig: Record<string, any>): NormalizedConfig {
  const legacyProject = Boolean(
    rawConfig.siteName ||
      rawConfig.postPath ||
      rawConfig.filePath ||
      rawConfig.postsLayout ||
      rawConfig.blogListLayout
  );

  const adapter = rawConfig.adapter || rawConfig.framework?.adapter || (legacyProject ? "legacy-nunjucks" : "react");
  const siteConfig = rawConfig.site || {};
  const authorConfig = siteConfig.author || {};
  const postPath = rawConfig.postPath || {};
  const filePath = rawConfig.filePath || {};
  const mapPostsTo = rawConfig.mapPostsTo || {};
  const postsLayout = rawConfig.postsLayout || {};
  const blogListLayout = rawConfig.blogListLayout || {};

  const normalized: NormalizedConfig = {
    adapter,
    rootDir,
    compatibility: {
      legacyProject,
      placeholderSyntax: rawConfig.compatibility?.placeholderSyntax !== false,
    },
    site: {
      name: siteConfig.name || rawConfig.siteName || "Flyyta Site",
      heading: siteConfig.heading || rawConfig.siteHeading || "",
      description: siteConfig.description || rawConfig.siteDescription || rawConfig.siteHeading || "",
      url: siteConfig.url || rawConfig.siteUrl || "http://localhost:3000",
      language: siteConfig.language || rawConfig.siteLanguage || "en",
      author: {
        name: authorConfig.name || rawConfig.siteAuthorName || "Flyyta",
        description: authorConfig.description || rawConfig.siteAuthorDescription || "",
        website: authorConfig.website || rawConfig.siteAuthorWebsite || "",
      },
    },
    paths: {
      rootDir,
      contentDir: path.resolve(rootDir, rawConfig.paths?.contentDir || postPath.postsdir || "./content"),
      sourceDir: path.resolve(rootDir, rawConfig.paths?.sourceDir || filePath.postsdir || "./src"),
      outDir: path.resolve(rootDir, rawConfig.paths?.outDir || postPath.outdir || "./dist"),
      publicDir: path.resolve(rootDir, rawConfig.paths?.publicDir || "./public"),
      appDir: path.resolve(rootDir, rawConfig.react?.appDir || rawConfig.paths?.appDir || "./app"),
      singlePostTemplatePath: path.resolve(
        rootDir,
        rawConfig.paths?.singlePostTemplatePath ||
          (postsLayout.postsdir && postsLayout.file
            ? path.join(postsLayout.postsdir, postsLayout.file)
            : "./layout/post.njk")
      ),
      listTemplatePath: path.resolve(
        rootDir,
        rawConfig.paths?.listTemplatePath ||
          (blogListLayout.postsdir && blogListLayout.file
            ? path.join(blogListLayout.postsdir, blogListLayout.file)
            : "./layout/post-list-item.njk")
      ),
    },
    collections: {
      posts: {
        enabled: rawConfig.collections?.posts?.enabled !== false,
        permalink:
          rawConfig.collections?.posts?.permalink ||
          rawConfig.postPermalink ||
          (legacyProject ? "/:slug/" : "/blog/:slug/"),
        perPage: rawConfig.collections?.posts?.perPage || rawConfig.postsPerPage || 5,
        listPage: {
          fileName: rawConfig.collections?.posts?.listPage?.fileName || mapPostsTo.fileName || "index.njk",
          fileDir: rawConfig.collections?.posts?.listPage?.fileDir || mapPostsTo.filedir || "./src",
        },
        tagBasePath: rawConfig.collections?.posts?.tagBasePath || "/tags/",
        categoryBasePath: rawConfig.collections?.posts?.categoryBasePath || "/categories/",
        archiveBasePath: rawConfig.collections?.posts?.archiveBasePath || "/archive/",
      },
    },
    markdown: {
      allowHtml: rawConfig.markdown?.allowHtml ?? true,
      sanitize: rawConfig.markdown?.sanitize ?? true,
      codeHighlighting: rawConfig.markdown?.codeHighlighting !== false,
    },
    dev: {
      port: rawConfig.dev?.port || rawConfig.port || 3000,
      clientPort: rawConfig.dev?.clientPort || rawConfig.clientPort || 3100,
    },
    features: {
      rss: rawConfig.features?.rss !== false,
      sitemap: rawConfig.features?.sitemap !== false,
      robotsTxt: rawConfig.features?.robotsTxt !== false,
      tagPages: rawConfig.features?.tagPages !== false,
      categoryPages: rawConfig.features?.categoryPages !== false,
      archivePage: rawConfig.features?.archivePage !== false,
      pagination: rawConfig.features?.pagination !== false,
      assetFingerprinting: rawConfig.features?.assetFingerprinting === true,
      searchIndex: rawConfig.features?.searchIndex !== false,
      auto404: rawConfig.features?.auto404 !== false,
    },
    react: {
      enabled: adapter === "react",
      appDir: path.resolve(rootDir, rawConfig.react?.appDir || rawConfig.paths?.appDir || "./app"),
      entryClient: rawConfig.react?.entryClient,
      entryServer: rawConfig.react?.entryServer,
      rootLayout: rawConfig.react?.rootLayout,
    },
    templates: {
      autoescape: rawConfig.templates?.autoescape !== false,
      pageExtensions: rawConfig.templates?.pageExtensions || [".njk", ".html", ".md"],
    },
    hooks: rawConfig.hooks || {},
    plugins: rawConfig.plugins || [],
    rawConfig,
  };

  return schema.parse(normalized);
}

export async function loadConfig(rootDir = process.cwd()): Promise<NormalizedConfig> {
  const configFile = resolveConfigFile(rootDir);
  const jiti = createJiti(__filename);
  const loaded = (await jiti.import(configFile)) as { default?: Record<string, any> } | Record<string, any>;
  const rawConfig = "default" in loaded && loaded.default ? loaded.default : loaded;
  return normalizeConfig(rootDir, rawConfig as Record<string, any>);
}
