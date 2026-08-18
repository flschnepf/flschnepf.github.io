import { deflateSync } from 'node:zlib';

/**
 * Minimaler PNG-Encoder. Node bringt zlib mit, damit braucht es fuer die
 * App-Icons kein zusaetzliches Paket — und die Icons lassen sich jederzeit
 * reproduzierbar neu erzeugen.
 */

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

/** RGBA-Puffer (width * height * 4 Bytes) als PNG kodieren. */
export function encodePng(width, height, rgba) {
  if (rgba.length !== width * height * 4) {
    throw new Error(`Puffergröße passt nicht: ${rgba.length} statt ${width * height * 4}`);
  }

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // Filter "none" — die Flaechen sind ohnehin flach.
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1,
    );
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // Bittiefe
  header[9] = 6; // Farbtyp RGBA
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function parseColor(hex) {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
    255,
  ];
}

/** Einfache Zeichenflaeche mit Alpha-Blending. */
export class Bitmap {
  constructor(width, height, background = [0, 0, 0, 0]) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height * 4);
    if (background[3] > 0) this.fillRect(0, 0, width, height, background);
  }

  blend(x, y, color) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const index = (y * this.width + x) * 4;
    const alpha = color[3] / 255;
    if (alpha >= 1) {
      this.data[index] = color[0];
      this.data[index + 1] = color[1];
      this.data[index + 2] = color[2];
      this.data[index + 3] = 255;
      return;
    }
    const inverse = 1 - alpha;
    for (let channel = 0; channel < 3; channel += 1) {
      this.data[index + channel] = Math.round(
        color[channel] * alpha + this.data[index + channel] * inverse,
      );
    }
    this.data[index + 3] = Math.round(color[3] + this.data[index + 3] * inverse);
  }

  fillRect(x, y, width, height, color) {
    for (let py = Math.max(0, y); py < Math.min(this.height, y + height); py += 1) {
      for (let px = Math.max(0, x); px < Math.min(this.width, x + width); px += 1) {
        this.blend(px, py, color);
      }
    }
  }

  /** Abgerundetes Rechteck; die Ecken entstehen ueber den Kreisradius. */
  fillRoundRect(x, y, width, height, radius, color) {
    const r = Math.min(radius, width / 2, height / 2);
    for (let py = Math.max(0, Math.floor(y)); py < Math.min(this.height, y + height); py += 1) {
      for (let px = Math.max(0, Math.floor(x)); px < Math.min(this.width, x + width); px += 1) {
        const dx = Math.max(x + r - px - 0.5, 0, px + 0.5 - (x + width - r));
        const dy = Math.max(y + r - py - 0.5, 0, py + 0.5 - (y + height - r));
        if (dx * dx + dy * dy <= r * r) this.blend(px, py, color);
      }
    }
  }

  /** Kantenglaettung durch Herunterrechnen: 4x zeichnen, dann mitteln. */
  downsample(factor) {
    const width = this.width / factor;
    const height = this.height / factor;
    const result = new Bitmap(width, height);
    const samples = factor * factor;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const totals = [0, 0, 0, 0];
        for (let sy = 0; sy < factor; sy += 1) {
          for (let sx = 0; sx < factor; sx += 1) {
            const index = ((y * factor + sy) * this.width + x * factor + sx) * 4;
            for (let channel = 0; channel < 4; channel += 1) {
              totals[channel] += this.data[index + channel];
            }
          }
        }
        const target = (y * width + x) * 4;
        for (let channel = 0; channel < 4; channel += 1) {
          result.data[target + channel] = Math.round(totals[channel] / samples);
        }
      }
    }
    return result;
  }

  /** Bilinear skaliert an Position (x, y) einblenden. */
  drawScaled(source, x, y, width, height) {
    for (let py = 0; py < height; py += 1) {
      const sy = Math.min(source.height - 1, (py / height) * source.height);
      for (let px = 0; px < width; px += 1) {
        const sx = Math.min(source.width - 1, (px / width) * source.width);
        const index = (Math.floor(sy) * source.width + Math.floor(sx)) * 4;
        this.blend(x + px, y + py, [
          source.data[index],
          source.data[index + 1],
          source.data[index + 2],
          source.data[index + 3],
        ]);
      }
    }
  }
}
