#!/usr/bin/env python3
"""Metricas de corte de IP: mantiene history.json (una entrada por corte) y arma
el resumen ejecutivo de respaldo, el que se ve cuando el corte no trae Word.
Metodologia de riesgo: ventana reciente = ultimos 2 meses.
Los informes completos en HTML (ejecutivo y riesgo) se retiraron en la v4:
nadie los mostraba desde agosto; el informe real es el Word de Drive."""
import os, json, calendar, html
import pandas as pd

# Los primeros informes se hicieron a mano, ANTES de que existiera el sistema, y
# por eso no estan en history.json. El numero de corte que sale en los informes
# es len(history.json) + CORTE_OFFSET.
#   history.json:  2026-06-30 -> Corte 4   ·   2026-07-15 -> Corte 5
#   proximo corte (2026-07-30)             ->  Corte 6
# La numeracion es la de los archivos de Drive: 4toCorte (junio, cierre de
# semestre), 5toCorte (15-jul), 6toCorte (30-jul).
# Si algun dia se recuperan los cortes historicos y se cargan en history.json,
# hay que bajar este offset en la misma cantidad. Se puede pisar con la variable
# de entorno CORTE_OFFSET sin tocar el codigo.
#
# Desde el corte 10 cada entrada guarda su propio numero ("corte"): la serie
# puede saltarse numeros (el 10 junto las dos quincenas de septiembre y no hubo
# 9), y contar por posicion lo habria llamado 9. El offset solo numera las
# entradas viejas que no traen el campo. Un corte nuevo es el siguiente al
# anterior, salvo que la variable de entorno CORTE diga otro.
CORTE_OFFSET = int(os.environ.get("CORTE_OFFSET", "3"))

def _corte_n(i, h):
    """Numero de corte de la entrada i de history.json."""
    return h.get("corte", i + 1 + CORTE_OFFSET)

M = lambda x: f"${x:,.0f}"
MES={1:"Enero",2:"Febrero",3:"Marzo",4:"Abril",5:"Mayo",6:"Junio",7:"Julio",8:"Agosto",9:"Septiembre",10:"Octubre",11:"Noviembre",12:"Diciembre"}

def metrics(df, history_path, version):
    df = df.copy()
    df["FECHADOC"] = pd.to_datetime(df["FECHADOC"], errors="coerce")
    months = sorted(df["MES"].unique().tolist())
    L = months[-1]; recent2=set(months[-2:]); prior_all=set(months[:-2])
    dmin=df["FECHADOC"].min(); dmax=df["FECHADOC"].max()
    total=df["SUMANETO"].sum(); nreg=len(df)
    monthly=df.groupby("MES").agg(neto=("SUMANETO","sum"),fac=("DOCUMENTO","nunique"),cli=("NOMBRECLI","nunique"))
    best_m=monthly["neto"].idxmax(); best_v=monthly["neto"].max()
    # mes parcial / ritmo
    lastrows=df[df["MES"]==L]; day_max=int(lastrows["FECHADOC"].dt.day.max())
    yy,mm=int(L.split("-")[0]),int(L.split("-")[1]); dim=calendar.monthrange(yy,mm)[1]
    daily=lastrows["SUMANETO"].sum()/day_max if day_max else 0
    proj_last=daily*dim; partial=day_max<dim-2
    prev_m=months[-2] if len(months)>1 else None
    prev_daily=(monthly.loc[prev_m,"neto"]/calendar.monthrange(int(prev_m.split('-')[0]),int(prev_m.split('-')[1]))[1]) if prev_m else 0
    # grupos
    gr=df.groupby("GRUPO")["SUMANETO"].sum().sort_values(ascending=False)
    # productos
    prod=df.groupby("PRODUCTO").agg(neto=("SUMANETO","sum"),uni=("CANTIDAD","sum"))
    grp_of=df.groupby("PRODUCTO")["GRUPO"].agg(lambda s:s.value_counts().index[0])
    top_prod=prod.sort_values("neto",ascending=False).head(10)
    # marcas + lideres
    marca_tot=df.groupby("MARCA")["SUMANETO"].sum().sort_values(ascending=False)
    mv=df.groupby(["MARCA","VENDEDOR"])["SUMANETO"].sum().reset_index().sort_values("SUMANETO",ascending=False).drop_duplicates("MARCA").set_index("MARCA")
    msku=df.groupby(["MARCA","VENDEDOR"])["PRODUCTO"].nunique().reset_index().sort_values("PRODUCTO",ascending=False).drop_duplicates("MARCA").set_index("MARCA")
    mgrp=df.groupby("MARCA")["GRUPO"].agg(lambda s:s.value_counts().index[0])
    # vendedores
    vend=df.groupby("VENDEDOR").agg(neto=("SUMANETO","sum"),fac=("DOCUMENTO","nunique"),cli=("NOMBRECLI","nunique"),sku=("PRODUCTO","nunique"))
    vend["ticket"]=vend["neto"]/vend["fac"]; vend=vend.sort_values("neto",ascending=False)
    nvend=vend.shape[0]
    # ritmo mes por vendedor (ultimo vs anterior)
    vm=df.groupby(["VENDEDOR","MES"])["SUMANETO"].sum().unstack(fill_value=0)
    # clientes
    cli_tot=df.groupby("NOMBRECLI")["SUMANETO"].sum().sort_values(ascending=False)
    cli_fac=df.groupby("NOMBRECLI")["DOCUMENTO"].nunique()
    ncli=cli_tot.shape[0]; top10=cli_tot.head(10).sum()/total*100
    # sectores
    sec=df.groupby("SECTOR")["SUMANETO"].sum().sort_values(ascending=False)
    # riesgo / recuperados
    cli_months=df.groupby("NOMBRECLI")["MES"].apply(set)
    last_pur=df.groupby("NOMBRECLI")["FECHADOC"].max()
    dom_v=df.groupby(["NOMBRECLI","VENDEDOR"])["SUMANETO"].sum().reset_index().sort_values("SUMANETO",ascending=False).drop_duplicates("NOMBRECLI").set_index("NOMBRECLI")["VENDEDOR"]
    dom_s=df.groupby(["NOMBRECLI","SECTOR"])["SUMANETO"].sum().reset_index().sort_values("SUMANETO",ascending=False).drop_duplicates("NOMBRECLI").set_index("NOMBRECLI")["SECTOR"]
    risk=[c for c in cli_tot.index if (cli_months[c]&prior_all) and not(cli_months[c]&recent2)]
    risk_val=float(cli_tot[risk].sum()) if risk else 0.0
    rv={};rs={}
    for c in risk:
        v=dom_v.get(c,"-"); rv.setdefault(v,[0,0.0]); rv[v][0]+=1; rv[v][1]+=cli_tot[c]
        s=dom_s.get(c,"-"); rs.setdefault(s,[0,0.0]); rs[s][0]+=1; rs[s][1]+=cli_tot[c]
    risk20=sorted(risk,key=lambda c:-cli_tot[c])[:20]
    prior2=set(months[-3:-1]); before=set(months[:-3])
    recov=[c for c in cli_tot.index if (L in cli_months[c]) and not(cli_months[c]&prior2) and (cli_months[c]&before)]
    lastval=df[df["MES"]==L].groupby("NOMBRECLI")["SUMANETO"].sum()
    recov_val=float(lastval[recov].sum()) if recov else 0.0
    rbv={}
    for c in recov:
        v=dom_v.get(c,"-"); rbv.setdefault(v,[0,0.0]); rbv[v][0]+=1; rbv[v][1]+=lastval.get(c,0)
    recov_top=sorted(recov,key=lambda c:-lastval.get(c,0))[:10]
    # historia de cortes
    hist=[]
    if os.path.exists(history_path):
        try: hist=json.load(open(history_path,encoding="utf-8"))
        except Exception: hist=[]
    snap={"version":version,"dateMax":dmax.strftime("%Y-%m-%d"),"total":round(float(total),2),
          "best_month":best_m,"best_val":round(float(best_v),2),"clientes":int(ncli),
          "riesgo":len(risk),"recuperados":len(recov),"top10_share":round(float(top10),1),
          "ticket":round(float(total/monthly['fac'].sum()),2) if monthly['fac'].sum() else 0}
    # Un corte = una fecha de datos (dateMax). Si se regenera el MISMO corte con
    # otra version (pruebas ~fav/~dl2, IDs de Drive distintos), se reemplaza la
    # entrada en vez de acumular duplicados que ensucian las comparaciones.
    forced = os.environ.get("CORTE")
    if hist and hist[-1].get("dateMax")==snap["dateMax"]:
        snap["corte"] = int(forced or _corte_n(len(hist)-1, hist[-1]))
        dirty = hist[-1]!=snap
        hist[-1]=snap
    else:
        snap["corte"] = int(forced or (_corte_n(len(hist)-1, hist[-1])+1 if hist else 1+CORTE_OFFSET))
        hist.append(snap)
        dirty = True
    if dirty:
        try: json.dump(hist,open(history_path,"w",encoding="utf-8"),ensure_ascii=False,indent=1)
        except Exception: pass
    return dict(df=df,months=months,L=L,mm=mm,yy=yy,dim=dim,day_max=day_max,daily=daily,proj_last=proj_last,
        partial=partial,prev_m=prev_m,prev_daily=prev_daily,dmin=dmin,dmax=dmax,total=total,nreg=nreg,
        monthly=monthly,best_m=best_m,best_v=best_v,gr=gr,top_prod=top_prod,grp_of=grp_of,
        marca_tot=marca_tot,mv=mv,msku=msku,mgrp=mgrp,vend=vend,nvend=nvend,vm=vm,
        cli_tot=cli_tot,cli_fac=cli_fac,ncli=ncli,top10=top10,sec=sec,
        risk=risk,risk_val=risk_val,rv=rv,rs=rs,risk20=risk20,last_pur=last_pur,dom_v=dom_v,dom_s=dom_s,
        recov=recov,recov_val=recov_val,rbv=rbv,recov_top=recov_top,lastval=lastval,cli_months=cli_months,
        hist=hist,corte=snap["corte"],snap=snap)


def _resumen(title, kpis, paragraph):
    kh = "".join(f'<div><span>{html.escape(k)}</span><b>{html.escape(v)}</b></div>' for k, v in kpis)
    return f'<p><b>{title}</b></p><div class="kpis-doc">{kh}</div>{paragraph}'


def build(df, history_path, version):
    m = metrics(df, history_path, version)
    total = m["total"]; gr = m["gr"]; vend = m["vend"]
    resumen = _resumen("Panorama de ventas (sin AMÉRICO ni REVIPLAS)",
        [("Ingresos acumulados", M(total)), ("Mejor mes", f'{MES[int(m["best_m"].split("-")[1])]}, {M(m["best_v"])}'),
         ("Clientes únicos", f'{m["ncli"]:,}'), ("Vendedores", str(m["nvend"]))],
        f'<p>Se acumulan <b>{M(total)}</b>. El motor son {html.escape(str(gr.index[0]))} y {html.escape(str(gr.index[1]))} '
        f'({(gr.iloc[0]+gr.iloc[1])/total*100:.0f} %). Líder de ventas: <b>{html.escape(str(vend.index[0]))}</b> ({M(vend.iloc[0]["neto"])}). '
        f'Hay {len(m["risk"])} clientes en riesgo y {len(m["recov"])} recuperados este período.</p>')
    return {"exec": resumen, "snapshot": m["snap"], "corte": m["corte"]}
