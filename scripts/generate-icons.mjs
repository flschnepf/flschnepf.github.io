import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Bitmap, encodePng, parseColor } from './png.mjs';

/**
 * Erzeugt App-Icons und iOS-Startbilder aus einer Beschreibung im Code.
 * Aufruf: `npm run icons`. Die Startbild-Verweise in index.html werden dabei
 * zwischen den Markern mitgeschrieben, damit Dateien und Markup nicht
 * auseinanderlaufen.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'icons');

const INK = parseColor('#14181b');
const PAPER = parseColor('#e9edef');
const ACCENT = parseColor('#4c9f70');

const SCHEMES = {
  light: parseColor('#f4f6f7'),
  dark: parseColor('#0f1113'),
};

/** Motiv im 512er-Raster — dieselbe Zeichnung wie in public/icon.svg. */
function drawMotif(bitmap, offsetX, offsetY, size) {
  const unit = size / 512;
  const at = (x, y, w, h, r, color) =>
    bitmap.fillRoundRect(
      offsetX + x * unit,
      offsetY + y * unit,
      w * unit,
      h * unit,
      r * unit,
      color,
    );

  at(118, 86, 276, 340, 28, PAPER);
  at(158, 132, 196, 64, 12, INK);
  at(158, 228, 56, 48, 10, INK);
  at(228, 228, 56, 48, 10, INK);
  at(298, 228, 56, 48, 10, INK);
  at(158, 292, 56, 48, 10, INK);
  at(228, 292, 56, 48, 10, INK);
  at(158, 356, 126, 34, 10, INK);
  at(298, 292, 56, 98, 10, ACCENT);
}

/**
 * @param {number} size Kantenlaenge in Pixeln
 * @param {boolean} fullBleed Hintergrund bis zum Rand (maskable, Apple-Touch)
 */
function renderIcon(size, fullBleed) {
  const scale = 4; // 4x zeichnen und mitteln = weiche Kanten ohne Zeichenbibliothek
  const canvas = new Bitmap(size * scale, size * scale);

  if (fullBleed) {
    canvas.fillRect(0, 0, size * scale, size * scale, INK);
    // Sicherheitsabstand fuer maskierte Icons: Motiv auf 72 Prozent.
    const inner = size * scale * 0.72;
    const offset = (size * scale - inner) / 2;
    drawMotif(canvas, offset, offset, inner);
  } else {
    canvas.fillRoundRect(0, 0, size * scale, size * scale, size * scale * 0.22, INK);
    drawMotif(canvas, 0, 0, size * scale);
  }

  return canvas.downsample(scale);
}

/** Portrait-Aufloesungen gaengiger iPhones. */
const DEVICES = [
  { width: 1290, height: 2796, ratio: 3, label: 'iPhone 15/16 Pro Max' },
  { width: 1284, height: 2778, ratio: 3, label: 'iPhone 12–14 Pro Max' },
  { width: 1179, height: 2556, ratio: 3, label: 'iPhone 15/16, 14 Pro' },
  { width: 1170, height: 2532, ratio: 3, label: 'iPhone 12–14' },
  { width: 1125, height: 2436, ratio: 3, label: 'iPhone X/XS/11 Pro' },
  { width: 828, height: 1792, ratio: 2, label: 'iPhone XR/11' },
  { width: 750, height: 1334, ratio: 2, label: 'iPhone SE/8' },
];

function write(name, bitmap) {
  const png = encodePng(bitmap.width, bitmap.height, bitmap.data);
  writeFileSync(join(OUT, name), png);
  return png.length;
}

function main() {
  mkdirSync(OUT, { recursive: true });
  const written = [];

  const master = renderIcon(512, false);
  written.push(['icon-512.png', write('icon-512.png', master)]);
  written.push(['icon-192.png', write('icon-192.png', renderIcon(192, false))]);
  written.push(['icon-maskable-512.png', write('icon-maskable-512.png', renderIcon(512, true))]);
  written.push(['apple-touch-icon.png', write('apple-touch-icon.png', renderIcon(180, true))]);

  const links = [];
  for (const device of DEVICES) {
    for (const [scheme, background] of Object.entries(SCHEMES)) {
      const canvas = new Bitmap(device.width, device.height, background);
      const logo = Math.round(Math.min(device.width, device.height) * 0.3);
      canvas.drawScaled(
        master,
        Math.round((device.width - logo) / 2),
        Math.round((device.height - logo) / 2),
        logo,
        logo,
      );
      const name = `splash-${device.width}x${device.height}-${scheme}.png`;
      written.push([name, write(name, canvas)]);

      const cssWidth = device.width / device.ratio;
      const cssHeight = device.height / device.ratio;
      const media = [
        `(device-width: ${cssWidth}px)`,
        `(device-height: ${cssHeight}px)`,
        `(-webkit-device-pixel-ratio: ${device.ratio})`,
        '(orientation: portrait)',
        // Beide Varianten bekommen die Bedingung, damit immer genau eine passt.
        `(prefers-color-scheme: ${scheme})`,
      ].join(' and ');
      links.push(
        `    <link rel="apple-touch-startup-image" media="${media}" href="./icons/${name}" />`,
      );
    }
  }

  const indexPath = join(ROOT, 'index.html');
  const html = readFileSync(indexPath, 'utf8');
  const start = '<!-- splash:start -->';
  const end = '<!-- splash:end -->';
  if (html.includes(start) && html.includes(end)) {
    const before = html.slice(0, html.indexOf(start) + start.length);
    const after = html.slice(html.indexOf(end));
    writeFileSync(indexPath, `${before}\n${links.join('\n')}\n    ${after}`);
  } else {
    console.warn('Marker splash:start/splash:end fehlen in index.html — Verweise nicht geschrieben.');
  }

  const total = written.reduce((sum, [, size]) => sum + size, 0);
  for (const [name, size] of written) {
    console.log(`${name.padEnd(34)} ${(size / 1024).toFixed(1)} kB`);
  }
  console.log(`\n${written.length} Dateien, zusammen ${(total / 1024).toFixed(0)} kB`);
}

main();
