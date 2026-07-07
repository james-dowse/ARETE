import sharp from 'sharp'
import { readFileSync } from 'fs'
const svg = readFileSync('public/logo.svg')
const bg = { r: 10, g: 9, b: 8, alpha: 1 } // --bg-primary Sparte #0A0908
for (const size of [192, 512]) {
  const inner = Math.round(size * 0.62)
  const padA = Math.floor((size - inner) / 2)
  const padB = size - inner - padA // garantit une taille finale EXACTE de size×size
  await sharp(svg).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: padA, bottom: padB, left: padA, right: padB, background: bg })
    .flatten({ background: bg }).png().toFile(`public/icon-${size}.png`)
}
// apple-touch-icon 180 plein fond
await sharp('public/icon-192.png').resize(180, 180).toFile('public/apple-touch-icon.png')
console.log('icons ok')
