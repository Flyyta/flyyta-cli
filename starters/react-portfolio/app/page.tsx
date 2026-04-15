import React from "react";

export const route = {
  render: "static",
  title: "Home",
} as const;

export default function HomePage() {
  return (
    <section>
      <h2>Portfolio starter</h2>
      <p>Replace this page with your work, profile, and writing.</p>
    </section>
  );
}
