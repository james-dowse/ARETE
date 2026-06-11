export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fff; color: #111; font-size: 13px; line-height: 1.5; padding: 32px 40px; max-width: 800px; margin: 0 auto; }
          h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 4px; }
          .meta { font-size: 12px; color: #666; margin-bottom: 20px; display: flex; gap: 14px; flex-wrap: wrap; align-items: center; }
          .bio-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 24px; }
          .chip { font-size: 10px; padding: 2px 9px; border-radius: 20px; font-weight: 600; }
          .tag-chip { font-size: 10px; padding: 2px 9px; border-radius: 20px; background: #fdf3d0; color: #a07800; border: 1px solid #e8c84a; }
          .section-label { font-size: 10px; font-weight: 700; letter-spacing: 0.10em; text-transform: uppercase; color: #888; margin-bottom: 10px; margin-top: 20px; }
          .block { border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 12px; overflow: hidden; }
          .block-header { background: #f9fafb; padding: 8px 14px; font-size: 11px; font-weight: 700; color: #555; letter-spacing: 0.06em; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; }
          .movement-row { display: flex; align-items: center; gap: 12px; padding: 9px 14px; border-top: 1px solid #f3f4f6; }
          .movement-row:first-child { border-top: none; }
          .num { font-size: 11px; color: #aaa; width: 18px; text-align: right; flex-shrink: 0; }
          .mov-name { font-weight: 600; font-size: 13px; flex: 1; }
          .bt-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
          .sets { font-size: 12px; color: #444; white-space: nowrap; }
          .rest-label { font-size: 11px; color: #999; white-space: nowrap; }
          .notes-box { margin-top: 8px; padding: 12px 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 12px; color: #444; }
          .notes-box p { margin: 0 0 6px; }
          .notes-box p:last-child { margin: 0; }
          .page-footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #aaa; display: flex; justify-content: space-between; }
          .print-btn { position: fixed; top: 16px; right: 16px; padding: 9px 20px; background: #C9A535; color: #000; border: none; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
          @media print { .print-btn { display: none !important; } body { padding: 20px 24px; } }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  )
}
