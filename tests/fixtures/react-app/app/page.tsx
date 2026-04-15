import React from "react";

export const route = {
  render: "static",
  title: "Home",
} as const;

export default function HomePage() {
  return (
    <section>
      <h1>React Home</h1>
      <p>Static home page</p>
    </section>
  );
}
