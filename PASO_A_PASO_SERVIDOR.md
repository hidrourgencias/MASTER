# Guía paso a paso: del servidor a la app

## ¿Dónde está el servidor?

El servidor está en la carpeta **`server`** del proyecto. El archivo principal es:

```
C:\Users\Alumno\Desktop\aplicacion\server\src\index.js
```

Ese archivo inicia Express, conecta la base de datos y expone las rutas de la API.

---

## Paso 1: Iniciar el servidor

### Opción más fácil (recomendada)

1. Abre el Explorador de archivos.
2. Ve a la carpeta del proyecto:  
   `C:\Users\Alumno\Desktop\aplicacion`
3. Haz **doble clic** en **`Iniciar Hidrourgencias.bat`**.
4. Se abrirá una ventana negra (CMD). **No la cierres** mientras uses la app.

### Qué hace el .bat

Al ejecutarlo pasa lo siguiente:

1. **Arranca el servidor** (`server/src/index.js`) en el puerto **3001**.
2. **Conecta a la base de datos** (Neon) usando el archivo `server/.env`.
3. Tras unos segundos, **crea un túnel público** con LocalTunnel (URL tipo `https://hidrourgencias.loca.lt`).

### Ejemplo de salida correcta

```
=== Hidrourgencias SpA - Iniciando Sistema ===

Servidor Hidrourgencias corriendo en http://localhost:3001

========================================
  APP DISPONIBLE EN INTERNET:
  https://hidrourgencias.loca.lt
========================================
  Comparta esta URL con los técnicos.
  Funciona con WiFi y datos móviles.
```

**Guarda esa URL** (ej: `https://hidrourgencias.loca.lt`). La necesitarás para el celular y para configurar la app.

---

## Paso 2: Usar la app en el navegador (PC)

### Opción A: Modo desarrollo (para probar cambios)

1. **Ventana 1** – El servidor ya debe estar corriendo (paso 1).
2. **Ventana 2** – Abre una nueva terminal (PowerShell o CMD) y ejecuta:

   ```bash
   cd C:\Users\Alumno\Desktop\aplicacion\client
   npm run dev
   ```

3. Abre el navegador en: **http://localhost:5173**

La app usará automáticamente `http://localhost:3001` como API (no necesitas configurar nada).

---

### Opción B: Modo producción (app compilada servida por el propio servidor)

1. Compila el cliente una vez:

   ```bash
   cd C:\Users\Alumno\Desktop\aplicacion\client
   npm run build
   ```

2. Asegúrate de que el servidor esté corriendo (paso 1).
3. En el navegador abre: **http://localhost:3001**

El servidor sirve la app desde `client/dist` en esa misma URL.

---

## Paso 3: Usar la app en el celular (APK)

1. Instala la APK en el celular (copiando el archivo o con cable USB).
2. Abre la app.
3. En la pantalla de **Login**, toca **"Configurar servidor"**.
4. Ingresa la URL del túnel que apareció en la ventana del servidor, por ejemplo:

   ```
   https://hidrourgencias.loca.lt
   ```

   (sin `/api` al final).

5. Guarda y vuelve a intentar iniciar sesión.

---

## Paso 4: Iniciar sesión

| Usuario        | Contraseña     | Rol     |
|----------------|----------------|---------|
| administracion | administracion | Admin   |
| ventas         | Hidro2026      | Ventas  |
| german         | Hidro2026      | Técnico |

---

## Resumen rápido

| Quiero...                      | Qué hacer                                                                 |
|--------------------------------|---------------------------------------------------------------------------|
| Iniciar servidor               | Doble clic en `Iniciar Hidrourgencias.bat`                                |
| App en PC (desarrollo)         | Servidor + `cd client && npm run dev` → http://localhost:5173            |
| App en PC (producción)         | `cd client && npm run build` + servidor → http://localhost:3001          |
| App en celular (APK)           | Instalar APK → Configurar servidor con URL del túnel → Login             |

---

## Errores comunes

| Error                                | Solución                                                |
|--------------------------------------|---------------------------------------------------------|
| `password authentication failed`     | Revisar `server/.env` y la contraseña de la base de datos. |
| `Cannot find module`                 | Ejecutar `npm install` en `server` y en la raíz.        |
| La app en el celular no conecta      | Verificar URL en "Configurar servidor" (https, sin /api). |
| El túnel no aparece                  | Es posible que LocalTunnel falle; usa `http://IP_DE_TU_PC:3001` si el celular está en la misma red WiFi. |

---

## ¿Qué hace cada carpeta?

- **`server/`** – Backend (Node.js + Express + PostgreSQL)
- **`client/`** – Frontend (React + Vite)
- **`iniciar.js`** – Script que inicia el servidor y el túnel
- **`Iniciar Hidrourgencias.bat`** – Atajo para ejecutar `iniciar.js`
