#!/usr/bin/env python3
"""Generador del dashboard de Tiendas Caleb.

Uso:  python build_caleb.py <reporte_caleb.xlsx> "<version>" <salida.html>

Certifica el Excel con caleb_clean.py (aborta si algo no cuadra), arma el paquete v2 (grupo/paquete.py), lo
cifra con los mismos PIN que IP (y el de reunion, sin costos ni margenes) y arma caleb.html con app/.
La logica de cada campo esta en CONTEXTO_CALEB.md; las reglas del sistema, en METODO.md.
"""
import datetime as dt
import json
import os
import sys

import pandas as pd

import caleb_clean as CC
import secure as SECURE
from grupo import changelog as CL
from grupo import pagina as PAG
from grupo import paquete as PAQ
from grupo import reunion as REUNION

AQUI = os.path.dirname(os.path.abspath(__file__))
MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
TIPOS = ['Persona', 'Empresa', 'Gobierno', 'Consumidor final', 'Otro']


def _moda(serie):
    serie = serie.dropna()
    return serie.mode().iloc[0] if len(serie) else None


def _unidad(v):
    # Excel convierte la unidad "1/4" (cuarto de galon) en la fecha 1-abr
    if isinstance(v, (dt.datetime, pd.Timestamp)):
        return f'{v.day}/{v.month}'
    return '' if v is None or (isinstance(v, float) and pd.isna(v)) else str(v).strip()


def _unicos(nombres, codigos):
    """El front filtra y responde a los clics por nombre: dos codigos con el mismo nombre llevan el codigo."""
    cuenta = pd.Series(nombres).value_counts()
    return [f'{n} · {c}' if cuenta[n] > 1 else n for n, c in zip(nombres, codigos)]


def _indice(valores):
    orden = sorted(set(valores))
    return orden, {v: i for i, v in enumerate(orden)}


def productos(f):
    f = f.assign(COD=f['CODIGO'].astype(str).str.strip())
    g = f.groupby('COD')
    tabla = pd.DataFrame({'nombre': g['NOMBRE'].agg(_moda), 'grupo': g['GRUPO'].first(),
                          'marca': g['MARCA'].first(), 'ex': g['EXISTENCIA'].first(),
                          'unidad': g['UNIDAD'].agg(lambda s: _moda(s.map(_unidad).loc[lambda x: x != '']) or '')})
    tabla = tabla.sort_values('nombre')
    tabla['nombre'] = _unicos(tabla['nombre'].tolist(), tabla.index.tolist())
    return tabla


def clientes(f):
    g = f.groupby('CLI')
    tabla = pd.DataFrame({'nombre': g['NOMBRECLI'].agg(_moda), 'tipo': g['TIPOCLI'].first()}).sort_values('nombre')
    tabla['nombre'] = _unicos(tabla['nombre'].tolist(), tabla.index.tolist())
    return tabla


def paquete(f, version):
    """Dimensiones y columnas del paquete v2. Lo que la v3 derivaba fila a fila en
    el navegador (expand) se calcula aqui una vez: mes, grupo, marca, tipo y serie
    por fila, y los importes. Margen (CONTEXTO_CALEB.md C4 y C10): solo ventas con
    precio y costo registrado; la salida a precio $0 va aparte (p0) y una venta
    sin costo registrado (sc) no entra al margen."""
    dia0 = f['FECHADOC'].dt.normalize().min()
    dia = (f['FECHADOC'].dt.normalize() - dia0).dt.days.astype(int).to_numpy()
    n_dias = int(dia.max()) + 1
    fechas = [dia0 + pd.Timedelta(days=i) for i in range(n_dias)]
    meses, i_mes = _indice([d.strftime('%Y-%m') for d in fechas])
    dia_mes = [i_mes[d.strftime('%Y-%m')] for d in fechas]

    prods = productos(f)
    i_prod = {c: i for i, c in enumerate(prods.index)}
    clis = clientes(f)
    i_cli = {c: i for i, c in enumerate(clis.index)}
    docs, i_doc = _indice(f['DOCUMENTO'].tolist())
    vends, i_vend = _indice(f['VENDEDOR'].tolist())
    marcas, i_marca = _indice(prods['marca'].tolist())
    prod_grupo = [int(g) - 1 for g in prods['grupo']]
    prod_marca = [i_marca[m] for m in prods['marca']]
    cli_tipo = [TIPOS.index(t) for t in clis['tipo']]
    doc_serie = [1 if d.startswith('*') else 0 for d in docs]

    prod = f['CODIGO'].astype(str).str.strip().map(i_prod).to_numpy()
    cli = f['CLI'].map(i_cli).to_numpy()
    doc = f['DOCUMENTO'].map(i_doc).to_numpy()
    cant = f['CANTIDAD'].astype(float).round(3).to_numpy()
    dev = f['CNTDEVUELT'].astype(float).round(3).to_numpy()
    precio = f['PRECIOFIN'].astype(float).round(4).to_numpy()
    costo = f['COSTOUNIT'].astype(float).round(4).to_numpy()
    q = cant - dev
    con_costo = (precio > 0) & (costo > 0)

    def m4(v):                               # dinero con 4 decimales, como el precio del ERP
        return (v, 10000)
    cols = {
        'dia': dia, 'hora': f['FECHAYHORA'].dt.hour.to_numpy(), 'doc': doc, 'prod': prod,
        'vend': f['VENDEDOR'].map(i_vend).to_numpy(), 'cli': cli,
        'mes': [dia_mes[d] for d in dia], 'grupo': [prod_grupo[p] for p in prod],
        'marca': [prod_marca[p] for p in prod], 'tipo': [cli_tipo[c] for c in cli],
        'serie': [doc_serie[d] for d in doc],
        'cant': (cant, 1000), 'dev': (dev, 1000), 'q': (q, 1000),
        'precio': m4(precio), 'costo': m4(costo),
        'neto': m4(q * precio), 'bruto': m4(cant * precio), 'devm': m4(dev * precio),
        'vm': m4(q * precio * con_costo), 'cst': m4(q * costo * con_costo),
        'p0': m4(q * costo * (precio <= 0)), 'sc': m4(q * precio * ((precio > 0) & (costo <= 0))),
    }
    dims = {
        'mes': meses, 'mesLabels': [f"{MESES[int(m[5:]) - 1]} {m[2:4]}" for m in meses], 'dayMes': dia_mes,
        'grupo': [CC.GRUPOS[k] for k in sorted(CC.GRUPOS)], 'vend': vends, 'marca': marcas, 'tipo': TIPOS,
        'prod': prods['nombre'].tolist(), 'prodCod': prods.index.tolist(), 'prodGrupo': prod_grupo,
        'prodMarca': prod_marca, 'prodEx': [round(float(x), 2) for x in prods['ex']],
        'prodUnidad': prods['unidad'].fillna('').tolist(),
        'cli': clis['nombre'].tolist(), 'cliCod': clis.index.tolist(), 'cliTipo': cli_tipo,
        'doc': docs, 'docSerie': doc_serie, 'serie': ['Numérica', 'Fiscal (*)'],
    }
    meta = {'empresa': 'caleb', 'version': version, 'generated': pd.Timestamp.now().strftime('%Y-%m-%d %H:%M'),
            'dateMin': f['FECHADOC'].min().strftime('%Y-%m-%d'), 'dateMax': f['FECHADOC'].max().strftime('%Y-%m-%d'),
            'dayZero': dia0.strftime('%Y-%m-%d'), 'dayCount': n_dias, 'dims': dims}
    return meta, cols


def historial(ruta, resumen):
    """Una entrada por corte, identificada por la fecha 'hasta' (regenerar el mismo corte la reemplaza)."""
    hist = json.load(open(ruta, encoding='utf-8')) if os.path.exists(ruta) else []
    entrada = {k: (str(v) if isinstance(v, dt.date) else v) for k, v in resumen.items()}
    hist = [h for h in hist if h.get('hasta') != entrada['hasta']] + [entrada]
    hist.sort(key=lambda h: h['hasta'])
    json.dump(hist, open(ruta, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return hist


CFG = {'clave': 'caleb', 'nombre': 'Tiendas Caleb', 'modulo': 'caleb.js',
       'titulo': 'Tiendas Caleb · Inteligencia de Ventas', 'acento': '#0F4F9C',
       'logo_html': '<img src="assets/logo-caleb.png" alt="" width="104" height="48">',
       'puerta_logo': '<img src="assets/logo-caleb.png" alt="Tiendas Caleb">'}


def main():
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    xlsx, version, salida = sys.argv[1:4]
    cl_path = os.path.join(AQUI, 'changelog.json')
    CL.verificar(cl_path, AQUI)            # codigo nuevo sin entrada en Novedades: no se publica
    f = CC.main(xlsx)                      # imprime la certificacion y sale con 1 si algo falla
    meta, cols = paquete(f, version)
    hist = historial(os.path.join(AQUI, 'history_caleb.json'), CC.resumen(f))
    corte = len(hist)
    CL.corte(cl_path, 'caleb', corte, meta['dateMax'],
             ['Ventas hasta el ' + '-'.join(reversed(meta['dateMax'].split('-'))) + '.'])   # sin cifras: el repo es publico
    meta.update(corte=corte, changelog=CL.cargar(cl_path))

    with open(os.environ.get('SECRETS_PATH', os.path.join(AQUI, 'secrets.json')), encoding='utf-8') as fh:
        secretos = json.load(fh)
    iters = int(secretos.get('iterations', 200000))
    enc = SECURE.encrypt_bytes(PAQ.empaquetar(meta, cols), secretos['users'], iters)
    reunion = SECURE.reunion_users(secretos)
    enc_r = (SECURE.encrypt_bytes(PAQ.empaquetar(*REUNION.limpiar('caleb', meta, cols)), reunion, iters)
             if reunion else None)
    with open(os.path.join(AQUI, 'app', 'favicons.json'), encoding='utf-8') as fh:
        cfg = dict(CFG, favicon=json.load(fh)['caleb'])
    html = PAG.construir(cfg, enc, enc_r, version)
    PAG.escribir(salida, html)
    print(f'OK -> {salida} ({len(html) / 1e6:.2f} MB, {len(f)} filas, {len(hist)} cortes en el historial)')


if __name__ == '__main__':
    main()
