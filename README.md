# Flyyta

Flyyta is now a TypeScript-first SSR, SSG, and hybrid framework with a React-first adapter and a legacy Flyyta compatibility adapter.

The repo no longer treats hardcoded HTML templates as the main product surface. Instead, the core is organized around typed config loading, content loading, route planning, build/runtime adapters, and a dependency graph that can support static rendering, request-time rendering, and future faster invalidation models.

Originally created by Abhishek Mogaveera and Devika Olkar.

## What Flyyta is now

- A framework-agnostic core with typed contracts
- A React-first adapter for modern repos using `app/` route components
- A legacy Nunjucks adapter so older Flyyta projects still build
- A TypeScript implementation repo compiled to `dist/`
- A Node SSR runtime plus a static output pipeline
- An Rsbuild-backed client/runtime layer for React adapter projects

## Current architecture

```mermaid
flowchart LR
  cli[CLI] --> config[ConfigLoader]
  config --> content[ContentLoader]
  config --> adapter[AdapterSelection]
  content --> adapter
  adapter --> graph[BuildGraph]
  adapter --> build[BuildOutput]
  adapter --> runtime[NodeRuntime]
  runtime --> rsbuild[RsbuildClientRuntime]
```

## Runtime

- Node.js `>=18.18`

## Repo Development

Install dependencies:

```bash
npm install
```

Typecheck and run tests:

```bash
npm run check
```

Build the framework itself:

```bash
npm run build
```

Run the local CLI from source:

```bash
npm run cli:build -- --help
```

## CLI commands

### `flyyta create`

Scaffold a new React-first Flyyta starter.

```bash
npx flyyta create my-app --template blog
```

Available templates:

- `blog`
- `portfolio`
- `documentation`

### `flyyta build`

Build a Flyyta project.

```bash
npx flyyta build --root .
```

Behavior:

- React adapter projects pre-render static routes and emit server manifests for SSR routes
- Legacy projects render through the compatibility adapter

### `flyyta dev`

Build, start the Node runtime, watch project files, and rebuild on change.

If a React project contains `client` or `hybrid` routes, Flyyta also starts the Rsbuild client dev runtime.

### `flyyta serve`

Serve the project through the Flyyta Node runtime.

### `flyyta start`

Compatibility alias for `flyyta dev`.

## New React-first project shape

```text
my-app/
  config.ts
  app/
    layout.tsx
    page.tsx
    blog/
      [slug]/
        page.tsx
  content/
    hello-flyyta.md
  public/
    style.css
```

## React adapter model

Route modules live in `app/**/page.tsx`.

Supported exports today:

- `default` route component
- `route`
- `loader`
- `generateStaticParams`
- `Layout`

Example:

```tsx
export const route = {
  render: "static",
  title: "Home",
} as const;

export async function loader({ content }) {
  return {
    posts: content.posts,
  };
}

export default function HomePage(props: { posts: Array<{ title: string }> }) {
  return <div>{props.posts.map((post) => post.title)}</div>;
}
```

### Render modes

Flyyta route metadata now supports:

- `static`
- `server`
- `hybrid`
- `client`

Current behavior:

- `static` routes are emitted as HTML during build
- `server` routes are kept for request-time rendering in the Node runtime
- `hybrid` and `client` routes are prepared for the React client/Rsbuild path

## TypeScript config

New projects can use `config.ts`.

Example:

```ts
export default {
  adapter: "react",
  site: {
    name: "My Flyyta App",
    heading: "Modern SSR and SSG with Flyyta",
    description: "A React-first Flyyta site",
    url: "https://example.com",
    author: {
      name: "Your Name",
      website: "https://example.com",
      description: "Builder on the web",
    },
  },
  paths: {
    appDir: "./app",
    contentDir: "./content",
    outDir: "./dist",
    publicDir: "./public",
  },
  react: {
    appDir: "./app",
  },
};
```

## Legacy compatibility

Old Flyyta projects are still supported through the `legacy-nunjucks` adapter.

Legacy config fields still recognized:

- `siteName`
- `siteHeading`
- `siteAuthorName`
- `siteAuthorWebsite`
- `postPath.postsdir`
- `postPath.outdir`
- `filePath.postsdir`
- `filePath.outdir`
- `mapPostsTo.fileName`
- `postsLayout.postsdir`
- `postsLayout.file`
- `blogListLayout.postsdir`
- `blogListLayout.file`

Legacy placeholder syntax still recognized:

- `{siteName}`
- `{siteHeading}`
- `{siteAuthorName}`
- `{title}`
- `{description}`
- `{date}`
- `{body}`
- `{posts}`

This compatibility path is intentionally isolated behind the legacy adapter so it does not define the new default architecture.

## Content model

Flyyta still supports markdown content collections.

Supported front matter:

- `title`
- `description`
- `date`
- `tags`
- `categories`
- `draft`
- `slug`
- `permalink`
- `layout`

The framework exposes loaded content to route loaders, so React routes can render from markdown collections without hardcoding HTML shells in the core.

## Build graph and invalidation

Flyyta now tracks dependency edges through a build graph. The current dev runtime uses that graph to report impacted nodes during rebuilds and lays the groundwork for:

- finer invalidation
- route-level rebuilds
- content-to-route dependency tracking
- future persistent caching

## Rsbuild runtime

Flyyta uses Rsbuild as the initial fast client/runtime layer for React routes that need client or hybrid behavior.

Current role:

- generate client build artifacts
- provide a React-capable client dev runtime
- act as the first step toward faster HMR-oriented development

The long-term target is Turbopack-class responsiveness, but the implementation starts on a more stable and practical Rsbuild/Rspack base.

## Starters

The bundled starters now default to the React-first app model:

- `starters/react-blog`
- `starters/react-portfolio`
- `starters/react-documentation`

They are intended as the new default authoring shape.

## Migration notes

If you have an older Flyyta repo:

1. Keep the existing config and template structure first.
2. Build it with the compatibility adapter.
3. Migrate to `config.ts` and `app/` routes when you are ready.
4. Move route-by-route from legacy placeholders/templates into React route modules instead of rewriting everything at once.

## Current limitations

This repo now contains the architectural shift, but it is still an early framework foundation rather than a finished Next.js-level platform.

The big pieces now in place are:

- TypeScript foundation
- typed config/content/build contracts
- legacy adapter isolation
- React-first route discovery and SSR/SSG build path
- Node runtime
- Rsbuild client runtime hook-in

The next iterations should deepen:

- richer route loaders and metadata
- stronger hybrid/client hydration semantics
- better selective rebuilds and HMR
- more complete adapter and starter ergonomics
