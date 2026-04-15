type LayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: LayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Flyyta Blog</title>
        <link rel="stylesheet" href="/style.css" />
      </head>
      <body>
        <header className="site-header">
          <div>
            <p className="eyebrow">Flyyta</p>
            <h1>React-first blogging</h1>
          </div>
          <nav>
            <a href="/">Home</a>
            <a href="/blog/hello-flyyta/">First post</a>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
