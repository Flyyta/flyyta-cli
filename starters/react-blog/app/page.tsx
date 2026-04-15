export const route = {
  render: "static",
  title: "Flyyta Blog",
} as const;

type HomePageProps = {
  posts: Array<{
    title: string;
    urlPath: string;
    description: string;
    formattedDate: string;
  }>;
};

export async function loader({ content }: { content: { posts: HomePageProps["posts"] } }) {
  return {
    posts: content.posts,
  };
}

export default function HomePage({ posts }: HomePageProps) {
  return (
    <section className="stack gap-lg">
      <div className="hero">
        <p className="eyebrow">Starter</p>
        <h2>Ship a content-heavy app with React routes and markdown collections.</h2>
        <p>
          This starter prerenders the home page, reads markdown content from `content/`, and uses dynamic React
          routes for blog posts.
        </p>
      </div>

      <div className="card-grid">
        {posts.map((post) => (
          <article key={post.urlPath} className="card">
            <p className="meta">{post.formattedDate}</p>
            <h3>{post.title}</h3>
            <p>{post.description}</p>
            <a href={post.urlPath}>Read article</a>
          </article>
        ))}
      </div>
    </section>
  );
}
