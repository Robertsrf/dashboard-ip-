#!/usr/bin/env python3
"""Lectura, reparacion y certificacion del Excel de ventas de Tiendas Caleb.

Uso:  python caleb_clean.py <archivo.xls|xlsx>
Imprime el informe de certificacion y sale con codigo 1 si alguna verificacion falla.
La logica completa y el porque de cada paso estan en CONTEXTO_CALEB.md.
"""
import datetime as dt
import re
import sys
import zipfile

import pandas as pd

COLUMNAS = ['AGENCIA', 'TIPODOC', 'DOCUMENTO', 'CODIGO', 'CODHIJO', 'PID', 'NOMBRE', 'GRUPO', 'SUBGRUPO',
            'CANTIDAD', 'CNTDEVUELT', 'PRECIOUNIT', 'COSTOUNIT', 'DSCTOUNIT', 'DSCTOPRC', 'PRECIOFIN',
            'MONTONETO', 'MONTOTOTAL', 'IMPUESTO1', 'TIMPUEPRC', 'COMISION', 'FECHADOC', 'AGRUPADO', 'UNIDAD',
            'CODCLIENTE', 'NOMBRECLI', 'EMISION', 'ESTATUSDOC', 'ALMACEN', 'VENDEDOR', 'SECTOR', 'ESTACION',
            'FECHAYHORA', 'NOMPRO', 'REFERENCIA', 'MARCA', 'EXISTENCIA', 'CNTGRP', 'SUMACANT', 'SUMANETO']

GRUPOS = {1: 'Construcción y acabados', 2: 'Acero y techos', 3: 'Jardín', 4: 'Pinturas'}

# El ERP exporta texto latin-1 que llega leido como CP850: cada glifo de la izquierda es la letra de la derecha
CP850 = {'Ð': 'Ñ', '╔': 'É', '┴': 'Á', '░': '°', '┌': 'Ú', 'Ë': 'Ó', '┤': '´', '═': 'Í'}

NUMERICAS = ['GRUPO', 'SUBGRUPO', 'CANTIDAD', 'CNTDEVUELT', 'PRECIOUNIT', 'COSTOUNIT', 'DSCTOUNIT', 'DSCTOPRC',
             'PRECIOFIN', 'MONTONETO', 'MONTOTOTAL', 'TIMPUEPRC', 'SECTOR', 'EXISTENCIA', 'CNTGRP', 'SUMACANT',
             'SUMANETO', 'ESTATUSDOC']
C = COLUMNAS.index


def _es_fecha(x):
    return isinstance(x, (dt.datetime, pd.Timestamp))


def firma_office(ruta):
    """El archivo se llama .XLS pero es un .xlsx: se valida por firma ZIP y por contenido, no por nombre."""
    with open(ruta, 'rb') as fh:
        if fh.read(4).hex() != '504b0304':
            raise SystemExit(f'{ruta}: no es un archivo de Office (la firma no es ZIP). No se procesa.')
    if not any(n.startswith('xl/') for n in zipfile.ZipFile(ruta).namelist()):
        raise SystemExit(f'{ruta}: es un ZIP pero no un libro de Excel. No se procesa.')


def leer(ruta):
    firma_office(ruta)
    df = pd.read_excel(ruta, header=1, engine='openpyxl')     # fila 0 = titulo "Articulos Vendidos O Entregados"
    faltan = [c for c in COLUMNAS if c not in df.columns]
    if faltan:
        raise SystemExit(f'Faltan columnas: {faltan}. El formato del ERP cambio: revisar antes de seguir.')
    return df[COLUMNAS]


def _realinear(fila):
    """Repara las filas que la comilla de pulgadas (8") corrio a la izquierda. Ver CONTEXTO_CALEB.md §3.1."""
    fila = list(fila)
    if not _es_fecha(fila[C('COMISION')]):
        return fila, 0
    m = re.match(r'^(.*?)";?(\d+)"?$', str(fila[C('NOMBRE')]))
    grupo = float(m.group(2)) if m else None
    fila[C('NOMBRE')] = (m.group(1) + '"') if m else fila[C('NOMBRE')]
    fila = fila[:C('GRUPO')] + [grupo] + fila[C('GRUPO'):-1]
    nompro = fila[C('NOMPRO')]
    if isinstance(nompro, str) and '";' in nompro:          # segunda comilla, ahora en NOMPRO
        partes = nompro.split('";')
        nuevo = [partes[0] + '"', partes[1].strip('"') or None, partes[2].strip('"') if len(partes) > 2 else None]
        fila = (fila[:C('NOMPRO')] + nuevo + fila[C('NOMPRO') + 1:])[:len(COLUMNAS)]
        return fila, 2
    if not isinstance(nompro, str):
        fila[C('NOMPRO')] = fila[C('NOMBRE')]
    return fila, 1


def _cliente(codigo):
    """Codigo de cliente comparable: sin guiones ni puntos, y los solo-numericos son cedulas (V)."""
    limpio = re.sub(r'[^A-Z0-9]', '', str(codigo).upper())
    return 'V' + limpio if limpio.isdigit() else limpio


def _tipo_cliente(cli):
    return {'V': 'Persona', 'E': 'Persona', 'J': 'Empresa', 'G': 'Gobierno', 'C': 'Consumidor final'}.get(cli[:1], 'Otro')


def limpiar(df):
    filas, saltos = [], {0: 0, 1: 0, 2: 0}
    for fila in df.itertuples(index=False):
        nueva, n = _realinear(fila)
        filas.append(nueva)
        saltos[n] += 1
    f = pd.DataFrame(filas, columns=COLUMNAS)
    for c in ['NOMBRE', 'NOMPRO', 'NOMBRECLI', 'MARCA']:
        f[c] = f[c].apply(lambda v: ''.join(CP850.get(ch, ch) for ch in v).strip() if isinstance(v, str) else v)
    for c in NUMERICAS:
        f[c] = pd.to_numeric(f[c], errors='coerce')
    for c in ['FECHADOC', 'EMISION', 'FECHAYHORA']:
        f[c] = pd.to_datetime(f[c], errors='coerce')
    # 'imporcenter' e 'IMPORCENTER' son la misma marca; los errores de tipeo (DIVRACA, DISP) no se adivinan
    f['MARCA'] = f['MARCA'].fillna('(Sin marca)').astype(str).str.strip().str.upper().replace({'(SIN MARCA)': '(Sin marca)'})
    f['DOCUMENTO'] = f['DOCUMENTO'].astype(str).str.strip()
    f['VENDEDOR'] = f['VENDEDOR'].astype(str).str.strip()
    f['CLI'] = f['CODCLIENTE'].map(_cliente)
    f['TIPOCLI'] = f['CLI'].map(_tipo_cliente)
    f['GRUPONOM'] = f['GRUPO'].map(GRUPOS)
    f['NETO'] = f['SUMACANT'] * f['PRECIOFIN']           # venta neta: descuenta lo devuelto
    f['DEVM'] = f['CNTDEVUELT'] * f['PRECIOFIN']         # devoluciones en dolares
    f['COSTO'] = f['SUMACANT'] * f['COSTOUNIT']
    f['MARGEN'] = f['NETO'] - f['COSTO']
    f['PRECIO0'] = f['PRECIOFIN'] <= 0                   # salidas sin cobro
    f['SERIE'] = f['DOCUMENTO'].str.startswith('*').map({True: 'Serie *', False: 'Numérica'})
    return f, saltos


def certificar(f):
    """Cada verificacion devuelve (nombre, filas que fallan). Una sola falla detiene el proceso."""
    return [
        ('FECHADOC es fecha', (~f.FECHADOC.notna()).sum()),
        ('FECHAYHORA es fecha', (~f.FECHAYHORA.notna()).sum()),
        ('SUMACANT = CANTIDAD - CNTDEVUELT', ((f.CANTIDAD - f.CNTDEVUELT - f.SUMACANT).abs() >= 1e-6).sum()),
        ('MONTONETO = CANTIDAD x PRECIOFIN', ((f.CANTIDAD * f.PRECIOFIN - f.MONTONETO).abs() >= 0.02).sum()),
        ('SUMANETO = MONTONETO', ((f.SUMANETO - f.MONTONETO).abs() >= 0.02).sum()),
        ('GRUPO en 1..4', (~f.GRUPO.isin(list(GRUPOS))).sum()),
        ('CNTDEVUELT <= CANTIDAD', (f.CNTDEVUELT > f.CANTIDAD + 1e-6).sum()),
        ('Sin glifos CP850 sin traducir', f.NOMBRE.astype(str).str.contains('|'.join(map(re.escape, CP850))).sum()),
    ]


def resumen(f):
    docs = f.groupby('DOCUMENTO').NETO.sum()
    neto = f.NETO.sum()
    return {
        'filas': len(f), 'desde': f.FECHADOC.min().date(), 'hasta': f.FECHADOC.max().date(),
        'dias_venta': f.FECHADOC.nunique(), 'bruto': round(f.MONTONETO.sum(), 2),
        'devoluciones': round(f.DEVM.sum(), 2), 'neto': round(neto, 2), 'costo': round(f.COSTO.sum(), 2),
        'margen_pct': round(f.MARGEN.sum() / neto * 100, 2), 'facturas': int((docs > 0).sum()),
        'clientes': f.CLI.nunique(), 'sku_vendidos': f[f.SUMACANT > 0].CODIGO.astype(str).nunique(),
        'salidas_precio0_costo': round((f[f.PRECIO0].SUMACANT * f[f.PRECIO0].COSTOUNIT).sum(), 2),
    }


def main(ruta):
    f, saltos = limpiar(leer(ruta))
    print(f'Filas reparadas: {saltos[1]} corridas una columna, {saltos[2]} corridas dos columnas')
    fallas = 0
    for nombre, n in certificar(f):
        print(f'  [{"OK " if n == 0 else "FALLA"}] {nombre}' + (f' ({n} filas)' if n else ''))
        fallas += int(n > 0)
    for k, v in resumen(f).items():
        print(f'  {k:24s} {v}')
    if fallas:
        print(f'\n{fallas} verificaciones fallaron: NO publicar. Revisar CONTEXTO_CALEB.md §3.', file=sys.stderr)
        sys.exit(1)
    return f


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
