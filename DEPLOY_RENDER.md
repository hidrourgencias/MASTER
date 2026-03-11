# Desplegar Hidrourgencias en Render

## Requisitos previos

1. **Base de datos PostgreSQL** (Neon gratis): https://neon.tech
   - Crear cuenta
   - Crear proyecto
   - Copiar el **Connection string** (ej: `postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require`)

2. **Cuenta en Render**: https://render.com

3. **Repositorio en GitHub** con el código subido

---

## Pasos

### 1. Conectar repositorio

1. Entra a [dashboard.render.com](https://dashboard.render.com)
2. **New** → **Blueprint**
3. Conecta tu cuenta de GitHub
4. Selecciona el repositorio `aplicacion` (o el que uses)

### 2. Configurar variables de entorno

Antes de crear el servicio, o inmediatamente después:

1. En tu Web Service, entra a **Environment**
2. Agrega estas variables:

| Variable      | Valor |
|---------------|-------|
| `DATABASE_URL` | El connection string de Neon (PostgreSQL) |
| `JWT_SECRET`   | Ya se genera automáticamente con el Blueprint. Si no, inventa una frase larga y aleatoria. |

**Importante**: Sin `DATABASE_URL` correcta, el servidor no arrancará (error "password authentication failed").

### 3. Crear / Desplegar

1. Si usas Blueprint: Render leerá `render.yaml` y creará el servicio
2. Si creas manualmente:
   - **New** → **Web Service**
   - Repo: tu repositorio
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - Agrega `DATABASE_URL` y `JWT_SECRET` en Environment

3. Pulsa **Create Web Service** (o **Deploy** si ya existe)

### 4. Esperar el build

- El build tarda unos 2–5 minutos
- Revisa **Logs** si falla
- Si ves "password authentication failed" → `DATABASE_URL` incorrecta

### 5. URL de la app

Cuando termine: `https://hidrourgencias.onrender.com` (o la URL que Render te asigne)

---

## Obtener DATABASE_URL de Neon

1. Entra a [console.neon.tech](https://console.neon.tech)
2. Selecciona tu proyecto
3. **Dashboard** → **Connection string**
4. Copia la URL completa (incluye usuario, contraseña y `?sslmode=require`)
5. Pégala en Render → Environment → `DATABASE_URL`

---

## Redeploy tras cambios

1. Haz `git push` a tu rama `main`
2. Render despliega automáticamente
3. O en el Dashboard: **Manual Deploy** → **Deploy latest commit**
