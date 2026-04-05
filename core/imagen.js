// ════════════════════════════════════
// NEXUS AGENT — core/imagen.js
// Genera imagen de producto con DALL-E 3
// Compartida entre Hotmart, Gumroad y Meta Ads
// ════════════════════════════════════

import axios from 'axios';

const OPENAI_KEY = process.env.OPENAI_API_KEY;

// ── Genera imagen de portada para un producto digital ──
// Devuelve { url, b64 } — url dura ~1h (suficiente para publicar en Hotmart/Gumroad)
export async function generarImagenProducto({ nombre, nicho, subtitulo, precio }) {
  if (!OPENAI_KEY) {
    console.warn('[Imagen] OPENAI_API_KEY no configurado — sin imagen de producto');
    return null;
  }

  const prompt = `Professional digital product cover image for a Latino market ebook/guide.
Product: "${nombre}"
Niche: ${nicho}
Style: Clean, modern, dark background (#0f0f0f), bright accent colors (green #00ff88 or gold).
Layout: Bold title text overlay in Spanish, professional icons or abstract shapes related to the topic.
NO people faces. NO stock photo look. High quality digital product thumbnail.
Square format 1:1. Text: "${nombre.substring(0, 40)}" prominently displayed.`;

  try {
    const res = await axios.post(
      'https://api.openai.com/v1/images/generations',
      {
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json'
      },
      {
        headers: { Authorization: `Bearer ${OPENAI_KEY}` },
        timeout: 90000
      }
    );

    const b64 = res.data.data[0].b64_json;
    const dataUrl = `data:image/png;base64,${b64}`;

    console.log(`[Imagen] Imagen de producto generada para: ${nombre}`);
    return { b64, dataUrl };

  } catch (err) {
    console.warn(`[Imagen] Error generando imagen: ${err.message}`);
    return null;
  }
}

// ── Sube imagen (base64) a ImgBB para obtener URL pública permanente ──
// ImgBB tiene plan gratuito con 32MB por imagen y URLs permanentes
export async function subirImagenPublica(b64) {
  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) {
    console.warn('[Imagen] IMGBB_API_KEY no configurado — no se puede subir imagen pública');
    return null;
  }

  try {
    const form = new URLSearchParams();
    form.append('key', apiKey);
    form.append('image', b64);

    const res = await axios.post('https://api.imgbb.com/1/upload', form, {
      timeout: 30000
    });

    const url = res.data?.data?.url;
    console.log(`[Imagen] Imagen subida a ImgBB: ${url}`);
    return url;

  } catch (err) {
    console.warn(`[Imagen] Error subiendo a ImgBB: ${err.message}`);
    return null;
  }
}
