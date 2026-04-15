import React from "react";

export const route = {
  render: "server",
  title: "SSR",
} as const;

export default function SsrPage() {
  return <section>SSR route</section>;
}
