export default function VisionPresentLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body { width: 100%; height: 100%; background: #000; overflow: hidden; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  )
}
