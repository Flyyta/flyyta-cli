import fs from "fs";
import path from "path";
import matter from "gray-matter";
import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import type { LoadedContent, NormalizedConfig, PostRecord, TaxonomyRecord } from "./types";
import {
  buildPermalink,
  createExcerpt,
  formatDate,
  parseDateValue,
  slugify,
  stripHtml,
  toPosixPath,
  walkDirectory,
} from "./utils";

// markdown-it-anchor ships ESM-first typings, so load it lazily in CJS-compatible TS output.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const markdownItAnchor = require("markdown-it-anchor");

const frontMatterSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    date: z.union([z.string(), z.number(), z.date()]).optional(),
    tags: z.union([z.string(), z.array(z.string())]).optional(),
    categories: z.union([z.string(), z.array(z.string())]).optional(),
    draft: z.boolean().optional(),
    slug: z.string().optional(),
    permalink: z.string().optional(),
    layout: z.string().optional(),
  })
  .passthrough();

function createMarkdownRenderer(config: NormalizedConfig): MarkdownIt {
  let renderer: MarkdownIt;
  renderer = new MarkdownIt({
    html: config.markdown.allowHtml,
    linkify: true,
    typographer: true,
    highlight(code: string, language?: string): string {
      if (config.markdown.codeHighlighting && language && hljs.getLanguage(language)) {
        return `<pre class="hljs"><code>${hljs.highlight(code, {
          language,
          ignoreIllegals: true,
        }).value}</code></pre>`;
      }
      return `<pre class="hljs"><code>${renderer.utils.escapeHtml(code)}</code></pre>`;
    },
  });

  renderer.use(markdownItAnchor, {
    permalink: markdownItAnchor.permalink.headerLink(),
  });

  return renderer;
}

function normalizeStringArray(value: unknown): string[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function createTaxonomy(posts: PostRecord[], key: "tags" | "categories"): TaxonomyRecord[] {
  const map = new Map<string, TaxonomyRecord>();
  for (const post of posts) {
    for (const label of post[key]) {
      const slug = slugify(label);
      if (!map.has(slug)) {
        map.set(slug, { name: label, slug, posts: [] });
      }
      map.get(slug)?.posts.push(post);
    }
  }
  return Array.from(map.values()).sort((left, right) => left.name.localeCompare(right.name));
}

export async function loadContent(config: NormalizedConfig): Promise<LoadedContent> {
  const contentDir = config.paths.contentDir;
  const renderer = createMarkdownRenderer(config);
  const files = fs.existsSync(contentDir)
    ? (await walkDirectory(contentDir)).filter((filePath) => filePath.endsWith(".md"))
    : [];

  const posts: PostRecord[] = [];

  for (const filePath of files) {
    const source = await fs.promises.readFile(filePath, "utf8");
    const parsed = matter(source);
    const frontMatter = frontMatterSchema.safeParse(parsed.data);

    if (!frontMatter.success) {
      const details = frontMatter.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(", ");
      throw new Error(`Invalid front matter in ${filePath}: ${details}`);
    }

    const relativePath = toPosixPath(path.relative(contentDir, filePath));
    const baseName = relativePath.replace(/\.md$/i, "");
    const date = parseDateValue(frontMatter.data.date);
    const inferredTitle = frontMatter.data.title || path.basename(baseName);
    const slug =
      frontMatter.data.slug ||
      (config.compatibility.legacyProject ? slugify(path.basename(baseName)) : slugify(inferredTitle));
    const rawHtml = renderer.render(parsed.content);
    const html = config.markdown.sanitize
      ? sanitizeHtml(rawHtml, {
          allowedTags: sanitizeHtml.defaults.allowedTags.concat([
            "img",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            "pre",
            "code",
            "figure",
            "figcaption",
          ]),
          allowedAttributes: {
            a: ["href", "name", "target", "rel"],
            img: ["src", "alt", "title"],
            code: ["class"],
            pre: ["class"],
            "*": ["id", "class"],
          },
        })
      : rawHtml;

    posts.push({
      id: baseName,
      sourcePath: filePath,
      relativePath,
      slug,
      title: inferredTitle,
      description: frontMatter.data.description || "",
      date,
      formattedDate: formatDate(date),
      tags: normalizeStringArray(frontMatter.data.tags),
      categories: normalizeStringArray(frontMatter.data.categories),
      draft: Boolean(frontMatter.data.draft),
      layout: frontMatter.data.layout || config.paths.singlePostTemplatePath,
      content: html,
      rawContent: parsed.content,
      excerpt: createExcerpt(html, frontMatter.data.description),
      wordCount: stripHtml(html).split(/\s+/).filter(Boolean).length,
      urlPath: buildPermalink(frontMatter.data.permalink || config.collections.posts.permalink, slug, date),
      outputPath: "",
      attributes: frontMatter.data,
    });
  }

  const publishedPosts = posts
    .filter((post) => !post.draft)
    .sort((left, right) => (right.date?.getTime() || 0) - (left.date?.getTime() || 0))
    .map((post) => ({
      ...post,
      outputPath: post.urlPath,
    }));

  const archives = new Map<string, PostRecord[]>();
  for (const post of publishedPosts) {
    const year = post.date ? String(post.date.getFullYear()) : "undated";
    if (!archives.has(year)) {
      archives.set(year, []);
    }
    archives.get(year)?.push(post);
  }

  return {
    posts: publishedPosts,
    collections: {
      posts: publishedPosts,
      tags: createTaxonomy(publishedPosts, "tags"),
      categories: createTaxonomy(publishedPosts, "categories"),
      archives: Array.from(archives.entries()).map(([year, yearPosts]) => ({
        year,
        posts: yearPosts,
      })),
    },
  };
}
