#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Publica el dashboard en GitHub -> GitHub Pages lo despliega solo.

Reemplaza el antiguo paso de "deploy a Netlify". La tarea automatica debe:
  1) descargar el Excel de Drive
  2) generar el dashboard:   python build_dashboard.py <xlsx> <version> index.html
  3) publicar:               python publish.py

Requisitos del entorno donde corre la tarea:
  - git instalado y el repo clonado (este directorio) con remoto 'origin' a GitHub.
  - Credenciales de push a GitHub disponibles (token/PAT con permiso de escritura
    en el repo, o credential manager / SSH ya configurado).

No sube secrets.json ni el Excel (estan ignorados por .gitignore).
"""
import os, sys, subprocess, datetime

os.chdir(os.path.dirname(os.path.abspath(__file__)))

def git(*args, check=True, capture=False):
    return subprocess.run(["git", *args], check=check,
                          capture_output=capture, text=True)

# Solo publicamos los artefactos que cambian en cada corte.
git("add", "index.html", "history.json")

# ¿Hay algo que commitear?
if git("diff", "--cached", "--quiet", check=False).returncode == 0:
    print("Sin cambios que publicar. Nada que hacer.")
    sys.exit(0)

stamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
git("commit", "-m", f"Auto-update {stamp}")
git("push", "origin", "main")
print(f"Publicado en GitHub ({stamp}). GitHub Pages se actualiza en ~1 min.")
