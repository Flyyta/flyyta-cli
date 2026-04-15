export const route = {
  render: "static",
} as const;

type BlogPostPageProps = {
  post: {
    title: string;
    content: string;
    formattedDate: string;
    description: string;
  };
};

export async function generateStaticParams({ content }: { content: { posts: Array<{ slug: string }> } }) {
  return content.posts.map((post) => ({ slug: post.slug }));
}

export async function loader({ params, content }: { params: { slug: string }; content: { posts: Array<any> } }) {
  const post = content.posts.find((entry) => entry.slug === params.slug);
  if (!post) {
    throw new Error(`Could not find post for slug ${params.slug}`);
  }
  return { post };
}

export default function BlogPostPage({ post }: BlogPostPageProps) {
  return (
    <article className="stack gap-md prose">
      <p className="meta">{post.formattedDate}</p>
      <h2>{post.title}</h2>
      <p className="lede">{post.description}</p>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />
    </article>
  );
}
