type LayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: LayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Flyyta Docs</title>
        <link rel="stylesheet" href="/style.css" />
      </head>
      <body>
        <aside className="sidebar">
          <h1>Flyyta Docs</h1>
          <a href="/">Getting started</a>
        </aside>
        <main>{children}</main>
      </body>
    </html>
  );
}
