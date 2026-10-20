#!/usr/bin/env python3
"""Prueba de navegador de un dashboard ya construido (agent-browser + Chrome).

    python tools/navegador.py http://127.0.0.1:8765/index.html [--rol admin|reunion]
           [--anchos 1440,390] [--capturas carpeta]

Entra con el PIN del rol (de secrets.json, sin imprimirlo), recorre TODAS las
secciones del menu y, en cada una, cuenta los graficos pintados, las piezas
vacias y los errores. Sale con 1 si hay errores de consola, piezas rotas o
graficos sin pintar. Requiere el servidor local levantado en la raiz del repo.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AB = shutil.which("agent-browser") or "agent-browser"   # en Windows es un .cmd


def ab(*args):
    r = subprocess.run([AB, *args], capture_output=True, text=True, encoding="utf-8", timeout=180)
    if r.returncode != 0:
        raise RuntimeError(f"agent-browser {args[0]}: {r.stderr.strip() or r.stdout.strip()}")
    return r.stdout.strip()


def evaluar(js):
    out = ab("eval", " ".join(js.splitlines()))     # el .cmd de Windows corta en los saltos de linea
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return out


RECORRIDO = r"""(async()=>{const r=[];const espera=ms=>new Promise(x=>setTimeout(x,ms));
 const ids=[...document.querySelectorAll('#nav a')].map(a=>a.getAttribute('href').slice(1));
 for(const id of ids){GIP.ir(id);await espera(900);
   const graf=[...document.querySelectorAll('.main .grafico')].filter(g=>!g.closest('[hidden]'));
   const sin=graf.filter(g=>!g.querySelector('canvas')).map(g=>g.id);
   const rotas=[...document.querySelectorAll('.main .error')].map(e=>e.textContent.slice(0,120));
   const desborde=document.documentElement.scrollWidth>innerWidth+1;
   r.push({id,graficos:graf.length,sinPintar:sin,rotas,desborde});}
 return JSON.stringify(r);})()"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("--rol", default="admin")
    ap.add_argument("--anchos", default="1440,390")
    ap.add_argument("--capturas", default="")
    a = ap.parse_args()
    with open(os.path.join(RAIZ, "secrets.json"), encoding="utf-8") as f:
        sec = json.load(f)
    pin = sec["reunion"]["pin"] if a.rol == "reunion" else next(u["pin"] for u in sec["users"] if u["role"] == a.rol)
    fallos = 0
    for ancho in [int(x) for x in a.anchos.split(",")]:
        ab("set", "viewport", str(ancho), "900")
        ab("open", a.url + "#entrar")
        ab("errors", "--clear")
        evaluar("document.getElementById('pin').value=%s;document.getElementById('enter').click();'ok'" % json.dumps(pin))
        ab("wait", "4500")
        res = evaluar(RECORRIDO)
        if isinstance(res, str):
            res = json.loads(res)
        print(f"== {a.rol} a {ancho}px: {len(res)} secciones")
        for s in res:
            mal = s["sinPintar"] or s["rotas"] or s["desborde"]
            fallos += bool(mal)
            print(f"  {'MAL' if mal else 'ok '} {s['id']:<12} {s['graficos']:>2} graficos"
                  + (f" · sin pintar {s['sinPintar']}" if s["sinPintar"] else "")
                  + (f" · rotas {s['rotas']}" if s["rotas"] else "") + (" · DESBORDA EN HORIZONTAL" if s["desborde"] else ""))
            if a.capturas:
                os.makedirs(a.capturas, exist_ok=True)
                evaluar("GIP.ir(%s);'ok'" % json.dumps(s["id"]))
                ab("wait", "700")
                ab("screenshot", "--full", os.path.join(a.capturas, f"{a.rol}_{ancho}_{s['id']}.png"))
        errores = ab("errors")
        if errores and "No errors" not in errores and errores.strip() not in ("[]", ""):
            fallos += 1
            print("  ERRORES DE PAGINA:\n" + errores[:2000])
    print("NAVEGADOR " + ("OK" if not fallos else f"CON {fallos} FALLOS"))
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
