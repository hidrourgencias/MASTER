# Guía: Desplegar Hidrourgencias en Render

Esta guía explica cómo subir las actualizaciones del proyecto a **Render** para que la app esté disponible en `https://hidrourgencias.onrender.com`.

---

## Requisitos previos

1. Cuenta en [Render](https://render.com)
2. Repositorio en **GitHub** con el código del proyecto
3. Base de datos **Neon** (PostgreSQL) con `DATABASE_URL` configurada

---

## Opción A: Primera vez (servicio nuevo)

### 1. Conectar el repositorio

1. Entra a [dashboard.render.com](https://dashboard.render.com)
2. **New** → **Web Service**
3. Conecta tu cuenta de GitHub y selecciona el repositorio `aplicacion` (o el nombre que tenga)
4. Render detectará `render.yaml` automáticamente (Blueprint)

### 2. Si usas Blueprint (render.yaml)

1. **New** → **Blueprint**
2. Selecciona el repo y la rama (ej: `main`)
3. Render creará el servicio según `render.yaml`

### 3. Configurar variables de entorno

En el servicio creado, ve a **Environment** y agrega:

| Variable        | Valor                                      | Obligatorio |
|-----------------|--------------------------------------------|-------------|
| `DATABASE_URL`  | `postgresql://usuario:pass@host/db?sslmode=require` | Sí          |
| `JWT_SECRET`    | *(Auto-generado por Render si usas render.yaml)*   | Sí          |
| `GEMINI_API_KEY`| Tu API Key de Google Gemini (para OCR)     | No          |

La `DATABASE_URL` la obtienes en el panel de Neon → Connection details.

> **Nota**: Si usas `render.yaml`, `JWT_SECRET` se genera automáticamente. Solo debes configurar `DATABASE_URL` en el Dashboard.

### 4. Desplegar

Render desplegará automáticamente. Si no, pulsa **Manual Deploy** → **Deploy latest commit**.

---

## Opción B: Actualizar un servicio existente

Si el servicio **hidrourgencias** ya existe en Render:

### 1. Subir cambios a GitHub

```bash
cd C:\Users\Alumno\Desktop\aplicacion

git add .
git status   # Revisar qué se sube
git commit -m "Actualización: [describe los cambios]"
git push origin main
```

> Cambia `main` por la rama que uses (ej: `master`).

### 2. Despliegue automático

Si el servicio tiene **Auto-Deploy** activado, Render desplegará solo al hacer `git push`.

### 3. Despliegue manual

1. Entra a [dashboard.render.com](https://dashboard.render.com)
2. Abre el servicio **hidrourgencias**
3. **Manual Deploy** → **Deploy latest commit**

---

## Qué hace cada comando en Render

| Comando                    | Descripción                                                |
|---------------------------|------------------------------------------------------------|
| `npm install`             | Instala dependencias del `package.json` raíz               |
| `npm run build`           | Compila el cliente (React) y prepara el servidor           |
| `npm start`               | Inicia el servidor Node.js en el puerto que asigne Render  |

El resultado: la app queda disponible en `https://hidrourgencias.onrender.com`.

---

## Verificar que todo funcione

1. Abre `https://hidrourgencias.onrender.com`
2. Deberías ver la pantalla de login
3. Inicia sesión con `administracion` / `administracion` o `ventas` / `Hidro2026`

---

## Errores frecuentes

| Error                          | Causa probable                           | Solución                                           |
|--------------------------------|------------------------------------------|----------------------------------------------------|
| Build falla                    | Dependencias o versión de Node           | Revisar logs en Render; asegurar Node >= 18        |
| `DATABASE_URL` incorrecta      | Credenciales o URL mal configurada       | Verificar en Neon y en Environment de Render       |
| App en blanco o 404            | Cliente no compilado o rutas incorrectas | Revisar que `npm run build` genere `client/dist`   |
| 503 o timeout                  | Plan gratuito en suspensión              | El plan free se duerme; la primera petición puede tardar ~1 min |

---

## Resumen rápido

1. **Primera vez**: Conectar repo en Render → Blueprint o Web Service → Configurar `DATABASE_URL` y `JWT_SECRET` → Deploy.
2. **Actualizaciones**: `git add .` → `git commit -m "..."` → `git push` → Render despliega solo (si Auto-Deploy está activo).

La APK y la web ya apuntan por defecto a `https://hidrourgencias.onrender.com`, así que no hace falta cambiar nada en la app después del despliegue.
