#!/usr/bin/env python3
"""Informes IP: resumen (visible en sitio) + informe COMPLETO (descargable Word,
generado en navegador tras login). Metodologia: ventana reciente = ultimos 2 meses.
Mantiene history.json (cortes) para comparaciones."""
import os, json, calendar
import pandas as pd

M = lambda x: f"${x:,.0f}"
def tbl(headers, rows, nums=None):
    nums = nums or set()
    h = "".join(f'<th class="{ "num" if i in nums else "" }">{c}</th>' for i,c in enumerate(headers))
    body = "".join("<tr>"+"".join(f'<td class="{ "num" if i in nums else "" }">{c}</td>' for i,c in enumerate(r))+"</tr>" for r in rows)
    return f'<table class="rt"><thead><tr>{h}</tr></thead><tbody>{body}</tbody></table>'
def box(title, text, kind="i"):
    return f'<div class="rbox rbox-{kind}"><b>{title}</b><br>{text}</div>'
def bullets(items):
    return "<ul>"+"".join(f"<li>{x}</li>" for x in items)+"</ul>"
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
    if not hist or hist[-1].get("version")!=version:
        hist.append(snap)
        try: json.dump(hist,open(history_path,"w",encoding="utf-8"),ensure_ascii=False,indent=1)
        except Exception: pass
    return dict(df=df,months=months,L=L,mm=mm,yy=yy,dim=dim,day_max=day_max,daily=daily,proj_last=proj_last,
        partial=partial,prev_m=prev_m,prev_daily=prev_daily,dmin=dmin,dmax=dmax,total=total,nreg=nreg,
        monthly=monthly,best_m=best_m,best_v=best_v,gr=gr,top_prod=top_prod,grp_of=grp_of,
        marca_tot=marca_tot,mv=mv,msku=msku,mgrp=mgrp,vend=vend,nvend=nvend,vm=vm,
        cli_tot=cli_tot,cli_fac=cli_fac,ncli=ncli,top10=top10,sec=sec,
        risk=risk,risk_val=risk_val,rv=rv,rs=rs,risk20=risk20,last_pur=last_pur,dom_v=dom_v,dom_s=dom_s,
        recov=recov,recov_val=recov_val,rbv=rbv,recov_top=recov_top,lastval=lastval,cli_months=cli_months,
        hist=hist,corte=len(hist),snap=snap)


def _perfil(r, tk_med):
    if r.ticket > tk_med*1.8: return "Alto ticket / mayorista"
    if r.cli > 120: return "Amplitud / venta cruzada"
    if r.neto < 15000: return "En desarrollo"
    return "Equilibrado"

def render_exec_full(m):
    mm=m["mm"]; total=m["total"]; gr=m["gr"]; vend=m["vend"]; monthly=m["monthly"]
    d_min=m["dmin"].strftime("%d/%m/%Y"); d_max=m["dmax"].strftime("%d/%m/%Y")
    corte=m["corte"]; hist=m["hist"]
    tk_med=float(vend["ticket"].median())
    grp_share=lambda i:gr.iloc[i]/total*100
    # cabecera
    parts=[]
    parts.append(f'''<div class="rep"><div class="rcover">
      <div class="rkick">INFORME EJECUTIVO DE INTELIGENCIA COMERCIAL</div>
      <h1>Corte {corte} — Seguimiento y Análisis</h1>
      <div class="rmeta">{d_min} — {d_max} · Elaborado por: <b>Ing. Roberts Flores</b><br>
      {m["nreg"]:,} registros · {int(monthly["fac"].sum()):,} facturas · {m["ncli"]:,} clientes · {m["nvend"]} vendedores activos<br>
      <span class="conf">CLASIFICACIÓN: CONFIDENCIAL — Uso Exclusivo Dirección</span></div></div>''')
    if m["partial"]:
        parts.append(box("⚠️ NOTA METODOLÓGICA — MES PARCIAL",
            f'Los datos de {MES[mm].lower()} abarcan solo del 01 al {m["day_max"]} ({m["day_max"]} días). Las cifras absolutas de {MES[mm].lower()} NO son comparables con meses completos; se analiza por RITMO DIARIO y PROYECCIÓN a mes completo.',"w"))
    # 1. resumen
    parts.append('<h2>1. Resumen ejecutivo</h2>')
    ritmo=(f'{MES[mm]} está en curso ({m["day_max"]} días con {M(monthly.loc[m["L"],"neto"])}, ritmo {M(m["daily"])}/día; proyección a mes completo ~{M(m["proj_last"])}).' if m["partial"]
           else f'El último mes cerrado ({MES[mm]}) registró {M(monthly.loc[m["L"],"neto"])}.')
    parts.append(f'<p>Este es el corte {corte} de la serie. Se acumulan <b>{M(total)}</b> en ingresos entre el {d_min} y el {d_max}. Con <b>{MES[int(m["best_m"].split("-")[1])]}</b> como mes más alto ({M(m["best_v"])}), la empresa mantiene una trayectoria sólida. {ritmo} El motor del negocio es el dúo <b>{gr.index[0]}</b> + <b>{gr.index[1]}</b> ({grp_share(0)+grp_share(1):.0f}% de los ingresos).</p>')
    # 1.1 cortes
    parts.append('<h3>1.1 Evolución entre cortes</h3>')
    if len(hist)>=2:
        hdr=["Indicador"]+[f"Corte {i+1}" for i in range(len(hist))]
        rows=[["Ingresos acumulados"]+[M(h["total"]) for h in hist],
              ["Clientes únicos"]+[f'{h["clientes"]:,}' for h in hist],
              ["Concentración Top 10"]+[f'{h["top10_share"]}%' for h in hist],
              ["Clientes en riesgo"]+[str(h["riesgo"]) for h in hist]]
        parts.append(tbl(hdr,rows,set(range(1,len(hist)+1))))
        dv=hist[-1]["total"]-hist[-2]["total"]; dp=dv/hist[-2]["total"]*100 if hist[-2]["total"] else 0
        parts.append(f'<p>El crecimiento entre el corte {len(hist)-1} y el {len(hist)} es de <b>{M(dv)} ({dp:+.1f}%)</b>.</p>')
    else:
        parts.append('<p><i>Primer corte de la serie: las comparaciones entre cortes se poblarán automáticamente a partir del próximo informe.</i></p>')
    # 1.3 hallazgos
    mom=monthly["neto"].pct_change()*100
    top_prod_name=m["top_prod"].index[0]
    parts.append('<h3>1.2 Hallazgos más importantes</h3>')
    parts.append(bullets([
        f'📊 <b>Motor dual:</b> {gr.index[0]} y {gr.index[1]} concentran el {grp_share(0)+grp_share(1):.0f}% de los ingresos.',
        f'👑 <b>Líder de ventas:</b> {vend.index[0]} encabeza con {M(vend.iloc[0]["neto"])} ({vend.iloc[0]["neto"]/total*100:.1f}% del total).',
        f'🏆 <b>Rey del catálogo:</b> {vend["sku"].idxmax()} maneja {int(vend["sku"].max()):,} SKU distintos — clave para venta cruzada.',
        f'🔄 <b>{len(m["recov"])} clientes recuperados</b> en {MES[mm].lower()} (dormidos que volvieron), aportando {M(m["recov_val"])}.',
        f'⚠️ <b>{len(m["risk"])} clientes en riesgo</b> ({M(m["risk_val"])} históricos) sin comprar en los últimos 2 meses.',
        f'⭐ <b>Producto estrella:</b> {top_prod_name[:40]} lidera con {M(m["top_prod"].iloc[0]["neto"])}.',
    ]))
    parts.append(box("🎯 SALUD COMERCIAL: VERDE CON VIGILANCIA",
        f'La empresa mantiene una base sólida con {M(total)} acumulados. Los focos de atención: el universo de {len(m["risk"])} clientes en riesgo y la dependencia de los dos vendedores líderes. {vend.index[0]} emerge como referente por volumen y amplitud de catálogo.',"g"))
    # 2. panorama financiero
    parts.append('<h2>2. Panorama financiero — ritmo y proyección</h2>')
    parts.append('<h3>2.1 Evolución mensual completa</h3>')
    mrows=[]
    for i,mo in enumerate(m["months"]):
        d=monthly.loc[mo]; delta="Base" if i==0 else f'{mom.iloc[i]:+.1f}%'
        mrows.append([f'{MES[int(mo.split("-")[1])]} {mo.split("-")[0]}',M(d["neto"]),f'{int(d["fac"]):,}',f'{int(d["cli"]):,}',delta])
    parts.append(tbl(["Mes","Ventas","Facturas","Clientes","Δ mes ant."],mrows,{1,2,3,4}))
    parts.append('<h3>2.2 Análisis del ritmo diario</h3>')
    if m["prev_m"]:
        pm=m["prev_m"]
        rrows=[[f'{MES[int(pm.split("-")[1])]} (completo)','31 aprox.',M(monthly.loc[pm,"neto"]),M(m["prev_daily"]),"Base"],
               [f'{MES[mm]} ({"parcial" if m["partial"] else "completo"})',f'{m["day_max"]}',M(monthly.loc[m["L"],"neto"]),M(m["daily"]),f'{(m["daily"]/m["prev_daily"]-1)*100:+.1f}%' if m["prev_daily"] else "-"]]
        parts.append(tbl(["Período","Días","Ventas","$/día","vs ant."],rrows,{2,3}))
    parts.append(box("📊 LECTURA DEL RITMO",
        f'El ritmo diario del último período es de {M(m["daily"])}/día. Proyectado a mes completo, {MES[mm].lower()} cerraría cerca de {M(m["proj_last"])}.',"i"))
    # 3. temporal
    parts.append('<h2>3. Análisis temporal</h2>')
    parts.append(bullets([
        'El patrón estacional del negocio se mantiene; conviene anticipar campañas en los meses históricamente más lentos.',
        f'El ritmo actual (~{M(m["daily"])}/día) indica demanda base sólida.',
        'Para la temporada baja, activar campañas preventivas de mantenimiento para sostener el piso de ventas.']))
    # proyeccion anual
    yr_lin = monthly["neto"].sum()/len(m["months"])*12
    parts.append(box("🔮 PROYECCIÓN",
        f'Con {M(total)} acumulados y el ritmo actual, el año proyecta cerrar en torno a <b>{M(yr_lin)}</b> (estimación lineal simple; se afina con cada corte).',"i"))
    # 4. productos/marcas/sku
    parts.append('<h2>4. Productos, marcas y SKU — liderazgos</h2>')
    parts.append('<h3>4.1 Grupos de productos</h3>')
    parts.append(tbl(["Grupo","Ventas","% total"],[[g,M(v),f'{v/total*100:.2f}%'] for g,v in gr.items()],{1,2}))
    parts.append('<h3>4.2 Top 10 productos (SKU) por ingresos</h3>')
    parts.append(tbl(["#","Producto (SKU)","Ventas","Grupo"],
        [[i+1,p[:46],M(r["neto"]),m["grp_of"].get(p,"-")] for i,(p,r) in enumerate(m["top_prod"].iterrows())],{2}))
    parts.append('<h3>4.3 Líderes por marca (top 10)</h3>')
    mrows=[]
    for mk,v in m["marca_tot"].head(10).items():
        sel=m["mv"].loc[mk,"VENDEDOR"] if mk in m["mv"].index else "-"; selv=m["mv"].loc[mk,"SUMANETO"] if mk in m["mv"].index else 0
        sksel=m["msku"].loc[mk,"VENDEDOR"] if mk in m["msku"].index else "-"; sksn=int(m["msku"].loc[mk,"PRODUCTO"]) if mk in m["msku"].index else 0
        mrows.append([mk,M(v),f'{sel} ({M(selv)})',f'{sksel} ({sksn})',m["mgrp"].get(mk,"-")])
    parts.append(tbl(["Marca","Total","Mayor $ (vendedor)","Más SKU","Categoría"],mrows,{1}))
    parts.append('<h3>4.4 Ranking de vendedores por diversidad de SKU</h3>')
    div=vend["sku"].sort_values(ascending=False).head(8)
    parts.append(tbl(["#","Vendedor","SKU distintos"],[[i+1,v,f'{int(n):,}'] for i,(v,n) in enumerate(div.items())],{2}))
    parts.append(box("👑 VENDEDOR MÁS COMPLETO",
        f'{vend["sku"].idxmax()} maneja el catálogo más amplio ({int(vend["sku"].max()):,} SKU) y es el referente natural para venta cruzada. Documentar y replicar su método.',"g"))
    # 5. clientes
    parts.append('<h2>5. Análisis de clientes</h2>')
    parts.append(f'<p>La base es de <b>{m["ncli"]:,} clientes únicos</b>. El Top 10 concentra el <b>{m["top10"]:.1f}%</b> de los ingresos {"— concentración saludable, base amplia." if m["top10"]<45 else "— dependencia relevante de grandes cuentas."}</p>')
    parts.append('<h3>5.1 Top 15 clientes acumulado</h3>')
    crows=[]
    for i,(c,v) in enumerate(m["cli_tot"].head(15).items()):
        f=int(m["cli_fac"].get(c,0)); crows.append([i+1,c[:40],M(v),f'{f:,}',M(v/f) if f else "-"])
    parts.append(tbl(["#","Cliente","Acumulado","Facturas","Ticket"],crows,{2,3,4}))
    parts.append(box("📌 SEGUIMIENTO DE CARTERA",
        f'El detalle de {len(m["recov"])} clientes recuperados y {len(m["risk"])} en riesgo se entrega en el informe de seguimiento de clientes (pestaña dedicada / descarga aparte).',"i"))
    # 6. vendedores
    parts.append('<h2>6. Análisis de vendedores</h2>')
    parts.append(f'<p>El equipo cuenta con {m["nvend"]} vendedores activos. {vend.index[0]} y {vend.index[1]} se consolidan como los motores de mayor impulso.</p>')
    parts.append('<h3>6.1 Ranking acumulado de vendedores</h3>')
    vrows=[]
    for i,(v,r) in enumerate(vend.iterrows()):
        vrows.append([i+1,v,M(r["neto"]),f'{r["neto"]/total*100:.1f}%',f'{int(r["cli"]):,}',f'{int(r["fac"]):,}',f'{int(r["sku"]):,}',M(r["ticket"]),_perfil(r,tk_med)])
    parts.append(tbl(["#","Vendedor","Ventas","% tot","Cli.","Fact.","SKU","Ticket","Perfil"],vrows,{2,3,4,5,6,7}))
    # 7. geografico
    parts.append('<h2>7. Análisis geográfico</h2>')
    parts.append('<h3>7.1 Top 12 sectores</h3>')
    parts.append(tbl(["#","Sector","Acumulado","% total"],[[i+1,s,M(v),f'{v/total*100:.1f}%'] for i,(s,v) in enumerate(m["sec"].head(12).items())],{2,3}))
    # 8. alertas
    parts.append('<h2>8. Seguimiento de alertas</h2>')
    parts.append(tbl(["Tema","Estado","Dato actual"],[
        [f'{len(m["risk"])} clientes en riesgo',"⚠️ Vigilar",f'{M(m["risk_val"])} históricos'],
        ["Recuperación de dormidos","✅ Mejorando",f'{len(m["recov"])} recuperados en {MES[mm].lower()}'],
        ["Concentración de clientes","✅ Saludable" if m["top10"]<45 else "⚠️ Alta",f'Top 10 = {m["top10"]:.1f}%'],
        ["Dependencia de vendedores","⚠️ Vigilar",f'{vend.index[0]}+{vend.index[1]} = {(vend["neto"].head(2).sum()/total*100):.0f}%'],
    ]))
    # 9. insights BI
    parts.append('<h2>9. Nuevos patrones e insights (BI)</h2>')
    esp=", ".join(f'{v} → {m["mv"][m["mv"]["VENDEDOR"]==v].index[0] if (m["mv"]["VENDEDOR"]==v).any() else "—"}' for v in vend.index[:3])
    parts.append(box("🔍 INSIGHT #1 — Especialización por marca",
        f'Cada vendedor desarrolla fortaleza en marcas específicas ({esp}). Oportunidad: cruzar estas fortalezas con cross-training entre el equipo.',"i"))
    parts.append(box("🔍 INSIGHT #2 — El dúo líder",
        f'{vend.index[0]} ({M(vend.iloc[0]["neto"])}) y {vend.index[1]} ({M(vend.iloc[1]["neto"])}) generan {M(vend["neto"].head(2).sum())} = {(vend["neto"].head(2).sum()/total*100):.1f}% del negocio. Fortaleza de ejecución, pero también riesgo de dependencia: blindar permanencia y desarrollar más vendedores de alto rendimiento.',"i"))
    eff=vend.sort_values("ticket",ascending=False).index[0]; effr=vend.loc[eff]
    parts.append(box("🔍 INSIGHT #3 — Rey de la eficiencia",
        f'{eff} genera {M(effr["neto"])} con solo {int(effr["cli"])} clientes (ticket {M(effr["ticket"])}, de los más altos). Atiende pocas cuentas de alto valor. Oportunidad: asignarle 2-3 cuentas grandes adicionales sin saturar su operación.',"i"))
    parts.append(box("🔍 INSIGHT #4 — Brecha entre grupos",
        f'La brecha entre {gr.index[0]} ({grp_share(0):.1f}%) y {gr.index[1]} ({grp_share(1):.1f}%) es de {grp_share(0)-grp_share(1):.1f} puntos. Vigilar si el segundo grupo acelera hacia un cambio estructural del perfil del negocio.',"i"))
    # 10. recomendaciones
    parts.append('<h2>10. Recomendaciones y plan de acción</h2>')
    parts.append('<h3>10.1 Acciones inmediatas</h3>')
    parts.append(tbl(["P","Acción","Responsable","Impacto"],[
        ["1",f'Activar campaña de reactivación sobre los {len(m["risk"])} clientes en riesgo ({M(m["risk_val"])} históricos).',"Gerencia Comercial","⚠️ Alto"],
        ["2",f'Blindar a {vend.index[0]} y {vend.index[1]} ({(vend["neto"].head(2).sum()/total*100):.0f}% del negocio): retención e incentivos.',"Dirección","🔴 Crítico"],
        ["3",f'Programa de venta cruzada sobre el Top 10 de clientes usando el catálogo de {vend["sku"].idxmax()}.',"Ventas","💰 Oportunidad"],
        ["4",f'Auditar el portafolio: hay {m["df"]["PRODUCTO"].nunique():,} SKU; descontinuar los de baja rotación.',"Compras","🧹 Eficiencia"],
    ]))
    parts.append('<h3>10.2 Acciones de mediano plazo</h3>')
    parts.append(bullets([
        f'Desarrollar 2 vendedores adicionales de alto rendimiento para diversificar el riesgo del dúo líder.',
        'Cross-training por marca: que cada especialista comparta su método con el resto del equipo.',
        f'Aprovechar a {eff} (alto ticket, pocos clientes) para tomar cuentas grandes adicionales.',
        'Meta formal de recuperación mensual por vendedor (ej. reactivar 5 clientes dormidos/mes).']))
    parts.append('<h3>10.3 Proyección de cierre</h3>')
    parts.append(tbl(["Escenario","Supuesto","Proyección anual","Probabilidad"],[
        ["Conservador","Ritmo actual sostenido",M(yr_lin*0.95),"Alta"],
        ["Base","Leve crecimiento",M(yr_lin),"Media-Alta"],
        ["Optimista","Reactivación + venta cruzada",M(yr_lin*1.1),"Media"]],{2}))
    parts.append(box("CONCLUSIÓN EJECUTIVA",
        f'La empresa acumula {M(total)} y mantiene un ritmo saludable. El negocio está sano y en crecimiento, con concentración de clientes {"en mejora" if m["top10"]<45 else "a vigilar"}. Palancas de crecimiento por activar: venta cruzada, recuperación de los {len(m["risk"])} clientes en riesgo y diversificación del riesgo concentrado en el dúo líder.<br><br>Elaborado por: <b>Ing. Roberts Flores</b> · Corte {corte} · CONFIDENCIAL',"g"))
    parts.append('</div>')
    return "".join(parts)


def render_risk_full(m):
    mm=m["mm"]; corte=m["corte"]; d_max=m["dmax"].strftime("%d/%m/%Y")
    recent2=", ".join(f'{MES[int(x.split("-")[1])]}' for x in sorted(set(m["months"][-2:])))
    cli_tot=m["cli_tot"]
    p=[]
    p.append(f'''<div class="rep"><div class="rcover">
      <div class="rkick">SEGUIMIENTO DE CLIENTES — RECUPERADOS Y EN RIESGO</div>
      <h1>Corte {corte} — Cartera y Reactivación</h1>
      <div class="rmeta">Ventana reciente = últimos 2 meses ({recent2}) · datos al {d_max}<br>
      Elaborado por: <b>Ing. Roberts Flores</b> · <span class="conf">CONFIDENCIAL</span></div></div>''')
    p.append('<h2>1. Resumen del seguimiento</h2>')
    p.append(f'<p>Se aplican los parámetros de riesgo sobre toda la data actualizada para detectar el universo completo de clientes que requieren reactivación. Hay <b>{len(m["risk"])} clientes en riesgo</b> ({M(m["risk_val"])} históricos) y <b>{len(m["recov"])} recuperados</b> en {MES[mm].lower()} ({M(m["recov_val"])}).</p>')
    if len(m["hist"])>=2:
        p.append('<h3>1.1 Evolución de la cartera entre cortes</h3>')
        p.append(tbl(["Corte","Fecha","En riesgo","Recuperados"],[[i+1,h["dateMax"],str(h["riesgo"]),str(h.get("recuperados","-"))] for i,h in enumerate(m["hist"])],{2,3}))
    p.append(box("✅ LA RECUPERACIÓN CONTINÚA",
        f'{len(m["recov"])} clientes dormidos volvieron a comprar en {MES[mm].lower()}, aportando {M(m["recov_val"])}. Muchos clientes tienen ciclos de compra largos y regresan naturalmente; los que llevan meses sin comprar requieren contacto activo, no espera pasiva.','g'))
    p.append(f'<h2>2. Nuevo universo de riesgo — {len(m["risk"])} clientes</h2>')
    p.append(f'<p>Clientes que compraron antes pero NO en los últimos 2 meses ({recent2}). Representan <b>{M(m["risk_val"])}</b> en ingresos históricos: grupo prioritario de reactivación.</p>')
    p.append('<h3>2.1 Clientes en riesgo por vendedor</h3>')
    rv=sorted(m["rv"].items(),key=lambda x:-x[1][1])
    p.append(tbl(["#","Vendedor","Clientes","Valor en riesgo","Prioridad"],
        [[i+1,k,str(v[0]),M(v[1]),("🔴 Crítica" if i==0 else "🟠 Alta" if i<3 else "🟡 Media")] for i,(k,v) in enumerate(rv)],{2,3}))
    p.append('<h3>2.2 Clientes en riesgo por sector (top 10)</h3>')
    rs=sorted(m["rs"].items(),key=lambda x:-x[1][1])[:10]
    p.append(tbl(["#","Sector","Clientes","Valor","Acción"],
        [[i+1,k,str(v[0]),M(v[1]),("Visita de campo" if v[1]>m["risk_val"]*0.1 else "Campaña remota")] for i,(k,v) in enumerate(rs)],{2,3}))
    if rs:
        p.append(box("🎯 FOCO DE RECUPERACIÓN",
            f'{rs[0][0]} concentra {M(rs[0][1][1])} en riesgo con {rs[0][1][0]} clientes — cuentas de alto valor que justifican visitas presenciales. Organizar rutas de reactivación por las zonas de mayor valor.','i'))
    p.append('<h2>3. Top 20 clientes en riesgo — prioridad máxima</h2>')
    p.append('<p>Los 20 clientes en riesgo de mayor valor histórico, con su vendedor, zona y fecha de última compra.</p>')
    r20=[]
    for i,c in enumerate(m["risk20"]):
        r20.append([i+1,c[:34],M(cli_tot[c]),m["dom_v"].get(c,"-"),str(m["dom_s"].get(c,"-"))[:20],m["last_pur"][c].strftime("%d/%m/%Y")])
    p.append(tbl(["#","Cliente","Valor","Vendedor","Zona","Últ. compra"],r20,{2}))
    if m["risk20"]:
        c0=m["risk20"][0]
        p.append(box("⚠️ CLIENTE MÁS VALIOSO EN RIESGO",
            f'{c0[:40]} acumula {M(cli_tot[c0])} históricos pero su última compra fue el {m["last_pur"][c0].strftime("%d/%m/%Y")}. Es, por mucho, el cliente de mayor valor en riesgo. Su vendedor ({m["dom_v"].get(c0,"-")}) debe contactarlo de forma personal e inmediata. Prioridad #1 absoluta.','w'))
    p.append('<h2>4. Clientes recuperados — casos de éxito</h2>')
    p.append(f'<p>{len(m["recov"])} clientes dormidos volvieron a comprar en {MES[mm].lower()}. Reconocer al vendedor que los reactivó ayuda a replicar el éxito.</p>')
    p.append('<h3>4.1 Recuperaciones por vendedor</h3>')
    rbv=sorted(m["rbv"].items(),key=lambda x:-x[1][0])
    p.append(tbl(["Vendedor","Clientes recup.","Valor"],[[k,str(v[0]),M(v[1])] for k,v in rbv],{1,2}))
    p.append('<h3>4.2 Top recuperaciones individuales</h3>')
    p.append(tbl(["#","Cliente recuperado","Compra del mes","Vendedor","Zona"],
        [[i+1,c[:34],M(m["lastval"].get(c,0)),m["dom_v"].get(c,"-"),str(m["dom_s"].get(c,"-"))[:20]] for i,c in enumerate(m["recov_top"])],{2}))
    p.append('<h2>5. Plan de acción de reactivación</h2>')
    p.append('<h3>5.1 Acciones inmediatas</h3>')
    top_risk_txt=(f'Contacto personal URGENTE con {m["risk20"][0][:30]} ({M(cli_tot[m["risk20"][0]])}). Cuenta #1 en riesgo.' if m["risk20"] else 'Contactar el Top de clientes en riesgo.')
    p.append(tbl(["P","Acción","Responsable","Plazo"],[
        ["1",top_risk_txt,m["dom_v"].get(m["risk20"][0],"Ventas") if m["risk20"] else "Ventas","48 horas"],
        ["2",f'Rutas de reactivación por las zonas de mayor valor en riesgo.',"Supervisión","1 semana"],
        ["3",f'Campaña masiva (WhatsApp/llamadas) para los sectores con muchos clientes de menor valor.',"Marketing","2 semanas"]]))
    p.append('<h3>5.2 Protocolo de prevención</h3>')
    p.append(bullets([
        'Alerta automática: si un cliente activo no compra en 30 días, su vendedor recibe notificación para contacto preventivo.',
        'Revisar semanalmente la lista de clientes en riesgo y registrar cada gestión (fecha, resultado, próximos pasos).',
        'Meta de recuperación mensual por vendedor (ej. reactivar al menos 5 clientes dormidos al mes).',
        'Reconocer públicamente a los vendedores que más recuperan para incentivar la cultura de reactivación.']))
    p.append('<h3>5.3 Potencial económico</h3>')
    p.append(tbl(["Escenario","Ingreso potencial","Base"],[
        ["Recuperar 20% de los "+str(len(m["risk"])),M(m["risk_val"]*0.2),"Valor histórico proporcional"],
        ["Recuperar 40%",M(m["risk_val"]*0.4),"Campaña activa"],
        ["Recuperar 60% (óptimo)",M(m["risk_val"]*0.6),"Reactivación sostenida"]],{1}))
    p.append(box("CONCLUSIÓN DEL SEGUIMIENTO",
        f'La cartera muestra recuperación natural saludable ({len(m["recov"])} clientes, {M(m["recov_val"])}). El reanálisis revela {len(m["risk"])} clientes en riesgo con {M(m["risk_val"])} en juego. Con una campaña activa, recuperar el 40% representaría ~{M(m["risk_val"]*0.4)} — retorno muy alto para una inversión comercial mínima.<br><br>Elaborado por: <b>Ing. Roberts Flores</b> · Corte {corte} · CONFIDENCIAL','g'))
    p.append('</div>')
    return "".join(p)


def _sum(title, kick, kpis, paragraph, full_id, fname, dl_label):
    kind = full_id.replace("-full","")
    kh="".join(f'<div class="rk"><span>{k}</span><b>{v}</b></div>' for k,v in kpis)
    return f'''<div class="rep"><div class="rephead"><div><div class="repkick">{kick}</div>
      <h2>{title}</h2><div class="repsub">Resumen · el informe completo incluye todas las secciones, tablas, insights y recomendaciones</div></div>
      <div class="repbtns"><button class="pdfbtn" onclick="downloadReport('{kind}','{fname}')">⭳ {dl_label}</button></div></div>
      <div class="repkpis">{kh}</div>{paragraph}
      <div class="repnote">📄 Este es un <b>resumen</b>. Para leer el informe completo (largo y detallado), usa <b>Descargar (Word)</b> o <b>PDF / Imprimir</b>.</div></div>'''


def build(df, history_path, version):
    m=metrics(df, history_path, version)
    total=m["total"]; gr=m["gr"]; vend=m["vend"]; mm=m["mm"]
    exec_full=render_exec_full(m); risk_full=render_risk_full(m)
    exec_sum=_sum("Panorama de Ventas — Informe Ejecutivo", f"CORTE {m['corte']} · CONFIDENCIAL",
        [("Ingresos acumulados",M(total)),("Mejor mes",f'{MES[int(m["best_m"].split("-")[1])]} · {M(m["best_v"])}'),
         ("Clientes únicos",f'{m["ncli"]:,}'),("Vendedores",str(m["nvend"]))],
        f'<p>Se acumulan <b>{M(total)}</b>. El motor son {gr.index[0]} + {gr.index[1]} ({(gr.iloc[0]+gr.iloc[1])/total*100:.0f}%). Líder de ventas: <b>{vend.index[0]}</b> ({M(vend.iloc[0]["neto"])}). Hay {len(m["risk"])} clientes en riesgo y {len(m["recov"])} recuperados este período. El informe completo detalla evolución mensual, productos/SKU, líderes por marca, ranking de vendedores, sectores, insights de BI y plan de acción.</p>',
        "exec-full","Informe_Ejecutivo_IP.doc","Descargar informe completo")
    risk_sum=_sum("Clientes Recuperados y en Riesgo", f"SEGUIMIENTO DE CARTERA · CORTE {m['corte']}",
        [("En riesgo",str(len(m["risk"]))),("Valor en riesgo",M(m["risk_val"])),
         ("Recuperados",str(len(m["recov"]))),("Valor recuperado",M(m["recov_val"]))],
        f'<p>Universo de <b>{len(m["risk"])} clientes en riesgo</b> ({M(m["risk_val"])} históricos) sin compras en los últimos 2 meses, y <b>{len(m["recov"])} recuperados</b> en {MES[mm].lower()}. El informe completo incluye riesgo por vendedor y sector, Top 20 en riesgo con última compra, recuperaciones por vendedor y plan de reactivación con potencial económico.</p>',
        "risk-full","Seguimiento_Clientes_IP.doc","Descargar informe completo")
    return {"exec":exec_sum,"risk":risk_sum,"execFull":exec_full,"riskFull":risk_full,"snapshot":m["snap"],"corte":m["corte"]}
