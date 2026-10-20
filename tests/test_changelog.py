import json
import os
import tempfile
import unittest

from grupo import changelog as CL


def escribir(ruta, texto, modo="w"):
    with open(ruta, modo) as f:
        f.write(texto)


def base():
    return {"entradas": [
        {"v": "1.1.0", "fecha": "2026-07-08", "tipo": "nuevo", "empresas": ["ip"], "titulo": "B"},
        {"v": "1.0.0", "fecha": "2026-07-07", "tipo": "version", "empresas": ["ip"], "titulo": "A"},
    ]}


class Changelog(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.ruta = os.path.join(self.dir, "changelog.json")
        os.makedirs(os.path.join(self.dir, "app"))
        self.codigo = os.path.join(self.dir, "app", "x.js")
        escribir(self.codigo, "a\n")
        escribir(self.ruta, json.dumps(base()))

    def leer(self):
        with open(self.ruta, encoding="utf-8") as f:
            return json.load(f)

    def test_valida_tipo_fecha_y_version(self):
        for malo in ({"tipo": "otro"}, {"fecha": "07/07/2026"}, {"v": "1.0"}):
            d = base()
            d["entradas"][0].update(malo)
            with self.assertRaises(ValueError):
                CL.validar(d)

    def test_nueva_sube_la_version_segun_el_tipo_y_sella(self):
        CL.nueva(self.ruta, self.dir, "mejora", "C", ["Detalle"], ["ip"], fecha="2026-07-09")
        CL.nueva(self.ruta, self.dir, "arreglo", "D", [], ["caleb"], fecha="2026-07-09")
        CL.nueva(self.ruta, self.dir, "version", "E", [], ["grupo"], fecha="2026-07-10")
        vs = [e["v"] for e in self.leer()["entradas"][:3]]
        self.assertEqual(vs, ["2.0.0", "1.2.1", "1.2.0"])
        self.assertEqual(self.leer()["entradas"][0]["huella"], CL.huella(self.dir))

    def test_verificar_exige_entrada_si_cambia_el_codigo(self):
        CL.nueva(self.ruta, self.dir, "mejora", "C", [], ["ip"], fecha="2026-07-09")
        CL.verificar(self.ruta, self.dir)                 # sin cambios: pasa
        escribir(self.codigo, "b\n")
        with self.assertRaises(CL.SinEntrada):
            CL.verificar(self.ruta, self.dir)
        CL.sellar(self.ruta, self.dir)                    # misma entrada, codigo nuevo
        CL.verificar(self.ruta, self.dir)

    def test_huella_ignora_finales_de_linea(self):
        h = CL.huella(self.dir)
        escribir(self.codigo, b"a\r\n", "wb")
        self.assertEqual(CL.huella(self.dir), h)

    def test_corte_se_agrega_una_vez_y_no_cambia_la_version(self):
        CL.corte(self.ruta, "ip", 11, "2026-10-15", ["90 000 líneas"], fecha="2026-10-19")
        CL.corte(self.ruta, "ip", 11, "2026-10-15", ["91 000 líneas"], fecha="2026-10-20")
        cortes = [e for e in self.leer()["entradas"] if e["tipo"] == "corte"]
        self.assertEqual(len(cortes), 1)
        self.assertEqual(cortes[0]["detalle"], ["91 000 líneas"])
        self.assertEqual(cortes[0]["fecha"], "2026-10-19")      # regenerar no lo mueve de fecha
        self.assertEqual(cortes[0]["v"], "1.1.0")

    def test_la_clave_del_corte_es_su_numero_no_la_fecha_de_datos(self):
        CL.corte(self.ruta, "ip", 10, "2026-09-30", ["a"], fecha="2026-10-02")
        CL.corte(self.ruta, "ip", 11, "2026-09-30", ["b"], fecha="2026-10-19")
        CL.corte(self.ruta, "ip", 11, "2026-10-15", ["c"], fecha="2026-10-21")
        cortes = {e["corte"]: e for e in self.leer()["entradas"] if e["tipo"] == "corte"}
        self.assertEqual(sorted(cortes), [10, 11])
        self.assertEqual(cortes[11]["datos_al"], "2026-10-15")
        self.assertIn("15-10-2026", cortes[11]["titulo"])

    def test_orden_por_fecha_descendente(self):
        CL.corte(self.ruta, "caleb", 1, "2026-07-06", [], fecha="2026-07-06")
        fechas = [e["fecha"] for e in self.leer()["entradas"]]
        self.assertEqual(fechas, sorted(fechas, reverse=True))


if __name__ == "__main__":
    unittest.main()
