import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { Bitmap, encodePng, parseColor } from './png.mjs';

/**
 * Der PNG-Encoder ist handgeschrieben. Ein Fehler in CRC oder Kopfdaten faellt
 * sonst erst auf, wenn iOS das Icon stumm verwirft.
 */

function readChunks(png) {
  const chunks = [];
  let offset = 8; // Signatur
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString('latin1');
    const data = png.subarray(offset + 8, offset + 8 + length);
    chunks.push({ type, data });
    offset += 12 + length;
  }
  return chunks;
}

describe('PNG-Encoder', () => {
  it('schreibt Signatur und Kopfdaten', () => {
    const bitmap = new Bitmap(4, 3, parseColor('#4c9f70'));
    const png = encodePng(4, 3, bitmap.data);

    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);

    const chunks = readChunks(png);
    expect(chunks.map((chunk) => chunk.type)).toEqual(['IHDR', 'IDAT', 'IEND']);

    const header = chunks[0].data;
    expect(header.readUInt32BE(0)).toBe(4);
    expect(header.readUInt32BE(4)).toBe(3);
    expect(header[8]).toBe(8); // Bittiefe
    expect(header[9]).toBe(6); // RGBA
  });

  it('gibt die Pixel unverändert wieder heraus', () => {
    const bitmap = new Bitmap(2, 2, parseColor('#4c9f70'));
    const png = encodePng(2, 2, bitmap.data);
    const [, idat] = readChunks(png);
    const raw = inflateSync(idat.data);

    // Je Zeile ein Filterbyte, dann vier Bytes je Pixel.
    expect(raw.length).toBe((2 * 4 + 1) * 2);
    expect(raw[0]).toBe(0);
    expect([...raw.subarray(1, 5)]).toEqual([0x4c, 0x9f, 0x70, 255]);
    expect(raw[9]).toBe(0);
  });

  it('meldet unpassende Puffergrößen', () => {
    expect(() => encodePng(4, 4, new Uint8Array(10))).toThrow(/Puffergröße/);
  });
});

describe('Zeichenfläche', () => {
  it('lässt Ecken abgerundeter Rechtecke frei', () => {
    const bitmap = new Bitmap(20, 20);
    bitmap.fillRoundRect(0, 0, 20, 20, 8, parseColor('#14181b'));
    const alphaAt = (x, y) => bitmap.data[(y * 20 + x) * 4 + 3];

    expect(alphaAt(10, 10)).toBe(255); // Mitte
    expect(alphaAt(0, 0)).toBe(0); // Ecke
    expect(alphaAt(19, 19)).toBe(0);
    expect(alphaAt(10, 0)).toBe(255); // Kantenmitte
  });

  it('mittelt beim Herunterrechnen und glättet damit die Kanten', () => {
    const bitmap = new Bitmap(4, 4);
    bitmap.fillRect(0, 0, 2, 4, [255, 255, 255, 255]);
    const small = bitmap.downsample(2);

    expect(small.width).toBe(2);
    expect(small.data[3]).toBe(255); // links: voll gedeckt
    expect(small.data[7]).toBe(0); // rechts: leer
  });
});
