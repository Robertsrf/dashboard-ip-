#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Publica los artefactos de un corte en GitHub -> GitHub Pages los despliega solo.

    python publish.py ["mensaje del commit"]

Paso 10 del corte (METODO.md §2): antes van el build y la verificacion. Solo sube
los artefactos y su historial; nunca secrets.json ni los Excel/Word (ignorados).
Un cambio de codigo NO se publica con este script: va en su propio commit.
"""
import os, sys, subprocess, datetime

os.chdir(os.path.dirname(os.path.abspath(__file__)))

def git(*args, check=True, capture=False):
    return subprocess.run(["git", *args], check=check,
                          capture_output=capture, text=True)

# Lo que cambia en un corte: las paginas y Novedades (el build agrega el corte).
# history*.json NO: traen ventas, costos y margenes en claro y el repo es publico;
# viven solo en local (y en los respaldos).
ARTEFACTOS = ["index.html", "caleb.html", "changelog.json"]
git("add", *[a for a in ARTEFACTOS if os.path.exists(a)])

# ¿Hay algo que commitear?
if git("diff", "--cached", "--quiet", check=False).returncode == 0:
    print("Sin cambios que publicar. Nada que hacer.")
    sys.exit(0)

stamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
git("commit", "-m", sys.argv[1] if len(sys.argv) > 1 else f"Corte publicado {stamp}")
git("push", "origin", "main")
print(f"Publicado en GitHub ({stamp}). GitHub Pages se actualiza en ~1 min.")
