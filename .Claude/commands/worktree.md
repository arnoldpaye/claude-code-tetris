---
description: Crea un git worktree aislado en .trees/[nombre] y ejecuta el requerimiento dentro de él
argument-hint: <requerimiento a implementar>
allowed-tools: Bash(git worktree:*), Bash(git branch:*), Bash(git status:*), Bash(git log:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(git -C:*)
---

Requerimiento recibido:

$ARGUMENTS

Sigue estos pasos en orden:

## 1. Validar entrada

Si `$ARGUMENTS` está vacío, detente y pide al usuario que describa el requerimiento. No crees nada.

## 2. Determinar el nombre del worktree

A partir del requerimiento, genera un `nombre` corto y descriptivo:
- En kebab-case, solo minúsculas, números y guiones (sin acentos ni espacios).
- Máximo ~4 palabras / 40 caracteres, con un prefijo según el tipo de cambio: `feat-`, `fix-`, `refactor-`, `docs-`, `style-`, `chore-`.
- Ejemplos: "agregar botón de reinicio" → `feat-boton-reinicio`; "el ghost piece se dibuja mal" → `fix-ghost-piece`.

Si ya existe `.trees/[nombre]` o una rama con ese nombre (`git worktree list`, `git branch --list [nombre]`), añade un sufijo numérico (`-2`, `-3`, …).

## 3. Crear el worktree

1. Asegúrate de que `.trees/` esté en `.gitignore`; si no lo está, añádelo (en el repositorio principal) para que los worktrees no se rastreen.
2. Crea el worktree con una rama nueva del mismo nombre, partiendo del HEAD actual:

   ```bash
   git worktree add .trees/[nombre] -b [nombre]
   ```

3. Verifica con `git worktree list` que se creó correctamente.

## 4. Ejecutar el requerimiento de forma aislada

A partir de aquí, **todo el trabajo ocurre exclusivamente dentro de `.trees/[nombre]`**:
- Lee, crea y edita archivos usando rutas absolutas bajo `.trees/[nombre]/`.
- Ejecuta comandos git con `git -C .trees/[nombre] ...` (o con el directorio de trabajo en el worktree).
- **No modifiques ningún archivo del directorio principal** (salvo `.gitignore` del paso 3.1).
- Respeta las convenciones de `CLAUDE.md` del proyecto.

Implementa el requerimiento completo. Al terminar, haz commit de los cambios en la rama `[nombre]` dentro del worktree con un mensaje descriptivo (Conventional Commits, en español).

## 5. Reportar

Al finalizar, informa en español:
- Nombre del worktree, ruta (`.trees/[nombre]`) y rama.
- Resumen de los cambios realizados y archivos modificados.
- Cómo probarlo (p. ej. `cd .trees/[nombre] && python3 -m http.server 8000`).
- Cómo integrarlo o descartarlo:
  - Integrar: `git merge [nombre]` desde la rama principal.
  - Descartar: `git worktree remove .trees/[nombre] && git branch -D [nombre]`.
