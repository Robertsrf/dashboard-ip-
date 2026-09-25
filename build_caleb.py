#!/usr/bin/env python3
"""Generador del dashboard de Tiendas Caleb.

Uso:  python build_caleb.py <reporte_caleb.xlsx> "<version>" <salida.html>

Certifica el Excel con caleb_clean.py (aborta si algo no cuadra), arma el paquete de datos, lo cifra con los
mismos PINs que IP (secrets.json) y lo inserta en template_caleb.html junto con la puerta del Grupo IP.
La logica de cada campo esta en CONTEXTO_CALEB.md.
"""
import datetime as dt
import html
import json
import os
import sys

import pandas as pd

import caleb_clean as CC
import secure as SECURE

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


def payload(f, version):
    dia0 = f['FECHADOC'].dt.normalize().min()
    dia = (f['FECHADOC'].dt.normalize() - dia0).dt.days.astype(int)
    n_dias = int(dia.max()) + 1
    fechas = [dia0 + pd.Timedelta(days=i) for i in range(n_dias)]
    meses, i_mes = _indice([d.strftime('%Y-%m') for d in fechas])

    prods = productos(f)
    i_prod = {c: i for i, c in enumerate(prods.index)}
    clis = clientes(f)
    i_cli = {c: i for i, c in enumerate(clis.index)}
    docs, i_doc = _indice(f['DOCUMENTO'].tolist())
    vends, i_vend = _indice(f['VENDEDOR'].tolist())
    marcas, i_marca = _indice(prods['marca'].tolist())

    filas = [[int(d), int(h), i_doc[doc], i_prod[str(cod).strip()], i_vend[v], i_cli[c],
              round(float(q), 3), round(float(dv), 3), round(float(p), 4), round(float(k), 4), round(float(ds), 4)]
             for d, h, doc, cod, v, c, q, dv, p, k, ds in zip(
                 dia, f['FECHAYHORA'].dt.hour, f['DOCUMENTO'], f['CODIGO'], f['VENDEDOR'], f['CLI'],
                 f['CANTIDAD'], f['CNTDEVUELT'], f['PRECIOFIN'], f['COSTOUNIT'], f['DSCTOUNIT'])]

    return {
        'version': version, 'generated': pd.Timestamp.now().strftime('%Y-%m-%d %H:%M'),
        'dateMin': f['FECHADOC'].min().strftime('%Y-%m-%d'), 'dateMax': f['FECHADOC'].max().strftime('%Y-%m-%d'),
        'dayZero': dia0.strftime('%Y-%m-%d'), 'dayCount': n_dias,
        'dims': {
            'mes': meses, 'mesLabels': [f"{MESES[int(m[5:]) - 1]} {m[2:4]}" for m in meses],
            'dayMes': [i_mes[d.strftime('%Y-%m')] for d in fechas],
            'grupo': [CC.GRUPOS[k] for k in sorted(CC.GRUPOS)],
            'vendedor': vends, 'marca': marcas, 'tipo': TIPOS,
            'producto': prods['nombre'].tolist(), 'prodCod': prods.index.tolist(),
            'prodGrupo': [int(g) - 1 for g in prods['grupo']], 'prodMarca': [i_marca[m] for m in prods['marca']],
            'prodEx': [round(float(x), 2) for x in prods['ex']], 'prodUnidad': prods['unidad'].fillna('').tolist(),
            'cliente': clis['nombre'].tolist(), 'cliCod': clis.index.tolist(),
            'cliTipo': [TIPOS.index(t) for t in clis['tipo']],
            'doc': docs, 'docSerie': [1 if d.startswith('*') else 0 for d in docs],
        },
        'rows': filas,
    }


def historial(ruta, resumen):
    """Una entrada por corte, identificada por la fecha 'hasta' (regenerar el mismo corte la reemplaza)."""
    hist = json.load(open(ruta, encoding='utf-8')) if os.path.exists(ruta) else []
    entrada = {k: (str(v) if isinstance(v, dt.date) else v) for k, v in resumen.items()}
    hist = [h for h in hist if h.get('hasta') != entrada['hasta']] + [entrada]
    hist.sort(key=lambda h: h['hasta'])
    json.dump(hist, open(ruta, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return hist


def main():
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    xlsx, version, salida = sys.argv[1:4]
    f = CC.main(xlsx)                      # imprime la certificacion y sale con 1 si algo falla
    datos = payload(f, version)
    secretos = json.load(open(os.environ.get('SECRETS_PATH', os.path.join(AQUI, 'secrets.json')), encoding='utf-8'))
    enc = SECURE.encrypt(json.dumps({'P': datos}, ensure_ascii=False, separators=(',', ':')), secretos)

    puerta = open(os.path.join(AQUI, 'puerta.html'), encoding='utf-8').read()
    puerta = (puerta.replace('__PUERTA_AQUI__', 'caleb').replace('__PUERTA_ACENTO__', '#0F4F9C')
                    .replace('__PUERTA_LOGO__', '<img src="assets/logo-caleb.png" alt="Tiendas Caleb">')
                    .replace('__PUERTA_NOMBRE__', 'Tiendas Caleb'))
    plantilla = open(os.path.join(AQUI, 'template_caleb.html'), encoding='utf-8').read()
    pagina = (plantilla.replace('__PUERTA__', puerta)
                       .replace('__VERSION__', html.escape(version))
                       .replace('__ENC_JSON__', json.dumps(enc, ensure_ascii=False, separators=(',', ':'))))
    restos = [p for p in ('__PUERTA', '__VERSION__', '__ENC_JSON__') if p in pagina]
    if restos:
        raise SystemExit(f'Quedaron marcadores sin reemplazar: {restos}')
    with open(salida, 'w', encoding='utf-8') as fh:
        fh.write(pagina)
    hist = historial(os.path.join(AQUI, 'history_caleb.json'), CC.resumen(f))
    print(f'OK -> {salida} ({len(pagina) / 1e6:.2f} MB, {len(datos["rows"])} filas, {len(hist)} cortes en el historial)')


if __name__ == '__main__':
    main()
