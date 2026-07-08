#!/usr/bin/env python3
"""Genera los dos informes (Ejecutivo y Clientes Riesgo/Recuperados) como
fragmentos HTML legibles, con metodologia de ventana reciente = ultimos 2 meses.
Mantiene history.json (cortes) para comparaciones entre informes."""
import os, json
import pandas as pd

M = lambda x: f"${x:,.0f}"
def tbl(headers, rows, nums=None):
    nums = nums or set()
    h = "".join(f'<th class="{ "num" if i in nums else "" }">{c}</th>' for i,c in enumerate(headers))
    body = ""
    for r in rows:
        body += "<tr>" + "".join(f'<td class="{ "num" if i in nums else "" }">{c}</td>' for i,c in enumerate(r)) + "</tr>"
    return f'<table class="rt"><thead><tr>{h}</tr></thead><tbody>{body}</tbody></table>'

def build(df, history_path, version):
    df = df.copy()
    df["FECHADOC"] = pd.to_datetime(df["FECHADOC"], errors="coerce")
    months = sorted(df["MES"].unique().tolist())
    L = months[-1]
    recent2 = set(months[-2:])
    prior_all = set(months[:-2])
    date_min = df["FECHADOC"].min(); date_max = df["FECHADOC"].max()
    d_min = date_min.strftime("%d/%m/%Y"); d_max = date_max.strftime("%d/%m/%Y")
    meses_es = {1:"enero",2:"febrero",3:"marzo",4:"abril",5:"mayo",6:"junio",7:"julio",8:"agosto",9:"septiembre",10:"octubre",11:"noviembre",12:"diciembre"}
    total = df["SUMANETO"].sum()

    monthly = df.groupby("MES")["SUMANETO"].sum()
    best_m = monthly.idxmax(); best_v = monthly.max()
    last_v = monthly.iloc[-1]
    # ritmo del ultimo mes (parcial)
    last_rows = df[df["MES"] == L]
    day_max = int(last_rows["FECHADOC"].dt.day.max())
    yy, mm = int(L.split("-")[0]), int(L.split("-")[1])
    import calendar
    dim = calendar.monthrange(yy, mm)[1]
    daily = last_v / day_max if day_max else 0
    proj_last = daily * dim
    partial = day_max < dim - 2

    # grupos
    gr = df.groupby("GRUPO")["SUMANETO"].sum().sort_values(ascending=False)
    gr_rows = [[g, M(v), f"{v/total*100:.1f}%"] for g,v in gr.items()]
    top2_share = gr.head(2).sum()/total*100

    # top 10 productos
    pr = df.groupby("PRODUCTO").agg(neto=("SUMANETO","sum"), uni=("CANTIDAD","sum")).sort_values("neto",ascending=False).head(10)
    pr_rows = [[p, M(r.neto), f"{r.uni:,.0f}"] for p,r in pr.iterrows()]

    # lideres por marca (top 10 marcas -> vendedor top)
    marca_tot = df.groupby("MARCA")["SUMANETO"].sum().sort_values(ascending=False).head(10)
    mv = df.groupby(["MARCA","VENDEDOR"])["SUMANETO"].sum().reset_index().sort_values("SUMANETO",ascending=False).drop_duplicates("MARCA").set_index("MARCA")
    marca_rows = [[m, M(v), mv.loc[m,"VENDEDOR"] if m in mv.index else "-", M(mv.loc[m,"SUMANETO"]) if m in mv.index else "-"] for m,v in marca_tot.items()]

    # vendedores por diversidad SKU
    div = df.groupby("VENDEDOR")["PRODUCTO"].nunique().sort_values(ascending=False)
    div_rows = [[v, f"{n:,}"] for v,n in div.head(10).items()]

    # clientes
    cli_tot = df.groupby("NOMBRECLI")["SUMANETO"].sum().sort_values(ascending=False)
    n_cli = cli_tot.shape[0]
    top10_share = cli_tot.head(10).sum()/total*100
    cli15_rows = [[c, M(v), f"{v/total*100:.1f}%"] for c,v in cli_tot.head(15).items()]

    # vendedores ranking
    vend = df.groupby("VENDEDOR").agg(neto=("SUMANETO","sum"), fac=("DOCUMENTO","nunique"), cli=("NOMBRECLI","nunique"), sku=("PRODUCTO","nunique"))
    vend["ticket"] = vend["neto"]/vend["fac"]
    vend = vend.sort_values("neto",ascending=False)
    vend_rows = [[v, M(r.neto), f"{r.fac:,}", f"{r.cli:,}", M(r.ticket), f"{r.sku:,}"] for v,r in vend.iterrows()]
    n_vend = vend.shape[0]

    # sectores
    sec = df.groupby("SECTOR")["SUMANETO"].sum().sort_values(ascending=False).head(12)
    sec_rows = [[s, M(v), f"{v/total*100:.1f}%"] for s,v in sec.items()]

    # ---- RIESGO Y RECUPERADOS ----
    cli_months = df.groupby("NOMBRECLI")["MES"].apply(set)
    last_purchase = df.groupby("NOMBRECLI")["FECHADOC"].max()
    dom_vend = df.groupby(["NOMBRECLI","VENDEDOR"])["SUMANETO"].sum().reset_index().sort_values("SUMANETO",ascending=False).drop_duplicates("NOMBRECLI").set_index("NOMBRECLI")["VENDEDOR"]
    dom_sec = df.groupby(["NOMBRECLI","SECTOR"])["SUMANETO"].sum().reset_index().sort_values("SUMANETO",ascending=False).drop_duplicates("NOMBRECLI").set_index("NOMBRECLI")["SECTOR"]

    risk = [c for c in cli_tot.index if (cli_months[c] & prior_all) and not (cli_months[c] & recent2)]
    risk_val = cli_tot[risk].sum() if risk else 0
    # riesgo por vendedor / sector
    rv = {}; rs = {}
    for c in risk:
        rv.setdefault(dom_vend.get(c,"-"), [0,0]); rv[dom_vend.get(c,"-")][0]+=1; rv[dom_vend.get(c,"-")][1]+=cli_tot[c]
        rs.setdefault(dom_sec.get(c,"-"), [0,0]); rs[dom_sec.get(c,"-")][0]+=1; rs[dom_sec.get(c,"-")][1]+=cli_tot[c]
    rv_rows = [[k, f"{v[0]}", M(v[1])] for k,v in sorted(rv.items(), key=lambda x:-x[1][1])]
    rs_rows = [[k, f"{v[0]}", M(v[1])] for k,v in sorted(rs.items(), key=lambda x:-x[1][1])[:10]]
    risk_sorted = sorted(risk, key=lambda c:-cli_tot[c])[:20]
    risk20_rows = [[c, dom_vend.get(c,"-"), str(dom_sec.get(c,"-"))[:24], last_purchase[c].strftime("%d/%m/%Y"), M(cli_tot[c])] for c in risk_sorted]

    # recuperados: activos en L, dormidos en los 2 meses previos a L, con historial anterior
    prior2 = set(months[-3:-1]); before = set(months[:-3])
    recov = [c for c in cli_tot.index if (L in cli_months[c]) and not (cli_months[c] & prior2) and (cli_months[c] & before)]
    last_month_val = df[df["MES"]==L].groupby("NOMBRECLI")["SUMANETO"].sum()
    recov_val = last_month_val[recov].sum() if recov else 0
    rec_by_v = {}
    for c in recov:
        v = dom_vend.get(c,"-"); rec_by_v.setdefault(v,[0,0]); rec_by_v[v][0]+=1; rec_by_v[v][1]+=last_month_val.get(c,0)
    recv_rows = [[k, f"{v[0]}", M(v[1])] for k,v in sorted(rec_by_v.items(), key=lambda x:-x[1][0])]
    recov_top = sorted(recov, key=lambda c:-last_month_val.get(c,0))[:15]
    rect_rows = [[c, dom_vend.get(c,"-"), M(last_month_val.get(c,0))] for c in recov_top]

    # ---- historico de cortes ----
    hist = []
    if os.path.exists(history_path):
        try: hist = json.load(open(history_path, encoding="utf-8"))
        except Exception: hist = []
    prev = hist[-1] if hist and hist[-1].get("version") != version else (hist[-2] if len(hist)>1 else None)
    snap = {"version": version, "dateMax": date_max.strftime("%Y-%m-%d"), "total": round(float(total),2),
            "best_month": best_m, "best_val": round(float(best_v),2), "clientes": int(n_cli),
            "riesgo": len(risk), "recuperados": len(recov), "top10_share": round(float(top10_share),1)}
    if not hist or hist[-1].get("version") != version:
        hist.append(snap)
        try: json.dump(hist, open(history_path,"w",encoding="utf-8"), ensure_ascii=False, indent=1)
        except Exception: pass
    corte_n = len(hist)

    growth_txt = ""
    if prev:
        dv = total - prev["total"]; dp = dv/prev["total"]*100 if prev["total"] else 0
        growth_txt = (f'<p>Respecto al corte anterior (datos al {prev["dateMax"]}), los ingresos acumulados '
                      f'{"crecieron" if dv>=0 else "bajaron"} <b>{M(abs(dv))}</b> ({dp:+.1f}%). '
                      f'La base de clientes pasó de {prev["clientes"]:,} a {n_cli:,}.</p>')

    # ================= INFORME EJECUTIVO =================
    partial_txt = (f'<b>{meses_es[mm].capitalize()}</b> está en curso ({day_max} días con {M(last_v)}, ritmo de '
                   f'{M(daily)}/día). Proyectado a mes completo serían ~{M(proj_last)}.') if partial else \
                  f'El último mes cerrado (<b>{meses_es[mm]}</b>) registró {M(last_v)}.'
    exec_html = f"""
<div class="rep">
  <div class="rephead"><div><div class="repkick">INFORME EJECUTIVO · CORTE {corte_n}</div>
    <h2>Panorama de Ventas — Distribuidora y Suministros IP</h2>
    <div class="repsub">Información del {d_min} al {d_max} · Autor: Ing. Roberts Flores</div></div>
    <button class="pdfbtn" onclick="printReport('[data-panel=exec]','Informe Ejecutivo IP')">⭳ Descargar PDF</button></div>

  <div class="repkpis">
    <div class="rk"><span>Ingresos acumulados</span><b>{M(total)}</b></div>
    <div class="rk"><span>Mejor mes</span><b>{meses_es[int(best_m.split('-')[1])].capitalize()} · {M(best_v)}</b></div>
    <div class="rk"><span>Clientes únicos</span><b>{n_cli:,}</b></div>
    <div class="rk"><span>Vendedores activos</span><b>{n_vend}</b></div>
  </div>

  <h3>1. Resumen ejecutivo</h3>
  <p>Este es el corte {corte_n} de la serie. Se acumulan <b>{M(total)}</b> en ingresos entre el {d_min} y el {d_max}.
  {partial_txt} El motor del negocio son los grupos <b>{gr.index[0]}</b> y <b>{gr.index[1]}</b>, que juntos concentran el {top2_share:.0f}% de los ingresos.</p>
  {growth_txt}

  <h3>2. Evolución mensual</h3>
  {tbl(["Mes","Venta neta","% del total"], [[f"{meses_es[int(m.split('-')[1])].capitalize()} {m.split('-')[0]}", M(v), f"{v/total*100:.1f}%"] for m,v in monthly.items()], {1,2})}

  <h3>3. Grupos de productos</h3>
  {tbl(["Grupo","Venta neta","% del total"], gr_rows, {1,2})}

  <h3>4. Top 10 productos (SKU) por ingresos</h3>
  {tbl(["Producto","Venta neta","Unidades"], pr_rows, {1,2})}

  <h3>5. Líderes por marca (top 10)</h3>
  {tbl(["Marca","Venta marca","Vendedor líder","Venta del líder"], marca_rows, {1,3})}

  <h3>6. Vendedores por diversidad de SKU</h3>
  {tbl(["Vendedor","SKU distintos"], div_rows, {1})}

  <h3>7. Análisis de clientes</h3>
  <p>La base es de <b>{n_cli:,} clientes únicos</b>. El Top 10 concentra el <b>{top10_share:.1f}%</b> de los ingresos
  {"— concentración saludable, el crecimiento se apoya en una base amplia." if top10_share<45 else "— dependencia relevante de los grandes compradores, conviene diversificar."}</p>
  {tbl(["Cliente","Venta neta","% del total"], cli15_rows, {1,2})}

  <h3>8. Ranking de vendedores</h3>
  {tbl(["Vendedor","Venta neta","Facturas","Clientes","Ticket","SKU"], vend_rows, {1,2,3,4,5})}

  <h3>9. Análisis geográfico — Top 12 sectores</h3>
  {tbl(["Sector","Venta neta","% del total"], sec_rows, {1,2})}

  <h3>10. Alertas y recomendaciones</h3>
  <ul>
    <li>Universo de <b>{len(risk)} clientes en riesgo</b> ({M(risk_val)} históricos): activar campaña de reactivación (ver informe de clientes).</li>
    <li>Blindar a los 2 vendedores líderes ({vend.index[0]} y {vend.index[1]}), que suman {(vend['neto'].head(2).sum()/total*100):.0f}% del negocio: incentivos y retención.</li>
    <li>Programa formal de venta cruzada sobre el Top 10 de clientes; auditar el catálogo de baja rotación (hay {df['PRODUCTO'].nunique():,} SKU activos).</li>
    <li>Proyección de cierre de {meses_es[mm]}: ~{M(proj_last)} {"(mes en curso)" if partial else ""}.</li>
  </ul>
</div>"""

    # ================= INFORME CLIENTES RIESGO/RECUPERADOS =================
    risk_html = f"""
<div class="rep">
  <div class="rephead"><div><div class="repkick">SEGUIMIENTO DE CARTERA · CORTE {corte_n}</div>
    <h2>Clientes Recuperados y en Riesgo</h2>
    <div class="repsub">Ventana reciente = últimos 2 meses ({", ".join(sorted(recent2))}) · datos al {d_max}</div></div>
    <button class="pdfbtn" onclick="printReport('[data-panel=risk]','Clientes Riesgo y Recuperados IP')">⭳ Descargar PDF</button></div>

  <div class="repkpis">
    <div class="rk"><span>Clientes en riesgo</span><b>{len(risk)}</b></div>
    <div class="rk"><span>Valor histórico en riesgo</span><b>{M(risk_val)}</b></div>
    <div class="rk"><span>Recuperados (últ. mes)</span><b>{len(recov)}</b></div>
    <div class="rk"><span>Valor recuperado</span><b>{M(recov_val)}</b></div>
  </div>

  <h3>1. Universo de riesgo — {len(risk)} clientes</h3>
  <p>Clientes que compraron en algún momento previo pero <b>NO han comprado en los últimos 2 meses</b>
  ({", ".join(sorted(recent2))}). Representan <b>{M(risk_val)}</b> en ingresos históricos y son el grupo prioritario de reactivación.</p>

  <h3>1.1 Clientes en riesgo por vendedor</h3>
  {tbl(["Vendedor","Clientes en riesgo","Valor histórico"], rv_rows, {1,2})}

  <h3>1.2 Clientes en riesgo por sector (top 10)</h3>
  {tbl(["Sector","Clientes en riesgo","Valor histórico"], rs_rows, {1,2})}

  <h3>2. Top 20 clientes en riesgo — prioridad máxima</h3>
  <p>Los 20 clientes en riesgo de mayor valor histórico. Recuperarlos tiene el mayor impacto económico.</p>
  {tbl(["Cliente","Vendedor","Zona/Sector","Última compra","Valor histórico"], risk20_rows, {4})}

  <h3>3. Clientes recuperados en el último mes — casos de éxito</h3>
  <p>{len(recov)} clientes que estaban dormidos volvieron a comprar en <b>{meses_es[mm]}</b>, aportando <b>{M(recov_val)}</b>.</p>

  <h3>3.1 Recuperaciones por vendedor</h3>
  {tbl(["Vendedor","Recuperados","Valor recuperado"], recv_rows, {1,2})}

  <h3>3.2 Top recuperaciones individuales</h3>
  {tbl(["Cliente","Vendedor","Valor en el mes"], rect_rows, {2})}

  <h3>4. Plan de acción de reactivación</h3>
  <ul>
    <li>Asignar la lista de {len(risk)} clientes en riesgo a cada vendedor según su cartera y fijar meta mensual (ej. reactivar 5 clientes/mes).</li>
    <li>Priorizar el Top 20 por valor histórico ({M(sum(cli_tot[c] for c in risk_sorted))} concentrados).</li>
    <li>Alerta preventiva: si un cliente activo no compra en 30 días, notificar a su vendedor.</li>
    <li>Reconocer a los vendedores que más recuperan para reforzar la cultura de reactivación.</li>
  </ul>
  <p class="repnote">Potencial económico: recuperar el Top 20 en riesgo equivale a <b>{M(sum(cli_tot[c] for c in risk_sorted))}</b> en valor histórico reactivable.</p>
</div>"""

    return {"exec": exec_html, "risk": risk_html, "snapshot": snap, "corte": corte_n}
