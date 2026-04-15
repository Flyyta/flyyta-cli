import React from "react";

export const route = {
  render: "static",
  title: "Blog post",
} as const;

export async function generateStaticParams() {
  return [{ slug: "hello-world" }, { slug: "another-post" }];
}

export async function loader({
  params,
}: {
  params: Record<string, string>;
}) {
  return {
    slug: params.slug,
  };
}

export default function BlogPost(props: { slug?: string }) {
  return (
    <article>
      <h1>{props.slug}</h1>
    </article>
  );
}
