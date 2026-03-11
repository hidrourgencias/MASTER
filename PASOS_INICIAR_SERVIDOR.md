# Pasos para iniciar el servidor (opción más fácil)

---

## Opción 1: Servidor local (la más fácil)

**Solo necesitas:** PC encendido, Node.js instalado, conexión a internet (para la base de datos).

### Pasos

1. **Verifica que el servidor tenga la base de datos configurada**
   - En `server/.env` debe existir `DATABASE_URL` con la URL de Neon.

2. **Inicia el servidor**
   - Ve a la carpeta: `C:\Users\Alumno\Desktop\aplicacion`
   - Haz **doble clic** en **`Iniciar Hidrourgencias.bat`**
   - No cierres la ventana negra que se abre.

3. **Usa la app**
   - En el navegador: **http://localhost:3001**
   - O abre otra terminal, ejecuta `cd client` y luego `npm run dev`, y entra a **http://localhost:5173**

**Ventaja:** Muy rápido. **Desventaja:** Solo funciona mientras tu PC está encendido y el .bat está abierto.

---

## Opción 2: Servidor en Render (siempre disponible)

**Necesitas:** Cuenta en GitHub, cuenta en Render, y el repositorio conectado.

### Pasos

1. **Sube el código a GitHub** (si no lo has hecho)
   ```powershell
   cd C:\Users\Alumno\Desktop\aplicacion
   git add .
   git commit -m "Listo para Render"
   git push origin main
   ```

2. **Configura el servicio en Render**
   - Entra a [dashboard.render.com](https://dashboard.render.com)
   - **New** → **Web Service**
   - Conecta GitHub y elige tu repositorio
   - En **Environment**, agrega `DATABASE_URL` con tu URL de Neon

3. **Despliega**
   - Pulsa **Create Web Service**
   - Render compila y arranca el servidor solo

4. **Usa la app**
   - URL: `https://hidrourgencias.onrender.com` (o la que muestre Render)

**Ventaja:** Siempre disponible, sin encender tu PC. **Desventaja:** Requiere configuración inicial (GitHub + Render).

---

## Resumen rápido

| Situación                         | Qué hacer                          |
|-----------------------------------|------------------------------------|
| Probar ahora, en tu PC            | Doble clic en `Iniciar Hidrourgencias.bat` |
| Servidor 24/7 en internet         | Subir a GitHub y desplegar en Render |

---

## Si algo falla

- **"password authentication failed"** → Revisa `DATABASE_URL` en `server/.env`
- **No abre localhost:3001** → Comprueba que la ventana del .bat siga abierta
- **Error en Render** → Revisa los logs en el Dashboard de Render y que `DATABASE_URL` esté bien configurada
