// ════════════════════════════════════
// NEXUS AGENT — core/deploy.js
// Publica landing pages en Vercel automáticamente
// ════════════════════════════════════

import axios from 'axios';
import { db } from './database.js';
import dotenv from 'dotenv';
dotenv.config();

const VERCEL_API = 'https://api.vercel.com';
const TOKEN = process.env.VERCEL_TOKEN;
const TEAM_ID = process.env.VERCEL_TEAM_ID;

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  'Content-Type': 'application/json'
};

function params() {
  // Solo usar teamId si empieza con "team_" (cuentas de equipo)
  // Las cuentas personales no usan teamId
  return TEAM_ID && TEAM_ID.startsWith('team_') ? `?teamId=${TEAM_ID}` : '';
}

export const deploy = {

  // ── Publica una landing page HTML en Vercel ──
  async publicarLanding({ nombre, html, nicho }) {
    // Limpia el nombre para usarlo como subdominio
    const slug = nombre
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 40);

    const projectName = `nexus-${slug}`;

    try {
      // Paso 1: Crear el proyecto primero y deshabilitar protección
      try {
        await axios.post(`${VERCEL_API}/v9/projects${params()}`, {
          name: projectName,
          framework: null,
          publicSource: true
        }, { headers });
      } catch {} // Si ya existe, continúa

      // Paso 2: Deshabilitar Deployment Protection (para que sea público)
      try {
        await axios.patch(`${VERCEL_API}/v9/projects/${projectName}${params()}`, {
          ssoProtection: null,
          passwordProtection: null
        }, { headers });
      } catch {}

      // Paso 3: Crear el deployment en producción
      const response = await axios.post(
        `${VERCEL_API}/v13/deployments${params()}`,
        {
          name: projectName,
          files: [
            {
              file: 'index.html',
              data: html,
              encoding: 'utf-8'
            }
          ],
          projectSettings: { framework: null },
          target: 'production'
        },
        { headers }
      );

      const deployment = response.data;
      // Usar alias de producción si existe, si no usar el URL del deployment
      const url = deployment.alias?.[0]
        ? `https://${deployment.alias[0]}`
        : `https://${deployment.url}`;

      await db.log('deploy', 'landing_publicada', {
        nombre,
        nicho,
        url,
        deployment_id: deployment.id
      });

      console.log(`[Deploy] Landing publicada: ${url}`);
      return url;

    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message;
      await db.log('deploy', 'error_deploy', { nombre, error: msg }, false);
      throw new Error(`Error publicando en Vercel: ${msg}`);
    }
  },

  // ── Publica landing + producto en un solo proyecto Vercel ──
  async publicarCompleto({ nombre, htmlLanding, htmlProducto, nicho }) {
    const slug = nombre
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 40);

    const projectName = `nexus-${slug}`;

    try {
      // Crear proyecto
      try {
        await axios.post(`${VERCEL_API}/v9/projects${params()}`, {
          name: projectName,
          framework: null,
          publicSource: true
        }, { headers });
      } catch {}

      // Deshabilitar protección
      try {
        await axios.patch(`${VERCEL_API}/v9/projects/${projectName}${params()}`, {
          ssoProtection: null,
          passwordProtection: null
        }, { headers });
      } catch {}

      // Un solo deployment con ambos archivos
      const response = await axios.post(
        `${VERCEL_API}/v13/deployments${params()}`,
        {
          name: projectName,
          files: [
            { file: 'index.html', data: htmlLanding, encoding: 'utf-8' },
            { file: 'producto/index.html', data: htmlProducto, encoding: 'utf-8' }
          ],
          projectSettings: { framework: null },
          target: 'production'
        },
        { headers }
      );

      const deployment = response.data;
      const baseUrl = deployment.alias?.[0]
        ? `https://${deployment.alias[0]}`
        : `https://${deployment.url}`;

      const landingUrl = baseUrl;
      const productoUrl = `${baseUrl}/producto/`;

      await db.log('deploy', 'completo_publicado', {
        nombre, nicho,
        landing_url: landingUrl,
        producto_url: productoUrl,
        deployment_id: deployment.id
      });

      console.log(`[Deploy] Landing: ${landingUrl}`);
      console.log(`[Deploy] Producto: ${productoUrl}`);
      return { landingUrl, productoUrl };

    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message;
      await db.log('deploy', 'error_deploy', { nombre, error: msg }, false);
      throw new Error(`Error publicando en Vercel: ${msg}`);
    }
  },

  // ── Lista deployments activos ──
  async listarDeployments() {
    const response = await axios.get(
      `${VERCEL_API}/v6/deployments${params()}&limit=10`,
      { headers }
    );
    return response.data.deployments || [];
  },

  // ── Verifica que las credenciales funcionen ──
  async ping() {
    const response = await axios.get(`${VERCEL_API}/v2/user`, { headers });
    return response.data.user?.username || response.data.user?.name;
  }
};
