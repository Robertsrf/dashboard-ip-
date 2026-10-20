import unittest

from grupo import reunion


class Reunion(unittest.TestCase):
    def test_ip_sin_informe_ejecutivo_ni_cobertura_ni_enlaces(self):
        meta = {"empresa": "ip", "dims": {"vend": ["A"]}, "dateMax": "2026-09-30",
                "exec": "<p>total $7M</p>", "execDocx": "UEsDB", "history": [{"total": 1}],
                "driveLinks": {"exec": "x"}, "listDocx": "UEsDB",
                "riskList": {"order": []}, "Pcob": {"rows": [], "cobertura": [{"monto": 1}]},
                "changelog": {"entradas": []}}
        m, c = reunion.limpiar("ip", meta, {"neto": [1], "vend": [0]})
        self.assertEqual(m["modo"], "reunion")
        for k in ("exec", "execDocx", "history", "driveLinks", "listDocx"):
            self.assertNotIn(k, m)
        self.assertEqual(m["Pcob"]["cobertura"], [])
        self.assertIn("riskList", m)
        self.assertEqual(set(c), {"neto", "vend"})

    def test_caleb_sin_costos_ni_margenes(self):
        cols = {k: [0] for k in ("dia", "vend", "neto", "costo", "vm", "cst", "p0", "sc", "precio")}
        m, c = reunion.limpiar("caleb", {"empresa": "caleb", "history": []}, cols)
        self.assertEqual(set(c), {"dia", "vend", "neto"})
        self.assertNotIn("history", m)

    def test_clave_desconocida_no_pasa(self):
        m, _ = reunion.limpiar("ip", {"empresa": "ip", "algo_nuevo": 1}, {})
        self.assertNotIn("algo_nuevo", m)

    def test_empresa_sin_reglas_revienta(self):
        with self.assertRaises(KeyError):
            reunion.limpiar("reviplas", {}, {})


if __name__ == "__main__":
    unittest.main()
