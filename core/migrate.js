// ════════════════════════════════════
// NEXUS AGENT — core/migrate.js
// Migraciones automáticas via Supabase Management API
// ════════════════════════════════════

import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const PROJECT_REF = process.env.SUPABASE_URL?.replace('https://', '').replace('.supabase.co', '');

const MIGRATIONS = [
  {
    id: '001_product_content',
    sql: `
      ALTER TABLE experiments
      ADD COLUMN IF NOT EXISTS contenido_producto TEXT,
      ADD COLUMN IF NOT EXISTS landing_html TEXT;
    `
  },
  {
    id: '002_producto_url',
    sql: `
      ALTER TABLE experiments
      ADD COLUMN IF NOT EXISTS producto_url TEXT;
    `
  },
  {
    id: '003_campaigns_table',
    sql: `
      CREATE TABLE IF NOT EXISTS campaigns (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        experiment_id UUID REFERENCES experiments(id),
        plataforma TEXT DEFAULT 'meta',
        campaign_id_externo TEXT,
        adset_id TEXT,
        nombre TEXT,
        estado TEXT DEFAULT 'activo',
        presupuesto_diario INTEGER DEFAULT 500,
        gasto_total DECIMAL(10,2) DEFAULT 0,
        impresiones INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        conversiones INTEGER DEFAULT 0,
        revenue_generado DECIMAL(10,2) DEFAULT 0,
        ctr DECIMAL(5,2) DEFAULT 0,
        cpa DECIMAL(10,2) DEFAULT 0,
        roas DECIMAL(5,2) DEFAULT 0,
        decision TEXT,
        razon_decision TEXT,
        fecha_inicio TIMESTAMP DEFAULT NOW(),
        fecha_decision TIMESTAMP,
        fecha_ultimo_update TIMESTAMP DEFAULT NOW()
      );
    `
  },
  {
    id: '004_campaigns_landing_views',
    sql: `
      ALTER TABLE campaigns
      ADD COLUMN IF NOT EXISTS landing_page_views INTEGER DEFAULT 0;
    `
  },
  {
    id: '005_digital_leads',
    sql: `
      CREATE TABLE IF NOT EXISTS digital_leads (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        email TEXT NOT NULL,
        experiment_id UUID REFERENCES experiments(id),
        fuente TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(email, fuente)
      );
    `
  }
  // Agrega aquí futuras migraciones
];

export async function runMigrations() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    console.warn('[Migrate] SUPABASE_ACCESS_TOKEN no configurada — saltando migraciones automáticas');
    return;
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

  // Crear tabla de control de migraciones
  try {
    await axios.post(url, {
      query: `CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, aplicada_en TIMESTAMP DEFAULT NOW())`
    }, { headers });
  } catch (err) {
    console.error('[Migrate] No se pudo conectar con Supabase Management API:', err.response?.data?.message || err.message);
    return;
  }

  for (const migration of MIGRATIONS) {
    try {
      const check = await axios.post(url, {
        query: `SELECT id FROM _migrations WHERE id = '${migration.id}'`
      }, { headers });

      if (check.data?.length > 0) continue; // ya aplicada

      await axios.post(url, { query: migration.sql }, { headers });
      await axios.post(url, {
        query: `INSERT INTO _migrations (id) VALUES ('${migration.id}') ON CONFLICT DO NOTHING`
      }, { headers });

      console.log(`[Migrate] ✅ Migración aplicada: ${migration.id}`);
    } catch (err) {
      console.error(`[Migrate] Error en ${migration.id}:`, err.response?.data?.message || err.message);
    }
  }

  console.log('[Migrate] Base de datos al día');
}
