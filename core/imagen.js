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

// ── Sube imagen (base64) a Supabase Storage para obtener URL pública permanente ──
// Usa el bucket de Supabase que ya está configurado — sin cuentas ni APIs adicionales
export async function subirImagenPublica(b64) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Crear bucket si no existe
    await supabase.storage.createBucket('product-images', { public: true }).catch(() => {});

    // Convertir base64 a buffer
    const buffer = Buffer.from(b64, 'base64');
    const filename = `producto_${Date.now()}.png`;

    const { error } = await supabase.storage
      .from('product-images')
      .upload(filename, buffer, { contentType: 'image/png', upsert: true });

    if (error) throw new Error(error.message);

    const { data } = supabase.storage.from('product-images').getPublicUrl(filename);
    const url = data.publicUrl;

    console.log(`[Imagen] Imagen subida a Supabase Storage: ${url}`);
    return url;

  } catch (err) {
    console.warn(`[Imagen] Error subiendo a Supabase Storage: ${err.message}`);
    return null;
  }
}
