export default function VisionPrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body { width: 100%; height: 100%; background: #333; }
          .print-btn {
            position: fixed; top: 16px; right: 16px; padding: 9px 20px; background: #C8A55F; color: #000;
            border: none; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer;
            box-shadow: 0 4px 16px rgba(0,0,0,0.3); z-index: 10; font-family: -apple-system, sans-serif;
          }
          .print-page {
            width: 100%; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px;
          }
          @media print {
            .print-btn { display: none !important; }
            html, body { background: #fff; }
            .print-page { padding: 0; min-height: 0; }
            @page { margin: 0; }
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  )
}
