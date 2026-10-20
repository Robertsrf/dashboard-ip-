import gzip
import unittest

import numpy as np

from grupo import paquete


class Paquete(unittest.TestCase):
    def setUp(self):
        self.meta = {"empresa": "ip", "dims": {"vend": ["Ana", "Héctor"]}}
        self.cols = {
            "vend": [0, 1, 1],
            "doc": [0, 70000, 3],               # pasa de 65 535: u32
            "neto": ([12.34, -5.5, 1e6], 100),  # centavos, con negativos: i32
            "cant": ([1.5, 2.0, 0.125], 1000),
        }

    def test_ida_y_vuelta_exacta(self):
        meta, cols = paquete.abrir(paquete.empaquetar(self.meta, self.cols))
        self.assertEqual(meta["empresa"], "ip")
        self.assertEqual(meta["dims"]["vend"], ["Ana", "Héctor"])
        self.assertEqual(cols["vend"].tolist(), [0, 1, 1])
        self.assertEqual(cols["doc"].tolist(), [0, 70000, 3])
        self.assertEqual(cols["neto"].tolist(), [1234, -550, 100000000])
        self.assertEqual(cols["cant"].tolist(), [1500, 2000, 125])

    def test_tipo_minimo_por_columna(self):
        meta, _ = paquete.abrir(paquete.empaquetar(self.meta, self.cols))
        tipos = {c["n"]: c["t"] for c in meta["cols"]}
        self.assertEqual(tipos, {"vend": "u8", "doc": "u32", "neto": "i32", "cant": "i32"})

    def test_columnas_alineadas_a_4_bytes(self):
        meta, _ = paquete.abrir(paquete.empaquetar(self.meta, self.cols))
        self.assertTrue(all(c["o"] % 4 == 0 for c in meta["cols"]))

    def test_es_gzip(self):
        self.assertEqual(paquete.empaquetar(self.meta, self.cols)[:2], b"\x1f\x8b")

    def test_largos_distintos_revientan(self):
        with self.assertRaises(ValueError):
            paquete.empaquetar(self.meta, {"a": [1, 2], "b": [1]})

    def test_fuera_de_rango_revienta(self):
        with self.assertRaises(ValueError):
            paquete.empaquetar(self.meta, {"neto": ([3e7], 100)})

    def test_acepta_numpy(self):
        _, cols = paquete.abrir(paquete.empaquetar({}, {"x": np.array([3, 4], dtype=np.int64)}))
        self.assertEqual(cols["x"].tolist(), [3, 4])

    def test_comprime_de_verdad(self):
        grande = {"vend": [i % 20 for i in range(100000)]}
        bruto = len(gzip.decompress(paquete.empaquetar({}, grande)))
        self.assertLess(len(paquete.empaquetar({}, grande)), bruto / 20)


if __name__ == "__main__":
    unittest.main()
