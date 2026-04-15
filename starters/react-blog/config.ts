export default {
  adapter: "react",
  site: {
    name: "Flyyta Blog",
    heading: "A React-first Flyyta blog starter",
    description: "Hybrid SSR and SSG blog starter built with Flyyta",
    url: "https://example.com",
    author: {
      name: "Flyyta",
      description: "Shipping content with Flyyta",
      website: "https://example.com",
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
  collections: {
    posts: {
      permalink: "/blog/:slug/",
    },
  },
};
