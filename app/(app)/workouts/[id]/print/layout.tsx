export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          @page { margin: 16mm 14mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fff; color: #111; font-size: 13px; line-height: 1.5; padding: 32px 40px; max-width: 800px; margin: 0 auto; }

          .brand-bar { display: flex; align-items: baseline; justify-content: space-between; padding-bottom: 10px; margin-bottom: 18px; border-bottom: 2px solid #C9A535; }
          .brand-word { font-size: 12px; font-weight: 800; letter-spacing: 0.3em; color: #C9A535; }
          .brand-sub { font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 0.08em; }

          .cover { display: block; width: 100%; height: 160px; object-fit: cover; border-radius: 10px; margin-bottom: 18px; border: 1px solid #e5e7eb; }

          .title-row { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; flex-wrap: wrap; }
          h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
          .diff-chip { font-weight: 700; }
          .meta { font-size: 12px; color: #666; margin-bottom: 14px; display: flex; gap: 14px; flex-wrap: wrap; align-items: center; }
          .description { font-size: 12.5px; color: #444; white-space: pre-line; margin-bottom: 16px; line-height: 1.6; max-width: 640px; }
          .bio-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 24px; }
          .chip { font-size: 10px; padding: 2px 9px; border-radius: 20px; font-weight: 600; }
          .tag-chip { font-size: 10px; padding: 2px 9px; border-radius: 20px; background: #fdf3d0; color: #a07800; border: 1px solid #e8c84a; }
          .section-label { font-size: 10px; font-weight: 700; letter-spacing: 0.10em; text-transform: uppercase; color: #888; margin-bottom: 10px; margin-top: 20px; }
          .block { border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 12px; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
          .block-header { background: #f9fafb; padding: 8px 14px; font-size: 11px; font-weight: 700; color: #555; letter-spacing: 0.06em; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
          .superset-chip { font-size: 9.5px; font-weight: 800; letter-spacing: 0.04em; color: #a07800; background: #fdf3d0; border: 1px solid #e8c84a; border-radius: 20px; padding: 1px 8px; text-transform: none; white-space: nowrap; }
          .movement-row { display: flex; align-items: center; gap: 10px; padding: 9px 14px; border-top: 1px solid #f3f4f6; break-inside: avoid; page-break-inside: avoid; }
          .movement-row:first-child { border-top: none; }
          .num { font-size: 11px; color: #aaa; width: 18px; text-align: right; flex-shrink: 0; }
          .mov-name { font-weight: 600; font-size: 13px; }
          .bt-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
          .bt-label { font-size: 10.5px; color: #999; flex: 1; min-width: 0; }
          .sets { font-size: 12px; color: #444; white-space: nowrap; }
          .rest-label { font-size: 11px; color: #999; white-space: nowrap; }
          .set-boxes { display: flex; gap: 4px; flex-shrink: 0; }
          .set-box { width: 12px; height: 12px; border: 1.5px solid #bbb; border-radius: 3px; display: inline-block; }
          .block-rest { padding: 6px 14px; font-size: 11px; color: #999; border-top: 1px solid #f3f4f6; background: #fcfcfc; }
          .notes-box { margin-top: 8px; padding: 12px 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 12px; color: #444; }
          .notes-box p { margin: 0 0 6px; }
          .notes-box p:last-child { margin: 0; }
          .page-footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #aaa; display: flex; justify-content: space-between; }
          .print-btn { position: fixed; top: 16px; right: 16px; padding: 9px 20px; background: var(--gold); color: #000; border: none; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
          @media print {
            .print-btn { display: none !important; }
            body { padding: 0; }
            .cover { height: 120px; }
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  )
}
