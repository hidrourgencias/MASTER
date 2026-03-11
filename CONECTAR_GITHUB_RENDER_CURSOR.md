# Conectar GitHub, Render y Cursor

Guía para unir los tres servicios y tener un flujo de trabajo: **editas en Cursor** → **subes a GitHub** → **Render despliega automáticamente**.

---

## Resumen del flujo

```
Cursor (editas código)  →  Git push  →  GitHub  →  Render (despliega)
```

---

## Parte 1: GitHub

### 1.1 Crear repositorio en GitHub (si no tienes uno)

1. Entra a [github.com](https://github.com)
2. **+** (arriba derecha) → **New repository**
3. Nombre: `aplicacion` o `hidrourgencias`
4. **Create repository** (sin README si ya tienes código local)

### 1.2 Conectar tu carpeta local con GitHub

Abre **PowerShell** o **Terminal** en Cursor:

```powershell
cd C:\Users\Alumno\Desktop\aplicacion

# Ver si ya tienes un remoto
git remote -v

# Si NO tienes remoto, agrega GitHub:
git remote add origin https://github.com/TU_USUARIO/NOMBRE_REPO.git

# Si ya tienes remoto pero con otra URL, cámbiala:
git remote set-url origin https://github.com/TU_USUARIO/NOMBRE_REPO.git

# Subir por primera vez (o actualizar)
git add .
git commit -m "Conectar con GitHub y Render"
git branch -M main
git push -u origin main
```

Reemplaza `TU_USUARIO` y `NOMBRE_REPO` por tu usuario y nombre del repo en GitHub.

### 1.3 Autenticación con GitHub

Si al hacer `git push` te pide usuario/contraseña:

- **Usuario**: tu usuario de GitHub
- **Contraseña**: ya no se usa; debes usar un **Personal Access Token (PAT)**

Para crear un token:

1. GitHub → **Settings** → **Developer settings** → **Personal access tokens**
2. **Generate new token (classic)**
3. Marca `repo` (acceso a repositorios)
4. Copia el token y úsalo como contraseña cuando hagas `git push`

---

## Parte 2: Render

### 2.1 Conectar Render con GitHub

1. Entra a [dashboard.render.com](https://dashboard.render.com)
2. **New** → **Web Service**
3. **Build and deploy from a Git repository** → **Connect account**
4. Elige **GitHub** y autoriza el acceso
5. Busca y selecciona tu repositorio (`aplicacion` o el que uses)
6. **Connect**

### 2.2 Configurar el servicio

- **Name**: `hidrourgencias`
- **Branch**: `main` (o la rama que uses)
- **Root Directory**: (vacío = raíz del repo)
- **Runtime**: `Node`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`

Render puede tomar estos valores del `render.yaml` si está en el repo.

### 2.3 Variables de entorno

En **Environment** agrega:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Tu URL de Neon (postgresql://...) |
| `JWT_SECRET` | Una cadena secreta larga |

### 2.4 Crear el servicio

Pulsa **Create Web Service**. Render desplegará el proyecto.

### 2.5 Auto-Deploy

Por defecto, **Auto-Deploy** está activado: cada `git push` a la rama conectada dispara un nuevo despliegue.

---

## Parte 3: Cursor

### 3.1 Cursor ya usa tu carpeta local

Cursor trabaja sobre la carpeta del proyecto. Si esa carpeta es un repositorio git, Cursor usa git automáticamente.

### 3.2 Abrir el proyecto en Cursor

1. **File** → **Open Folder**
2. Selecciona `C:\Users\Alumno\Desktop\aplicacion`
3. Cursor verá los archivos y el historial de git

### 3.3 Flujo de trabajo diario en Cursor

1. **Editar** el código normalmente
2. **Source Control** (icono de ramas en la barra izquierda) o `Ctrl+Shift+G`
3. Escribe el mensaje del commit
4. **Commit** y luego **Push**

O desde la terminal integrada:

```powershell
git add .
git commit -m "Descripción del cambio"
git push
```

### 3.4 Extensión de GitHub (opcional)

- Instala la extensión **GitHub** en Cursor
- Permite ver PRs, issues y hacer push/pull sin salir del editor

---

## Diagrama del flujo completo

```
┌─────────────┐      git push       ┌─────────────┐     webhook      ┌─────────────┐
│   CURSOR    │ ──────────────────► │   GITHUB    │ ───────────────► │   RENDER    │
│  (editas)   │                     │  (repositorio)  (auto-deploy)   │  (servidor) │
└─────────────┘                     └─────────────┘                  └─────────────┘
       │                                    │                                │
       │ git clone / git pull                │                                │
       └────────────────────────────────────┘                                │
                                                                              │
                           https://hidrourgencias.onrender.com ◄──────────────┘
```

---

## Comandos útiles

| Acción | Comando |
|--------|---------|
| Ver estado | `git status` |
| Ver remoto | `git remote -v` |
| Subir cambios | `git add .` luego `git commit -m "mensaje"` luego `git push` |
| Actualizar local | `git pull` |
| Ver logs de Render | Dashboard de Render → tu servicio → **Logs** |

---

## Comprobar que todo está conectado

1. **Cursor ↔ GitHub**: Haz un cambio, commit y push. Debe aparecer en GitHub.
2. **GitHub ↔ Render**: Después del push, en Render debería iniciarse un deploy automático.
3. **Render**: Abre `https://hidrourgencias.onrender.com` y revisa que la app cargue.
