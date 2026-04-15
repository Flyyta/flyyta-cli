import React from "react";
import type { NormalizedConfig } from "../../../../src/types";

export default function RootLayout(props: {
  children: React.ReactNode;
  config: NormalizedConfig;
}) {
  return (
    <div>
      <header>{props.config.site.name}</header>
      <main>{props.children}</main>
    </div>
  );
}
