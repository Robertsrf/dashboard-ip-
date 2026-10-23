import json
import os
import tempfile
import unittest

import numpy as np

from grupo import control as CTRL
from grupo import paquete as PAQ


def paquete(meses, mes, doc, neto):
    return PAQ.empaquetar({"dims": {"mes": meses}}, {"mes": np.array(mes), "doc": np.array(doc),
                                                     "neto": (np.array(neto), 100)})


class Huella(unittest.TestCase):
    def test_un_centavo_cambia_la_huella(self):
        self.assertEqual(CTRL.huella(123456), CTRL.huella(123456))
        self.assertNotEqual(CTRL.huella(123456), CTRL.huella(123457))
        self.assertRegex(CTRL.huella(1), r"^[0-9A-F]{4} [0-9A-F]{4}$")


class Pasado(unittest.TestCase):
    def test_mes_cerrado(self):
        self.assertTrue(CTRL._cerrado("2026-08", "2026-09-15"))
        self.assertFalse(CTRL._cerrado("2026-09", "2026-09-15"))
        self.assertTrue(CTRL._cerrado("2026-09", "2026-09-30"))
        self.assertTrue(CTRL._cerrado("2026-12", "2026-12-31"))

    def test_coteja_solo_los_meses_cerrados_del_corte_anterior(self):
        with tempfile.TemporaryDirectory() as tmp:
            ruta = os.path.join(tmp, "fotos.json")
            antes = paquete(["2026-08", "2026-09"], [0, 0, 1], [0, 1, 2], [10.0, 5.5, 3.0])
            self.assertIsNone(CTRL.pasado(antes, 10, "2026-09-15", ruta))
            # septiembre crece (iba a medias); agosto llega con una linea de mas
            ahora = paquete(["2026-08", "2026-09"], [0, 0, 0, 1, 1], [0, 1, 1, 2, 3], [10.0, 5.5, -1.25, 3.0, 9.0])
            r = CTRL.pasado(ahora, 11, "2026-09-30", ruta)
            self.assertEqual(r["contra"], 10)
            self.assertEqual([m["mes"] for m in r["meses"]], ["2026-08"])
            self.assertEqual(r["meses"][0], {"mes": "2026-08", "igual": False, "lineas": 1, "facturas": 0, "centavos": -125})
            with open(ruta, encoding="utf-8") as f:
                self.assertEqual(sorted(json.load(f)), ["10", "11"])


if __name__ == "__main__":
    unittest.main()
