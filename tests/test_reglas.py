import unittest

import pandas as pd

from grupo import reglas


def df(filas):
    return pd.DataFrame(filas, columns=["VENDEDOR", "FECHADOC"]).assign(
        FECHADOC=lambda d: pd.to_datetime(d["FECHADOC"]))


class Relevos(unittest.TestCase):
    def test_leonardo_pasa_a_hector_desde_la_primera_aparicion_de_hector(self):
        d = reglas.vendedores(df([("Leonardo", "2026-04-01"), ("Hector", "2026-05-18"),
                                  ("Leonardo", "2026-09-10")]))
        self.assertEqual(d["VENDEDOR"].tolist(), ["Leonardo", "Héctor", "Héctor"])

    def test_edixon_pasa_a_jorge_desde_la_fecha_conocida_aunque_jorge_no_salga(self):
        d = reglas.vendedores(df([("Edixon", "2026-09-23"), ("Edixon", "2026-09-24"),
                                  ("Edixon", "2026-10-02")]))
        self.assertEqual(d["VENDEDOR"].tolist(), ["Edixon", "Jorge", "Jorge"])

    def test_si_jorge_aparece_antes_manda_la_fecha_de_los_datos(self):
        d = reglas.vendedores(df([("Jorge", "2026-09-20"), ("Edixon", "2026-09-21")]))
        self.assertEqual(d["VENDEDOR"].tolist(), ["Jorge", "Jorge"])

    def test_alias_de_grafia(self):
        d = reglas.vendedores(df([("Jose", "2026-01-02"), ("Televenta3", "2026-06-02")]))
        self.assertEqual(d["VENDEDOR"].tolist(), ["José", "Televenta"])

    def test_no_toca_a_los_demas(self):
        d = reglas.vendedores(df([("David", "2026-09-30"), ("2", "2026-09-01")]))
        self.assertEqual(d["VENDEDOR"].tolist(), ["David", "2"])


if __name__ == "__main__":
    unittest.main()
