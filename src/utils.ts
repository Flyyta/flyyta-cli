import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { DependencyGraph, Logger } from "./types";

export function slugify(input: string, lowerCase = true): string {
  const normalized = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return lowerCase ? normalized.toLowerCase() : normalized;
}

export function toPosixPath(input: string): string {
  return input.split(path.sep).join(path.posix.sep);
}

export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export async function walkDirectory(rootDir: string): Promise<string[]> {
  const entries = await fs.promises.readdir(rootDir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(rootDir, entry.name);
      if (entry.isDirectory()) {
        return walkDirectory(absolutePath);
      }
      return [absolutePath];
    })
  );
  return files.flat();
}

export function normalizeRouteUrl(urlPath: string): string {
  const trimmed = urlPath.trim();
  if (!trimmed || trimmed === "/") {
    return "/";
  }

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

export function ensureUrlTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

export function buildPermalink(
  pattern: string,
  slug: string,
  date: Date | null
): string {
  const replacements: Record<string, string> = {
    ":slug": slug,
    ":year": date ? String(date.getFullYear()) : "undated",
    ":month": date ? `${date.getMonth() + 1}`.padStart(2, "0") : "00",
    ":day": date ? `${date.getDate()}`.padStart(2, "0") : "00",
  };
  let output = pattern;
  for (const [token, value] of Object.entries(replacements)) {
    output = output.replace(new RegExp(token, "g"), value);
  }
  return normalizeRouteUrl(output);
}

export function parseDateValue(value: unknown): Date | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(date: Date | null): string {
  if (!date) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

export function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function createExcerpt(html: string, fallback = "", length = 180): string {
  const text = stripHtml(html);
  if (!text) {
    return fallback;
  }
  if (text.length <= length) {
    return text;
  }
  return `${text.slice(0, length).trim()}...`;
}

export function createDependencyGraph(): DependencyGraph {
  return {
    edges: new Map<string, Set<string>>(),
    reverseEdges: new Map<string, Set<string>>(),
  };
}

export function addDependency(graph: DependencyGraph, from: string, to: string): void {
  if (!graph.edges.has(from)) {
    graph.edges.set(from, new Set());
  }
  if (!graph.reverseEdges.has(to)) {
    graph.reverseEdges.set(to, new Set());
  }
  graph.edges.get(from)?.add(to);
  graph.reverseEdges.get(to)?.add(from);
}

export function createLogger(options?: { verbose?: boolean; silent?: boolean }): Logger {
  const verbose = Boolean(options?.verbose);
  const silent = Boolean(options?.silent);

  function log(method: "log" | "warn" | "error", message: string): void {
    if (silent) {
      return;
    }
    console[method](message);
  }

  return {
    info(message: string) {
      log("log", message);
    },
    warn(message: string) {
      log("warn", message);
    },
    error(message: string) {
      log("error", message);
    },
    success(message: string) {
      log("log", message);
    },
    debug(message: string) {
      if (verbose && !silent) {
        console.log(message);
      }
    },
  };
}

export function hashContent(input: string): string {
  return crypto.createHash("sha1").update(input).digest("hex");
}
