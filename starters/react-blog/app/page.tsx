import React from "react";

export const route = {
  render: "static",
  title: "Home",
} as const;

export async function loader({
  content,
}: {
  content: {
    posts: Array<{ title: string; urlPath: string; description: string }>;
  };
}) {
  return {
    posts: content.posts.slice(0, 10),
  };
}

export default function HomePage(props: {
  posts: Array<{ title: string; urlPath: string; description: string }>;
}) {
  return (
    <section>
      <h1>Latest posts</h1>
      <ul>
        {props.posts.map((post) => (
          <li key={post.urlPath}>
            <a href={post.urlPath}>{post.title}</a>
            <p>{post.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
