# Guía de Instalación - Hidrourgencias SpA

## Requisitos previos

- **Node.js** 18 o superior
- **Android Studio** (para compilar APK) o **Android SDK**
- **Base de datos PostgreSQL** (local o Neon/Render)
- **npm** (incluido con Node.js)

---

## 1. Instalación inicial (primera vez)

### 1.1 Instalar dependencias

Abrir PowerShell o CMD en la carpeta del proyecto:

```bash
cd C:\Users\Alumno\Desktop\aplicacion

# Instalar dependencias del proyecto raíz
npm install

# Instalar dependencias del cliente
cd client
npm install

# Instalar dependencias del servidor
cd ..\server
npm install
```

### 1.2 Configurar base de datos

Crear archivo `server/.env` con:

```
DATABASE_URL=postgresql://usuario:contraseña@host:5432/nombre_base
```

Ejemplo para Neon/Render:

```
DATABASE_URL=postgresql://usuario:abc123@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
```

---

## 2. Arrancar el servidor

### Opción A: Servidor local + túnel (para pruebas en celular en la misma red)

Ejecutar el archivo **Iniciar Hidrourgencias.bat** (doble clic).

O manualmente:

```bash
cd C:\Users\Alumno\Desktop\aplicacion
node iniciar.js
```

Esto inicia:
- Servidor en `http://localhost:3001`
- Túnel localtunnel (si está disponible) para acceso desde internet

### Opción B: Solo servidor (sin túnel)

```bash
cd C:\Users\Alumno\Desktop\aplicacion\server
npm start
```

### Opción C: Servidor en modo desarrollo (recarga automática)

```bash
cd C:\Users\Alumno\Desktop\aplicacion\server
npm run dev
```

---

## 3. Usar la app en web

### 3.1 Modo desarrollo (cliente + servidor)

**Terminal 1 – Servidor:**

```bash
cd C:\Users\Alumno\Desktop\aplicacion\server
npm run dev
```

**Terminal 2 – Cliente:**

```bash
cd C:\Users\Alumno\Desktop\aplicacion\client
npm run dev
```

Abrir en el navegador: **http://localhost:5173**

El cliente usa el proxy configurado y las peticiones van a `localhost:3001`.

### 3.2 Modo producción (versión compilada)

```bash
cd C:\Users\Alumno\Desktop\aplicacion\client
npm run build
npm run preview
```

Abrir: **http://localhost:4173** (o el puerto que indique Vite).

Para apuntar a un servidor remoto (ej. Render):

1. Ir a login
2. Clic en "Configurar servidor"
3. Ingresar: `https://hidrourgencias.onrender.com`
4. Guardar

---

## 4. Generar e instalar la APK

### 4.1 Compilar la APK

```bash
cd C:\Users\Alumno\Desktop\aplicacion\client
npm run apk
```

O paso a paso:

```bash
cd C:\Users\Alumno\Desktop\aplicacion\client
npm run build
npx cap sync android
cd android
.\gradlew assembleDebug
```

La APK se genera en:

```
client\android\app\build\outputs\apk\debug\app-debug.apk
```

### 4.2 Instalar en el celular

**Opción 1 – Cable USB**

1. Activar **Depuración USB** en el celular (Ajustes > Acerca del teléfono > tocar 7 veces "Número de compilación" > Ajustes > Opciones de desarrollador).
2. Conectar el celular al PC.
3. Ejecutar:

```bash
cd C:\Users\Alumno\Desktop\aplicacion\client\android
.\gradlew installDebug
```

**Opción 2 – Copiar la APK**

1. Copiar `app-debug.apk` al celular (Google Drive, correo, USB, etc.).
2. En el celular, abrir el archivo e instalar.
3. Permitir "Instalar apps de orígenes desconocidos" si lo pide el sistema.

---

## 5. Configurar la APK para tu servidor

La app usa por defecto `https://hidrourgencias.onrender.com`. Para cambiar:

1. Abrir la app en el celular.
2. En la pantalla de login, tocar **"Configurar servidor"**.
3. Ingresar la URL base (ej: `https://tu-servidor.onrender.com` o la URL del túnel).
4. Guardar y volver a intentar iniciar sesión.

---

## 6. Credenciales por defecto

| Usuario        | Contraseña     | Rol     |
|----------------|----------------|---------|
| administracion | administracion | Admin   |
| ventas         | Hidro2026      | Ventas  |
| german         | Hidro2026      | Técnico |
| (otros técnicos) | Hidro2026    | Técnico |

> Nota: cambiar las contraseñas después del primer acceso.

---

## Resumen de comandos útiles

| Acción              | Comando                                  |
|---------------------|------------------------------------------|
| Arrancar servidor   | Doble clic en `Iniciar Hidrourgencias.bat` |
| Web (desarrollo)    | `cd client && npm run dev`               |
| Compilar APK        | `cd client && npm run apk`               |
| Copia de seguridad  | Doble clic en `Copia_de_Seguridad.bat`   |
