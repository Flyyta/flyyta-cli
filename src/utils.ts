import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { DependencyGraph, Logger, RouteDefinition } from "./types";

export function createLogger(options: { verbose?: boolean; silent?: boolean } = {}): Logger {
  const verbose = Boolean(options.verbose);
  const silent = Boolean(options.silent);

  const write = (method: "log" | "warn" | "error", prefix: string, message: string): void => {
    if (silent) {
      return;
    }
    console[method](`${prefix} ${message}`);
  };

  return {
    info(message) {
      write("log", "info", message);
    },
    success(message) {
      write("log", "done", message);
    },
    warn(message) {
      write("warn", "warn", message);
    },
    error(message) {
      write("error", "error", message);
    },
    debug(message) {
      if (verbose && !silent) {
        write("log", "debug", message);
      }
    },
  };
}

export function slugify(input: string): string {
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function ensureLeadingSlash(value: string): string {
  return value.startsWith("/") ? value : `/${value}`;
}

export function ensureTrailingSlash(value: string): string {
  const normalized = ensureLeadingSlash(value);
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

export function ensureUrlTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

export function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}

export function stripLeadingDotSlash(value: string): string {
  return value.replace(/^[.][/\\]/, "");
}

export async function walkDirectory(targetDir: string): Promise<string[]> {
  const entries = await fs.promises.readdir(targetDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkDirectory(absolutePath)));
    } else {
      files.push(absolutePath);
    }
  }

  return files;
}

export function fileExists(targetPath: string): boolean {
  try {
    fs.accessSync(targetPath);
    return true;
  } catch {
    return false;
  }
}

export function hashContent(content: string | Buffer): string {
  return crypto.createHash("sha1").update(content).digest("hex").slice(0, 8);
}

export function outputPathFromUrl(urlPath: string): string {
  const trimmed = ensureTrailingSlash(urlPath).replace(/^\/+/, "");
  return trimmed ? path.posix.join(trimmed, "index.html") : "index.html";
}

export function parseDateValue(value: unknown): Date | null {
  if (value == null || value === "") {
    return null;
  }
  if (typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = new Date(Number(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(value: Date | string | number | null): string {
  const parsed = value instanceof Date ? value : parseDateValue(value);
  if (!parsed) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsed);
}

export function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function createExcerpt(html: string, description = "", maxLength = 180): string {
  if (description) {
    return description;
  }
  const plain = stripHtml(html);
  if (plain.length <= maxLength) {
    return plain;
  }
  return `${plain.slice(0, maxLength).trim()}...`;
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length === 0) {
    return [];
  }
  const chunkSize = Math.max(size, 1);
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

export function createDependencyGraph(): DependencyGraph {
  return {
    edges: new Map(),
    reverseEdges: new Map(),
  };
}

export function addDependency(graph: DependencyGraph, from: string, to: string): void {
  if (!graph.edges.has(from)) {
    graph.edges.set(from, new Set());
  }
  graph.edges.get(from)?.add(to);

  if (!graph.reverseEdges.has(to)) {
    graph.reverseEdges.set(to, new Set());
  }
  graph.reverseEdges.get(to)?.add(from);
}

export function buildPermalink(pattern: string, slug: string, date: Date | null): string {
  return ensureTrailingSlash(
    pattern
      .replace(/:slug\b/g, slug)
      .replace(/:year\b/g, date ? String(date.getFullYear()) : "undated")
      .replace(/:month\b/g, date ? String(date.getMonth() + 1).padStart(2, "0") : "00")
      .replace(/:day\b/g, date ? String(date.getDate()).padStart(2, "0") : "00")
  );
}

export function routeToManifestEntry(route: RouteDefinition): Record<string, unknown> {
  return {
    id: route.id,
    kind: route.kind,
    renderMode: route.renderMode,
    urlPath: route.urlPath,
    outputPath: route.outputPath,
  };
}
