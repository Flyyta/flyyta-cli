export const route = {
  render: "static",
  title: "Portfolio",
} as const;

const projects = [
  {
    name: "Composable storefront",
    description: "A modern commerce frontend with SSR and hybrid product discovery.",
  },
  {
    name: "Content platform",
    description: "Editorial publishing flow with markdown collections and route-level layouts.",
  },
  {
    name: "Design system site",
    description: "Component docs, release notes, and search-backed documentation pages.",
  },
];

export default function PortfolioPage() {
  return (
    <section className="portfolio-shell">
      <div className="hero">
        <p className="eyebrow">Portfolio starter</p>
        <h1>Build a polished personal site on top of Flyyta.</h1>
        <p>
          This starter uses React route components, minimal content modeling, and a simple static render mode to
          showcase work or products.
        </p>
      </div>

      <div className="project-grid">
        {projects.map((project) => (
          <article key={project.name} className="project-card">
            <h2>{project.name}</h2>
            <p>{project.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
