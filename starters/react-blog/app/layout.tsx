import React from "react";

export default function RootLayout(props: {
  children: React.ReactNode;
  config: {
    site: {
      name: string;
      heading: string;
    };
  };
}) {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <header>
        <a href="/">{props.config.site.name}</a>
        <p>{props.config.site.heading}</p>
      </header>
      <main>{props.children}</main>
    </div>
  );
}
