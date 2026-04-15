import React from "react";

export const route = {
  render: "static",
  title: "Blog post",
} as const;

export async function generateStaticParams({
  content,
}: {
  content: {
    posts: Array<{ slug: string }>;
  };
}) {
  return content.posts.map((post) => ({ slug: post.slug }));
}

export async function loader({
  params,
  content,
}: {
  params: Record<string, string>;
  content: {
    posts: Array<{ slug: string; title: string; content: string }>;
  };
}) {
  const post = content.posts.find((entry) => entry.slug === params.slug);
  return {
    post,
  };
}

export default function BlogPostPage(props: {
  post?: { title: string; content: string };
}) {
  if (!props.post) {
    return <h1>Post not found</h1>;
  }

  return (
    <article>
      <h1>{props.post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: props.post.content }} />
    </article>
  );
}
