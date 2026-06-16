/**
 * editorMascaraParedes.js — preview de máscara de paredes para el editor.
 * Lógica alineada con scripts/spur_utils.py (brillo < umbral, excluye marcadores rojos).
 */

export const BRILLO_PARED_DEFAULT = 140;

const COLOR_PARED_DEFAULT = { r: 192, g: 38, b: 211, a: 210 };

/** Réplica de es_rojo() en spur_utils.py */
export function esMarcadorRojo(r, g, b) {
  return r > 160 && (r - g) > 80 && (r - b) > 80;
}

/** True si el píxel cuenta como pared según el umbral de brillo. */
export function esPixelPared(r, g, b, umbral = BRILLO_PARED_DEFAULT) {
  const brillo = Math.floor((r + g + b) / 3);
  return brillo < umbral && !esMarcadorRojo(r, g, b);
}

/**
 * Aplica tinte de pared sobre ImageData; devuelve nuevo ImageData.
 * @param {ImageData} imageData
 * @param {{ umbral?: number, color?: { r: number, g: number, b: number, a: number } }} opts
 */
export function aplicarMascaraParedes(imageData, opts = {}) {
  const umbral = opts.umbral ?? BRILLO_PARED_DEFAULT;
  const color = opts.color ?? COLOR_PARED_DEFAULT;
  const { width, height, data } = imageData;
  const outData = new Uint8ClampedArray(data.length);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (esPixelPared(r, g, b, umbral)) {
      outData[i] = color.r;
      outData[i + 1] = color.g;
      outData[i + 2] = color.b;
      outData[i + 3] = color.a;
    }
  }

  return { width, height, data: outData };
}

/** Engrosa píxeles visibles para que líneas finas de pared se distingan en pantalla. */
function engrosarMascara({ width, height, data }, radio = 2) {
  const out = new Uint8ClampedArray(data);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] === 0) continue;
      for (let dy = -radio; dy <= radio; dy++) {
        for (let dx = -radio; dx <= radio; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = (ny * width + nx) * 4;
          out[ni] = data[i];
          out[ni + 1] = data[i + 1];
          out[ni + 2] = data[i + 2];
          out[ni + 3] = data[i + 3];
        }
      }
    }
  }
  return { width, height, data: out };
}

/**
 * Genera data URL de overlay de paredes desde un HTMLImageElement cargado.
 * @param {HTMLImageElement} img
 * @param {{ umbral?: number }} opts
 * @returns {string|null}
 */
export function overlayMascaraDesdeImagen(img, opts = {}) {
  if (!img?.complete || !img.naturalWidth) return null;

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  try {
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const masked = engrosarMascara(aplicarMascaraParedes(imageData, opts));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(new ImageData(masked.data, masked.width, masked.height), 0, 0);
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('[editorMascaraParedes] No se pudo leer el plano (¿CORS?):', err);
    return null;
  }
}
