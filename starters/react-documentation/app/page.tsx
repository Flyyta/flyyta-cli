export const route = {
  render: "static",
  title: "Documentation home",
} as const;

type DocsPageProps = {
  article: {
    title: string;
    content: string;
    description: string;
  };
};

export async function loader({ content }: { content: { posts: Array<any> } }) {
  return {
    article: content.posts[0],
  };
}

export default function DocsPage({ article }: DocsPageProps) {
  return (
    <article className="doc-shell">
      <p className="eyebrow">Documentation</p>
      <h2>{article.title}</h2>
      <p className="lede">{article.description}</p>
      <div dangerouslySetInnerHTML={{ __html: article.content }} />
    </article>
  );
}
