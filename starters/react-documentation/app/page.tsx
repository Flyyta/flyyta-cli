import React from "react";

export const route = {
  render: "static",
  title: "Home",
} as const;

export default function HomePage() {
  return (
    <section>
      <h2>Documentation starter</h2>
      <p>Use this starter for docs, guides, release notes, and internal knowledge bases.</p>
    </section>
  );
}
