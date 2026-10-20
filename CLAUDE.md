# Sistema Grupo IP · instrucciones para Claude

Antes de cualquier cosa, lee **`METODO.md`** (proceso, corte, cambios, Novedades, reunión, seguridad).
Datos de IP: `CONTEXTO_CLAUDE.md` (los 7 invariantes I1–I7 mandan). Datos de Caleb: `CONTEXTO_CALEB.md`.
Interfaz: `DESIGN.md`. Diseño de la v4: `docs/v4-spec.md`.

Reglas que no se olvidan:

1. «Haz lo de siempre» = corte completo de `METODO.md` §2 hasta el push, con respaldo y verificación.
2. **Todo cambio de código suma una entrada en Novedades** (`python -m grupo.changelog nueva …`). El build
   se niega a publicar sin ella.
3. `index.html` y `caleb.html` son artefactos: la interfaz vive en `app/`, el cálculo en `grupo/` y los
   parsers. Nunca se editan a mano.
4. Vendedores: #10 es Héctor (antes «Leonardo»), #20 es Jorge desde el 24-09-2026 (antes «Edixon»).
   Relevos nuevos van en `grupo/reglas.py` con su prueba.
5. Pruebas: `python -m unittest discover -s tests` · `node --test tests/*.test.mjs` ·
   `python tools/verificar.py <pagina> [excel]` · `python tools/navegador.py <url>`.
6. Nunca en git: `secrets.json`, `*.xlsx`, `*.docx`. Nunca imprimir un PIN.
7. Roberts escribe en español y quiere respuestas cortas. Cambios grandes: ingenieria-pro →
   disenio-web-pro → seguridad-web.
