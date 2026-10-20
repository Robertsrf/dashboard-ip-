"""Paquete de datos v2: columnas binarias + gzip.

    bytes = b'GIP2' | u32 largo_meta | meta (JSON utf-8) | columnas

Cada columna es un arreglo entero little-endian alineado a 4 bytes, para que el
navegador cree vistas TypedArray sobre el mismo buffer sin copiar. Los decimales
viajan escalados a entero (dinero en centavos, cantidades en milesimas): las
sumas del navegador salen exactas y el paquete pesa una fraccion del JSON por
filas de la v3. `meta["cols"]` describe cada columna: {n, t, s, o, l} =
nombre, tipo, escala, offset en bytes desde el inicio, largo en elementos.
"""
import gzip
import json
import struct

import numpy as np

MAGIA = b"GIP2"
_TIPOS = [("u8", np.uint8, 0, 2**8 - 1), ("u16", np.uint16, 0, 2**16 - 1),
          ("u32", np.uint32, 0, 2**32 - 1)]
_I32 = ("i32", np.int32, -(2**31), 2**31 - 1)


def _entero(valores, escala):
    """Escala y redondea a int64, o revienta si algo no es finito."""
    arr = np.asarray(valores, dtype=np.float64 if escala != 1 else None)
    if escala != 1:
        arr = np.round(arr * escala)
    if arr.dtype.kind == "f":
        if not np.isfinite(arr).all():
            raise ValueError("columna con valores no finitos")
        arr = np.round(arr)
    return arr.astype(np.int64)


def _tipo(arr, escala):
    """El tipo entero mas chico que guarda la columna. Lo escalado va siempre en
    i32 (puede ser negativo: devoluciones, diferenciales)."""
    lo, hi = (int(arr.min()), int(arr.max())) if arr.size else (0, 0)
    candidatos = [_I32] if escala != 1 or lo < 0 else _TIPOS
    for nombre, dtype, mn, mx in candidatos:
        if mn <= lo and hi <= mx:
            return nombre, dtype
    raise ValueError(f"columna fuera de rango para {candidatos[-1][0]}: {lo}..{hi}")


def empaquetar(meta, columnas):
    """meta: dict JSON. columnas: {nombre: valores | (valores, escala)}.
    Devuelve los bytes gzip listos para cifrar."""
    piezas, desc, largo = [], [], None
    for nombre, spec in columnas.items():
        valores, escala = spec if isinstance(spec, tuple) else (spec, 1)
        arr = _entero(valores, escala)
        if largo is None:
            largo = arr.size
        elif arr.size != largo:
            raise ValueError(f"la columna {nombre} tiene {arr.size} filas y no {largo}")
        tipo, dtype = _tipo(arr, escala)
        piezas.append(arr.astype(dtype).astype(np.dtype(dtype).newbyteorder("<")).tobytes())
        desc.append({"n": nombre, "t": tipo, "s": escala, "l": int(arr.size)})

    # los offsets dependen del largo del meta, que depende de los offsets: se
    # reservan 12 bytes por offset y, si no alcanza, se vuelve a intentar
    meta = dict(meta, cols=desc, filas=largo or 0)
    for _ in range(5):
        cab = json.dumps(dict(meta, cols=[dict(d, o=0) for d in desc]),
                         ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        inicio = _alinear(8 + len(cab) + 12 * len(desc))
        offs, pos = [], inicio
        for p in piezas:
            offs.append(pos)
            pos = _alinear(pos + len(p))
        cab = json.dumps(dict(meta, cols=[dict(d, o=o) for d, o in zip(desc, offs)]),
                         ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        if 8 + len(cab) <= inicio:
            break
    else:
        raise RuntimeError("no se pudo fijar la cabecera del paquete")

    buf = bytearray(inicio if not piezas else offs[-1] + len(piezas[-1]))
    buf[0:4] = MAGIA
    buf[4:8] = struct.pack("<I", len(cab))
    buf[8:8 + len(cab)] = cab
    for o, p in zip(offs, piezas):
        buf[o:o + len(p)] = p
    return gzip.compress(bytes(buf), compresslevel=9, mtime=0)


def _alinear(n):
    return (n + 3) & ~3


def abrir(datos):
    """Inverso de empaquetar (lo usan las pruebas y tools/verificar.py)."""
    buf = gzip.decompress(datos)
    if buf[:4] != MAGIA:
        raise ValueError("no es un paquete GIP2")
    (largo,) = struct.unpack("<I", buf[4:8])
    meta = json.loads(buf[8:8 + largo].decode("utf-8"))
    dt = {"u8": "<u1", "u16": "<u2", "u32": "<u4", "i32": "<i4"}
    cols = {c["n"]: np.frombuffer(buf, dtype=dt[c["t"]], count=c["l"], offset=c["o"])
            for c in meta["cols"]}
    return meta, cols
