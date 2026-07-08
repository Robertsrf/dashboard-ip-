#!/usr/bin/env python3
"""
Generador del dashboard IP (v3 - marca, ECharts, analitico).
Uso: python3 build_dashboard.py <ruta_xlsx> <version_str> <salida_html>
"""
import sys, json, html
import pandas as pd


def main():
    xlsx, version, out = sys.argv[1], sys.argv[2], sys.argv[3]
    df = pd.read_excel(xlsx, engine="openpyxl")

    for c in ["GRUPO", "VENDEDOR", "SECTOR", "MARCA", "NOMBRECLI", "DOCUMENTO", "PRODUCTO"]:
        df[c] = df[c].fillna("(Sin dato)").astype(str).str.strip()
    df["MARCA"] = df["MARCA"].replace({"nan": "(Sin marca)", "": "(Sin marca)"})
    for c in ["CANTIDAD", "CNTDEVUELT", "SUMANETO"]:
        df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0.0)
    df["FECHADOC"] = pd.to_datetime(df["FECHADOC"], errors="coerce")
    df = df.dropna(subset=["FECHADOC"])
    df["MES"] = df["FECHADOC"].dt.strftime("%Y-%m")

    def encode(col):
        vals = sorted(df[col].unique().tolist())
        idx = {v: i for i, v in enumerate(vals)}
        return vals, df[col].map(idx).astype(int).tolist()

    mes_vals, mes_i = encode("MES")
    grupo_vals, grupo_i = encode("GRUPO")
    vend_vals, vend_i = encode("VENDEDOR")
    sector_vals, sector_i = encode("SECTOR")
    marca_vals, marca_i = encode("MARCA")
    cli_vals, cli_i = encode("NOMBRECLI")
    prod_vals, prod_i = encode("PRODUCTO")
    doc_vals, doc_i = encode("DOCUMENTO")

    cant = df["CANTIDAD"].round(2).tolist()
    dev = df["CNTDEVUELT"].round(2).tolist()
    neto = df["SUMANETO"].round(2).tolist()

    rows = [[mes_i[k], grupo_i[k], vend_i[k], sector_i[k], marca_i[k],
             cli_i[k], prod_i[k], doc_i[k], cant[k], dev[k], neto[k]]
            for k in range(len(df))]

    meses_es = {"01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr", "05": "May",
                "06": "Jun", "07": "Jul", "08": "Ago", "09": "Sep", "10": "Oct",
                "11": "Nov", "12": "Dic"}
    mes_labels = [f"{meses_es.get(m.split('-')[1], m)} {m.split('-')[0][2:]}" for m in mes_vals]
    year = mes_vals[-1].split("-")[0]
    full_labels = [f"{meses_es[f'{mm:02d}']} {year[2:]}" for mm in range(1, 13)]
    hist_month_nums = [int(m.split("-")[1]) for m in mes_vals]

    payload = {
        "version": version,
        "generated": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M"),
        "dateMin": df["FECHADOC"].min().strftime("%Y-%m-%d"),
        "dateMax": df["FECHADOC"].max().strftime("%Y-%m-%d"),
        "year": year,
        "dims": {
            "mes": mes_vals, "mesLabels": mes_labels, "fullLabels": full_labels,
            "histMonthNums": hist_month_nums,
            "grupo": grupo_vals, "vendedor": vend_vals, "sector": sector_vals,
            "marca": marca_vals, "cliente": cli_vals, "producto": prod_vals,
        },
        "rows": rows,
    }
    data_json = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    out_html = TEMPLATE.replace("__VERSION__", html.escape(version)).replace("__DATA_JSON__", data_json)
    with open(out, "w", encoding="utf-8") as f:
        f.write(out_html)
    print(f"OK -> {out} ({len(out_html)/1e6:.2f} MB, {len(rows)} filas)")


TEMPLATE = r"""<!DOCTYPE html>
<!-- DATA_VERSION: __VERSION__ -->
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Distribuidora y Suministros IP · Inteligencia de Ventas</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js"></script>
<style>
:root{
  --brand:#ff4f20;--navy:#24205b;--panel:#ffffff;--panel2:#f5f6fa;--ink:#24205b;--muted:#6b7392;
  --line:#e7e9f2;--accent:#ff4f20;--accent2:#17a39a;--amber:#f4a72c;--slate:#5b6aa0;
  --pos:#16a34a;--neg:#e0472c;--radius:16px;--shadow:0 2px 10px rgba(36,32,91,.06),0 1px 2px rgba(36,32,91,.08);
}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',system-ui,sans-serif;background:var(--panel2);color:var(--ink);-webkit-font-smoothing:antialiased}
.top{background:#fff;border-bottom:3px solid var(--brand);color:var(--navy);padding:15px 26px;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
.top .brand{display:flex;align-items:center;gap:15px}
.top .logo{width:58px;height:58px;border-radius:14px;background:#fff;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow)}
.top h1{font-size:20px;font-weight:800;color:var(--navy);letter-spacing:-.3px}
.top .meta{font-size:12px;color:var(--muted);margin-top:2px}
.top .status{font-size:12px;text-align:right;color:var(--muted)}
.top .status .mini{font-size:11px;color:var(--slate);margin-top:3px;font-weight:600}
.top .dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#16a34a;margin-right:6px;vertical-align:middle}
.bar{position:sticky;top:0;z-index:40;background:rgba(255,255,255,.94);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);padding:12px 26px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.ms{position:relative}
.ms>button{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:8px 12px;font:inherit;font-size:13px;font-weight:600;color:var(--navy);cursor:pointer;transition:.15s}
.ms>button:hover{border-color:var(--brand);box-shadow:0 0 0 3px rgba(255,79,32,.1)}
.ms>button .cnt{background:var(--brand);color:#fff;border-radius:20px;font-size:11px;font-weight:700;padding:1px 7px}
.ms>button .cnt.off{background:#eceef5;color:var(--muted)}
.ms .pop{position:absolute;top:110%;left:0;z-index:60;width:270px;background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:0 12px 32px rgba(36,32,91,.18);padding:10px;display:none}
.ms.open .pop{display:block}
.ms .pop input.search{width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:8px;font:inherit;font-size:13px;margin-bottom:8px}
.ms .pop .acts{display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px}
.ms .pop .acts a{color:var(--brand);cursor:pointer;font-weight:700}
.ms .pop .list{max-height:230px;overflow:auto}
.ms .pop label{display:flex;align-items:center;gap:8px;padding:5px 6px;border-radius:7px;font-size:13px;cursor:pointer}
.ms .pop label:hover{background:var(--panel2)}
.ms .pop label input{accent-color:var(--brand);width:15px;height:15px}
.reset{margin-left:auto;background:var(--navy);color:#fff;border:none;border-radius:10px;padding:9px 14px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.reset:hover{opacity:.92}
.chips{padding:8px 26px 0;display:flex;gap:8px;flex-wrap:wrap}
.chip{background:#fff2ee;color:var(--brand);border:1px solid #ffd9cd;border-radius:20px;padding:4px 10px;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px}
.chip b{font-weight:700;color:var(--navy)}.chip span{cursor:pointer;opacity:.7}.chip span:hover{opacity:1}
.wrap{max-width:1500px;margin:0 auto;padding:18px 26px 40px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:14px;margin-bottom:18px}
.kpi{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:16px 18px;box-shadow:var(--shadow);position:relative;overflow:hidden;border-left:4px solid var(--brand)}
.kpi .lab{font-size:12px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px}
.kpi .val{font-size:27px;font-weight:800;margin-top:5px;letter-spacing:-.5px;color:var(--navy)}
.kpi .sub{font-size:12px;color:var(--muted);margin-top:2px}
.kpi .delta{font-size:12px;font-weight:700;margin-top:6px;display:inline-flex;align-items:center;gap:4px}
.kpi .delta.pos{color:var(--pos)}.kpi .delta.neg{color:var(--neg)}
.kpi .spark{position:absolute;right:10px;bottom:8px;width:96px;height:38px;opacity:.9}
.kpi.hero{background:linear-gradient(135deg,#24205b,#3a3480);color:#fff;border:none;border-left:4px solid var(--brand)}
.kpi.hero .val{color:#fff}.kpi.hero .lab,.kpi.hero .sub{color:rgba(255,255,255,.78)}
.tabs{display:flex;gap:6px;border-bottom:1px solid var(--line);margin-bottom:18px;overflow-x:auto}
.tabs button{background:none;border:none;padding:11px 16px;font:inherit;font-size:14px;font-weight:700;color:var(--muted);cursor:pointer;border-bottom:2.5px solid transparent;white-space:nowrap}
.tabs button.active{color:var(--brand);border-bottom-color:var(--brand)}
.panel{display:none}.panel.active{display:block}
.grid{display:grid;gap:16px;margin-bottom:16px}
.g2{grid-template-columns:1fr 1fr}.g3{grid-template-columns:2fr 1fr}
.card{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:16px 18px;box-shadow:var(--shadow)}
.card h3{font-size:15px;font-weight:700;letter-spacing:-.2px;color:var(--navy);display:flex;align-items:center;gap:8px}
.card .hint{font-size:12px;color:var(--muted);margin-top:2px;margin-bottom:10px}
.info{width:17px;height:17px;border-radius:50%;background:var(--navy);color:#fff;font-size:11px;font-weight:800;font-style:italic;display:inline-flex;align-items:center;justify-content:center;cursor:help;position:relative;flex:0 0 auto}
.info:hover::after{content:attr(data-tip);position:absolute;top:135%;left:0;z-index:80;width:240px;background:var(--navy);color:#fff;font-weight:500;font-size:11.5px;line-height:1.45;padding:9px 11px;border-radius:9px;box-shadow:0 10px 26px rgba(36,32,91,.28);white-space:normal}
.info:hover::before{content:'';position:absolute;top:120%;left:5px;border:6px solid transparent;border-bottom-color:var(--navy);z-index:81}
.chart{width:100%;height:330px}
.chart.tall{height:430px}.chart.sm{height:280px}
.tblwrap{overflow:auto;max-height:460px}
table{width:100%;border-collapse:collapse;font-size:13px}
thead th{position:sticky;top:0;background:var(--panel);text-align:left;padding:10px;border-bottom:2px solid var(--line);color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.4px;cursor:pointer;white-space:nowrap;user-select:none}
thead th.num,td.num{text-align:right;font-variant-numeric:tabular-nums}
tbody td{padding:9px 10px;border-bottom:1px solid #f1f4f9}
tbody tr:hover{background:var(--panel2)}
.tsearch{width:100%;max-width:320px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;font:inherit;font-size:13px;margin-bottom:10px}
.mini{font-size:12px;color:var(--muted)}
.badge{display:inline-block;background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:2px 8px;font-size:12px;font-weight:600;color:var(--muted)}
.foot{text-align:center;color:var(--muted);font-size:12.5px;padding:22px;border-top:1px solid var(--line);margin-top:10px}
.foot b{color:var(--navy)}
@media(max-width:1050px){.g2,.g3{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="top">
  <div class="brand">
    <div class="logo"><svg viewBox="0 0 120 120" width="52" height="52">
      <circle cx="60" cy="60" r="54" fill="#fff" stroke="#24205b" stroke-width="5"/>
      <circle cx="60" cy="60" r="45" fill="none" stroke="#ff4f20" stroke-width="3"/>
      <text x="61" y="80" font-family="Georgia,'Times New Roman',serif" font-size="56" font-weight="700" fill="#ff4f20" text-anchor="middle">IP</text>
    </svg></div>
    <div><h1>Distribuidora y Suministros IP</h1><div class="meta" id="meta"></div></div>
  </div>
  <div class="status"><div><span class="dot"></span>Datos en vivo · <span id="ver"></span></div><div class="mini">Autor: Ing. Roberts Flores</div></div>
</div>

<div class="bar" id="bar">
  <div class="ms" data-dim="mes"></div>
  <div class="ms" data-dim="grupo"></div>
  <div class="ms" data-dim="vend"></div>
  <div class="ms" data-dim="sector"></div>
  <div class="ms" data-dim="marca"></div>
  <button class="reset" onclick="APP.reset()">Limpiar todo</button>
</div>
<div class="chips" id="chips"></div>

<div class="wrap">
  <div class="kpis" id="kpis"></div>

  <div class="tabs" id="tabs">
    <button data-tab="resumen" class="active">Resumen ejecutivo</button>
    <button data-tab="tend">Tendencia y proyección</button>
    <button data-tab="vend">Vendedores</button>
    <button data-tab="marca">Marcas y grupos</button>
    <button data-tab="cli">Clientes</button>
    <button data-tab="prod">Productos / SKU</button>
  </div>

  <div class="panel active" data-panel="resumen">
    <div class="grid g3">
      <div class="card"><h3>Venta neta mensual y proyección</h3><div class="hint">Barras = real · línea punteada = proyección</div><div id="c-trend" class="chart tall"></div></div>
      <div class="card"><h3>Participación por grupo</h3><div class="hint">Clic para filtrar por grupo</div><div id="c-grupo" class="chart tall"></div></div>
    </div>
    <div class="grid g2">
      <div class="card"><h3>Top 10 vendedores</h3><div class="hint">Clic en una barra para filtrar</div><div id="c-vend10" class="chart"></div></div>
      <div class="card"><h3>Top 10 marcas</h3><div class="hint">Clic en una barra para filtrar</div><div id="c-marca10" class="chart"></div></div>
    </div>
    <div class="grid g2">
      <div class="card"><h3>Crecimiento intermensual</h3><div class="hint">Variación % de venta neta vs mes anterior</div><div id="c-mom" class="chart sm"></div></div>
      <div class="card"><h3>Ventas acumuladas (trayectoria)</h3><div class="hint">Acumulado del período</div><div id="c-cum" class="chart sm"></div></div>
    </div>
  </div>

  <div class="panel" data-panel="tend">
    <div class="grid"><div class="card"><h3>Proyección de venta neta</h3><div class="hint">Regresión lineal · zona sombreada = meses proyectados</div><div id="c-proj" class="chart tall"></div></div></div>
    <div class="grid g2">
      <div class="card"><h3>Detalle de proyección por mes</h3><div class="hint">Real vs proyectado y cierre estimado de año</div><div class="tblwrap"><table id="t-proj"></table></div></div>
      <div class="card"><h3>Unidades y ticket promedio por mes</h3><div class="hint">Barras = unidades · línea = ticket</div><div id="c-units" class="chart"></div></div>
    </div>
  </div>

  <div class="panel" data-panel="vend">
    <div class="grid g2">
      <div class="card"><h3>Ranking de vendedores</h3><div class="hint">Clic para filtrar · desliza para ver más</div><div id="c-vendrank" class="chart tall"></div></div>
      <div class="card"><h3>Comparación mensual (top 6)</h3><div class="hint">Trayectoria de venta neta por vendedor</div><div id="c-vendcmp" class="chart tall"></div></div>
    </div>
    <div class="grid"><div class="card"><h3>Tabla de vendedores</h3><input class="tsearch" id="s-vend" placeholder="Buscar vendedor..."><div class="tblwrap"><table id="t-vend"></table></div></div></div>
  </div>

  <div class="panel" data-panel="marca">
    <div class="grid g2">
      <div class="card"><h3>Marcas por venta neta</h3><div class="hint">Desliza para ver más · clic para filtrar</div><div id="c-marca-bars" class="chart tall"></div></div>
      <div class="card"><h3>Comparación mensual de marcas (top 6)</h3><div class="hint">Trayectoria de las 6 marcas líderes</div><div id="c-marcacmp" class="chart tall"></div></div>
    </div>
    <div class="grid g2">
      <div class="card"><h3>Grupos por mes</h3><div class="hint">Venta neta apilada por grupo</div><div id="c-grupomes" class="chart"></div></div>
      <div class="card"><h3>Tabla de marcas</h3><input class="tsearch" id="s-marca" placeholder="Buscar marca..."><div class="tblwrap"><table id="t-marca"></table></div></div>
    </div>
  </div>

  <div class="panel" data-panel="cli">
    <div class="grid g2">
      <div class="card"><h3>Top clientes por venta neta</h3><div class="hint">Desliza para ver más</div><div id="c-cli" class="chart tall"></div></div>
      <div class="card"><h3>Concentración de clientes (Pareto)</h3><div class="hint">% acumulado de venta según ranking de clientes</div><div id="c-pareto" class="chart tall"></div></div>
    </div>
    <div class="grid"><div class="card"><h3>Tabla de clientes</h3><input class="tsearch" id="s-cli" placeholder="Buscar cliente..."><div class="tblwrap"><table id="t-cli"></table></div></div></div>
  </div>

  <div class="panel" data-panel="prod">
    <div class="grid g2">
      <div class="card"><h3>Top productos por venta neta</h3><div class="hint">Desliza para ver más</div><div id="c-prodneto" class="chart tall"></div></div>
      <div class="card"><h3>Top productos por unidades</h3><div class="hint">Desliza para ver más</div><div id="c-produ" class="chart tall"></div></div>
    </div>
    <div class="grid"><div class="card"><h3>Tabla de productos (SKU)</h3><input class="tsearch" id="s-prod" placeholder="Buscar producto..."><div class="tblwrap"><table id="t-prod"></table></div></div></div>
  </div>

  <div class="foot" id="foot"></div>
</div>

<script>
const P = __DATA_JSON__;
const R={MES:0,GRUPO:1,VEND:2,SECTOR:3,MARCA:4,CLI:5,PROD:6,DOC:7,CANT:8,DEV:9,NETO:10};
const PAL=['#ff4f20','#24205b','#17a39a','#f4a72c','#5b6aa0','#e0708a','#3aa0d1','#7c9a2b','#b0552c','#9488c9','#e8b64a','#2f8f86'];
const DIMS={mes:{field:R.MES,names:P.dims.mesLabels,label:'Mes'},
  grupo:{field:R.GRUPO,names:P.dims.grupo,label:'Grupo'},
  vend:{field:R.VEND,names:P.dims.vendedor,label:'Vendedor'},
  sector:{field:R.SECTOR,names:P.dims.sector,label:'Sector'},
  marca:{field:R.MARCA,names:P.dims.marca,label:'Marca'}};
const nameIdx={};for(const k in DIMS){nameIdx[k]=new Map(DIMS[k].names.map((n,i)=>[n,i]))}
const money=v=>'$'+(v>=1e6?(v/1e6).toFixed(2)+'M':v>=1e3?(v/1e3).toFixed(1)+'K':Math.round(v));
const moneyFull=v=>'$'+Math.round(v).toLocaleString('es');
const intf=v=>Math.round(v).toLocaleString('es');
const pct=v=>(v>=0?'+':'')+v.toFixed(1)+'%';
const fmtDate=s=>{const p=s.split('-');return p[2]+'/'+p[1]+'/'+p[0]};
const TIPS={'c-trend':'Venta neta real por mes (barras) y proyección lineal hasta diciembre (línea punteada).',
  'c-grupo':'Porción de la venta neta que aporta cada grupo de producto. Clic en una porción para filtrar.',
  'c-vend10':'Los 10 vendedores con mayor venta neta en la selección actual. Clic para filtrar.',
  'c-marca10':'Las 10 marcas con mayor venta neta. Clic para filtrar.',
  'c-mom':'Cuánto sube o baja la venta neta de cada mes respecto al mes anterior (%).',
  'c-cum':'Suma acumulada de la venta neta a lo largo del período (trayectoria).',
  'c-proj':'Proyección por regresión lineal; la zona sombreada marca los meses estimados.',
  'c-units':'Unidades vendidas por mes (barras) y ticket promedio por factura (línea).',
  'c-vendrank':'Ranking completo de vendedores por venta neta. Desliza el control lateral para ver más. Clic para filtrar.',
  'c-vendcmp':'Trayectoria mensual de venta neta de los 6 vendedores líderes.',
  'c-marca-bars':'Marcas ordenadas por venta neta. Desliza para recorrer todas. Clic para filtrar.',
  'c-marcacmp':'Trayectoria mensual de venta neta de las 6 marcas líderes.',
  'c-grupomes':'Venta neta de cada grupo apilada mes a mes.',
  'c-cli':'Clientes ordenados por venta neta. Desliza el control lateral para ver más.',
  'c-pareto':'Regla 80/20: qué porcentaje de la venta acumulan los primeros clientes del ranking.',
  'c-prodneto':'Productos (SKU) ordenados por venta neta. Desliza para ver más.',
  'c-produ':'Productos (SKU) ordenados por unidades vendidas. Desliza para ver más.'};

class App{
  constructor(){
    this.f={mes:new Set(),grupo:new Set(),vend:new Set(),sector:new Set(),marca:new Set()};
    this.ch={};this.tab='resumen';this.tsort={};
    document.getElementById('meta').textContent=`Período ${fmtDate(P.dateMin)}–${fmtDate(P.dateMax)} · ${P.rows.length.toLocaleString('es')} líneas de factura`;
    document.getElementById('ver').textContent='Corte al '+fmtDate(P.dateMax);
    document.getElementById('foot').innerHTML=`<b>Distribuidora y Suministros IP</b> &nbsp;·&nbsp; Información actualizada del ${fmtDate(P.dateMin)} al ${fmtDate(P.dateMax)} &nbsp;·&nbsp; Autor: Ing. Roberts Flores`;
    this.buildFilters();this.buildKPIs();this.injectInfo();this.bindTabs();
    window.addEventListener('resize',()=>{for(const k in this.ch)this.ch[k]&&this.ch[k].resize()});
    this.render();
  }
  injectInfo(){for(const id in TIPS){const el=document.getElementById(id);if(!el)continue;
    const card=el.closest('.card');if(!card)continue;const h=card.querySelector('h3');
    if(h&&!h.querySelector('.info')){const s=document.createElement('span');s.className='info';s.textContent='i';s.setAttribute('data-tip',TIPS[id]);h.appendChild(s)}}}
  buildFilters(){
    for(const key in DIMS){
      const host=document.querySelector(`.ms[data-dim="${key}"]`);const d=DIMS[key];
      host.innerHTML=`<button><span>${d.label}</span><span class="cnt off">Todos</span></button>
        <div class="pop"><input class="search" placeholder="Buscar..."><div class="acts"><a data-a="all">Todos</a><a data-a="none">Ninguno</a></div><div class="list"></div></div>`;
      const list=host.querySelector('.list');
      d.names.forEach((n,i)=>{list.insertAdjacentHTML('beforeend',`<label><input type="checkbox" value="${i}"><span>${n}</span></label>`)});
      host.querySelector('button').onclick=e=>{e.stopPropagation();
        document.querySelectorAll('.ms').forEach(m=>m!==host&&m.classList.remove('open'));host.classList.toggle('open')};
      host.querySelector('.pop').onclick=e=>e.stopPropagation();
      host.querySelector('.search').oninput=e=>{const q=e.target.value.toLowerCase();
        list.querySelectorAll('label').forEach(l=>l.style.display=l.textContent.toLowerCase().includes(q)?'':'none')};
      list.onchange=()=>{this.f[key]=new Set([...list.querySelectorAll('input:checked')].map(c=>+c.value));this.render()};
      host.querySelectorAll('.acts a').forEach(a=>a.onclick=()=>{
        const vis=[...list.querySelectorAll('label')].filter(l=>l.style.display!=='none');
        vis.forEach(l=>l.querySelector('input').checked=(a.dataset.a==='all'));
        this.f[key]=new Set([...list.querySelectorAll('input:checked')].map(c=>+c.value));this.render()});
    }
    document.body.addEventListener('click',()=>document.querySelectorAll('.ms').forEach(m=>m.classList.remove('open')));
  }
  syncFilterUI(){
    for(const key in DIMS){
      const host=document.querySelector(`.ms[data-dim="${key}"]`);
      const cnt=host.querySelector('.cnt');const n=this.f[key].size;
      cnt.textContent=n?n+' sel.':'Todos';cnt.className='cnt'+(n?'':' off');
      host.querySelectorAll('.list input').forEach(c=>c.checked=this.f[key].has(+c.value));
    }
    const chips=document.getElementById('chips');chips.innerHTML='';
    for(const key in DIMS){for(const i of this.f[key]){
      const c=document.createElement('div');c.className='chip';
      c.innerHTML=`<b>${DIMS[key].label}:</b> ${DIMS[key].names[i]} <span>✕</span>`;
      c.querySelector('span').onclick=()=>{this.f[key].delete(i);this.render()};chips.appendChild(c)}}
  }
  reset(){for(const k in this.f)this.f[k].clear();this.render()}
  filtered(){const f=this.f;const has=(s,v)=>s.size===0||s.has(v);
    return P.rows.filter(r=>has(f.mes,r[R.MES])&&has(f.grupo,r[R.GRUPO])&&has(f.vend,r[R.VEND])&&has(f.sector,r[R.SECTOR])&&has(f.marca,r[R.MARCA]));}
  toggleFilter(key,name){const i=nameIdx[key].get(name);if(i==null)return;
    this.f[key].has(i)?this.f[key].delete(i):this.f[key].add(i);this.render()}
  monthly(rows){const n=P.dims.mes.length;const o={neto:Array(n).fill(0),cant:Array(n).fill(0),dev:Array(n).fill(0),
      docs:Array.from({length:n},()=>new Set()),clis:Array.from({length:n},()=>new Set()),prods:Array.from({length:n},()=>new Set())};
    rows.forEach(r=>{const m=r[R.MES];o.neto[m]+=r[R.NETO];o.cant[m]+=r[R.CANT];o.dev[m]+=r[R.DEV];
      o.docs[m].add(r[R.DOC]);o.clis[m].add(r[R.CLI]);o.prods[m].add(r[R.PROD])});return o;}
  groupBy(rows,field){const m=new Map();rows.forEach(r=>{let o=m.get(r[field]);if(!o){o={neto:0,cant:0,dev:0,docs:new Set(),clis:new Set(),prods:new Set()};m.set(r[field],o)}
    o.neto+=r[R.NETO];o.cant+=r[R.CANT];o.dev+=r[R.DEV];o.docs.add(r[R.DOC]);o.clis.add(r[R.CLI]);o.prods.add(r[R.PROD])});return m}
  linreg(ys){const xs=ys.map((_,i)=>i);const n=xs.length;if(n<2)return{slope:0,intercept:ys[0]||0};
    const sx=xs.reduce((a,b)=>a+b,0),sy=ys.reduce((a,b)=>a+b,0),sxx=xs.reduce((a,b)=>a+b*b,0),sxy=xs.reduce((a,b,i)=>a+b*ys[i],0);
    const d=n*sxx-sx*sx;const slope=d?(n*sxy-sx*sy)/d:0;return{slope,intercept:(sy-slope*sx)/n}}
  buildKPIs(){
    this.kpiDefs=[{id:'neto',lab:'Venta neta',hero:true,fmt:moneyFull},{id:'fac',lab:'Facturas',fmt:intf},
      {id:'tk',lab:'Ticket promedio',fmt:moneyFull},{id:'cli',lab:'Clientes únicos',fmt:intf},
      {id:'sku',lab:'SKU únicos',fmt:intf},{id:'uni',lab:'Unidades',fmt:intf},
      {id:'dev',lab:'% Devolución',fmt:v=>v.toFixed(1)+'%'},{id:'proy',lab:'Proyección año',fmt:moneyFull,sub:'estimado a Dic'}];
    document.getElementById('kpis').innerHTML=this.kpiDefs.map(k=>`<div class="kpi${k.hero?' hero':''}">
      <div class="lab">${k.lab}</div><div class="val" id="k-${k.id}">–</div><div class="sub" id="ks-${k.id}">${k.sub||''}</div>
      <div class="delta" id="kd-${k.id}"></div><div class="spark" id="kp-${k.id}"></div></div>`).join('');
  }
  renderKPIs(mo){
    const sum=a=>a.reduce((x,y)=>x+y,0);const uniq=arr=>{const s=new Set();arr.forEach(x=>x.forEach(v=>s.add(v)));return s.size};
    const neto=sum(mo.neto),cant=sum(mo.cant),dev=sum(mo.dev);
    const fac=uniq(mo.docs),cli=uniq(mo.clis),sku=uniq(mo.prods);
    const idxData=P.dims.histMonthNums.map(m=>m-1);const yFull=Array(12).fill(null);mo.neto.forEach((v,i)=>{yFull[idxData[i]]=v});
    const lr=this.linreg(mo.neto);let proyYear=0;for(let m=0;m<12;m++){const real=yFull[m];proyYear+=(real!=null?real:Math.max(0,lr.slope*m+lr.intercept))}
    const vals={neto,fac,tk:fac?neto/fac:0,cli,sku,uni:cant,dev:cant?dev/cant*100:0,proy:proyYear};
    const series={neto:mo.neto,fac:mo.docs.map(s=>s.size),tk:mo.neto.map((v,i)=>mo.docs[i].size?v/mo.docs[i].size:0),
      cli:mo.clis.map(s=>s.size),sku:mo.prods.map(s=>s.size),uni:mo.cant,dev:mo.cant.map((c,i)=>c?mo.dev[i]/c*100:0),proy:mo.neto};
    this.kpiDefs.forEach(k=>{document.getElementById('k-'+k.id).textContent=k.fmt(vals[k.id]||0);
      const s=series[k.id];const last=s.length-1;let d=null;if(last>=1&&s[last-1])d=(s[last]-s[last-1])/Math.abs(s[last-1])*100;
      const de=document.getElementById('kd-'+k.id);
      if(d!=null&&k.id!=='proy'){de.className='delta '+(d>=0?'pos':'neg');de.textContent=(d>=0?'▲ ':'▼ ')+pct(d)+' últ. mes'}else de.textContent='';
      this.spark('kp-'+k.id,s,k.hero);});
  }
  spark(id,data,hero){const el=document.getElementById(id);let c=this.ch[id];if(!c){c=this.ch[id]=echarts.init(el)}
    const col=hero?'#fff':'#ff4f20';const area=hero?'rgba(255,255,255,.2)':'rgba(255,79,32,.14)';
    c.setOption({grid:{top:2,bottom:2,left:2,right:2},xAxis:{type:'category',show:false,data:data.map((_,i)=>i)},yAxis:{type:'value',show:false},
      series:[{type:'line',data,smooth:true,symbol:'none',lineStyle:{width:2,color:col},areaStyle:{color:area}}]},true)}
  chart(id){if(!this.ch[id]){this.ch[id]=echarts.init(document.getElementById(id))}return this.ch[id]}
  topN(map,names,n){return [...map.entries()].map(([i,o])=>[names[i],o.neto,o]).sort((a,b)=>b[1]-a[1]).slice(0,n)}
  hbz(id,pairs,opt={}){const c=this.chart(id);const trunc=opt.trunc||28;
    const cats=pairs.map(p=>p[0]);const vals=pairs.map(p=>Math.round(p[1]));
    const win=opt.window||14;const zoom=opt.zoom&&cats.length>win;const end=zoom?Math.max(6,win/cats.length*100):100;
    const fmt=opt.units?(v=>intf(v)+' u.'):(v=>moneyFull(v));
    c.setOption({grid:{top:8,bottom:zoom?26:8,left:opt.left||150,right:zoom?42:24,containLabel:true},
      tooltip:{trigger:'axis',axisPointer:{type:'shadow'},valueFormatter:fmt},
      xAxis:{type:'value',axisLabel:{formatter:money}},
      yAxis:{type:'category',data:cats,inverse:true,axisLabel:{fontSize:11,formatter:s=>s.length>trunc?s.slice(0,trunc-1)+'…':s}},
      dataZoom:zoom?[{type:'slider',yAxisIndex:0,right:12,width:14,start:0,end:end,brushSelect:false,handleSize:'80%'},{type:'inside',yAxisIndex:0,start:0,end:end}]:[],
      series:[{type:'bar',data:vals,itemStyle:{color:opt.color||'#ff4f20',borderRadius:[0,5,5,0]},barMaxWidth:24}]},true);
    if(opt.click){c.off('click');c.on('click',p=>{if(p.componentType==='series')opt.click(p.name)})}}
  render(){this.syncFilterUI();const d=this.filtered();this.d=d;this.mo=this.monthly(d);this.renderKPIs(this.mo);this.renderTab();}
  bindTabs(){document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');
    document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
    document.querySelector(`.panel[data-panel="${b.dataset.tab}"]`).classList.add('active');
    this.tab=b.dataset.tab;this.renderTab();
    setTimeout(()=>{for(const k in this.ch)this.ch[k]&&this.ch[k].resize()},30)})}
  renderTab(){const t=this.tab,d=this.d,mo=this.mo;
    if(t==='resumen')this.tResumen(d,mo);else if(t==='tend')this.tTend(d,mo);else if(t==='vend')this.tVend(d,mo);
    else if(t==='marca')this.tMarca(d,mo);else if(t==='cli')this.tCli(d,mo);else if(t==='prod')this.tProd(d,mo);}
  projLine(mo){const idxData=P.dims.histMonthNums.map(m=>m-1);const yFull=Array(12).fill(null);
    mo.neto.forEach((v,i)=>yFull[idxData[i]]=v);const lr=this.linreg(mo.neto);
    const proj=yFull.map((v,m)=>v!=null?v:Math.max(0,lr.slope*m+lr.intercept));
    const realOnly=yFull.map(v=>v);const projOnly=yFull.map((v,m)=>v!=null?null:proj[m]);
    const lastReal=idxData[idxData.length-1];if(lastReal>=0)projOnly[lastReal]=yFull[lastReal];
    return {yFull,proj,realOnly,projOnly,lr,idxData};}
  tResumen(d,mo){
    const pj=this.projLine(mo);const c=this.chart('c-trend');
    c.setOption({grid:{top:20,bottom:30,left:55,right:20,containLabel:true},legend:{data:['Real','Proyección'],bottom:0},
      tooltip:{trigger:'axis',valueFormatter:v=>v==null?'–':moneyFull(v)},
      xAxis:{type:'category',data:P.dims.fullLabels,axisLabel:{fontSize:11}},yAxis:{type:'value',axisLabel:{formatter:money}},
      series:[{name:'Real',type:'bar',data:pj.realOnly,itemStyle:{color:'#ff4f20',borderRadius:[5,5,0,0]},barMaxWidth:30},
        {name:'Proyección',type:'line',data:pj.projOnly,smooth:true,symbol:'circle',lineStyle:{type:'dashed',color:'#24205b',width:2},itemStyle:{color:'#24205b'}}]},true);
    const g=this.groupBy(d,R.GRUPO);const ge=[...g.entries()].map(([i,o])=>({name:P.dims.grupo[i],value:Math.round(o.neto)})).sort((a,b)=>b.value-a.value);
    const gc=this.chart('c-grupo');gc.setOption({tooltip:{trigger:'item',valueFormatter:v=>moneyFull(v)},legend:{type:'scroll',bottom:0},
      series:[{type:'pie',radius:['45%','72%'],center:['50%','44%'],itemStyle:{borderColor:'#fff',borderWidth:2},
      label:{formatter:'{b}\n{d}%',fontSize:11,color:'#24205b'},data:ge,color:PAL}]},true);
    gc.off('click');gc.on('click',p=>this.toggleFilter('grupo',p.name));
    this.hbz('c-vend10',this.topN(this.groupBy(d,R.VEND),P.dims.vendedor,10).map(x=>[x[0],x[1]]),{color:'#24205b',left:110,click:n=>this.toggleFilter('vend',n)});
    this.hbz('c-marca10',this.topN(this.groupBy(d,R.MARCA),P.dims.marca,10).map(x=>[x[0],x[1]]),{color:'#17a39a',left:120,click:n=>this.toggleFilter('marca',n)});
    const mom=mo.neto.map((v,i)=>i===0||!mo.neto[i-1]?0:(v-mo.neto[i-1])/mo.neto[i-1]*100);
    const mc=this.chart('c-mom');mc.setOption({grid:{top:14,bottom:24,left:45,right:14,containLabel:true},
      tooltip:{trigger:'axis',valueFormatter:v=>v.toFixed(1)+'%'},xAxis:{type:'category',data:P.dims.mesLabels},
      yAxis:{type:'value',axisLabel:{formatter:'{value}%'}},series:[{type:'bar',data:mom.map(v=>+v.toFixed(1)),
      itemStyle:{color:p=>p.value>=0?'#16a34a':'#e0472c',borderRadius:[4,4,0,0]},barMaxWidth:34}]},true);
    let acc=0;const cum=mo.neto.map(v=>acc+=v);const cc=this.chart('c-cum');
    cc.setOption({grid:{top:14,bottom:24,left:55,right:14,containLabel:true},tooltip:{trigger:'axis',valueFormatter:v=>moneyFull(v)},
      xAxis:{type:'category',data:P.dims.mesLabels},yAxis:{type:'value',axisLabel:{formatter:money}},
      series:[{type:'line',data:cum.map(Math.round),smooth:true,symbol:'circle',lineStyle:{color:'#ff4f20',width:3},
      areaStyle:{color:'rgba(255,79,32,.15)'},itemStyle:{color:'#ff4f20'}}]},true)}
  tTend(d,mo){
    const pj=this.projLine(mo);const c=this.chart('c-proj');const markStart=pj.idxData[pj.idxData.length-1];
    c.setOption({grid:{top:24,bottom:34,left:60,right:24,containLabel:true},legend:{bottom:0,data:['Real','Proyección']},
      tooltip:{trigger:'axis',valueFormatter:v=>v==null?'–':moneyFull(v)},
      xAxis:{type:'category',data:P.dims.fullLabels},yAxis:{type:'value',axisLabel:{formatter:money}},
      series:[{name:'Real',type:'line',data:pj.realOnly,smooth:true,symbol:'circle',symbolSize:7,lineStyle:{color:'#ff4f20',width:3},itemStyle:{color:'#ff4f20'},areaStyle:{color:'rgba(255,79,32,.12)'}},
        {name:'Proyección',type:'line',data:pj.projOnly,smooth:true,symbol:'emptyCircle',lineStyle:{type:'dashed',color:'#24205b',width:2.5},itemStyle:{color:'#24205b'},
         markArea:{itemStyle:{color:'rgba(36,32,91,.06)'},data:[[{xAxis:P.dims.fullLabels[markStart]},{xAxis:P.dims.fullLabels[11]}]]}}]},true);
    const realYear=pj.yFull.reduce((a,b)=>a+(b||0),0);const projYear=pj.proj.reduce((a,b)=>a+b,0);
    let rows=P.dims.fullLabels.map((lb,m)=>{const real=pj.yFull[m];const pr=pj.proj[m];
      return `<tr><td>${lb}</td><td class="num">${real!=null?moneyFull(real):'<span class=mini>—</span>'}</td>
      <td class="num">${real!=null?'<span class=badge>real</span>':moneyFull(pr)}</td></tr>`}).join('');
    document.getElementById('t-proj').innerHTML=`<thead><tr><th>Mes</th><th class=num>Real</th><th class=num>Proyectado</th></tr></thead><tbody>${rows}
      <tr style="font-weight:800"><td>Cierre estimado ${P.year}</td><td class="num">${moneyFull(realYear)}</td><td class="num">${moneyFull(projYear)}</td></tr></tbody>`;
    const uc=this.chart('c-units');const tk=mo.neto.map((v,i)=>mo.docs[i].size?v/mo.docs[i].size:0);
    uc.setOption({grid:{top:24,bottom:30,left:55,right:55,containLabel:true},legend:{bottom:0,data:['Unidades','Ticket prom.']},
      tooltip:{trigger:'axis'},xAxis:{type:'category',data:P.dims.mesLabels},
      yAxis:[{type:'value',name:'Unid.',axisLabel:{formatter:money}},{type:'value',name:'Ticket',position:'right',axisLabel:{formatter:money}}],
      series:[{name:'Unidades',type:'bar',data:mo.cant.map(Math.round),itemStyle:{color:'#17a39a',borderRadius:[4,4,0,0]},barMaxWidth:30},
        {name:'Ticket prom.',type:'line',yAxisIndex:1,data:tk.map(Math.round),smooth:true,lineStyle:{color:'#ff4f20',width:3},itemStyle:{color:'#ff4f20'}}]},true)}
  monthlyByDim(d,field,names,topn){
    const g=this.groupBy(d,field);const top=[...g.entries()].sort((a,b)=>b[1].neto-a[1].neto).slice(0,topn).map(e=>e[0]);
    const nM=P.dims.mes.length;const map={};top.forEach(i=>map[i]=Array(nM).fill(0));
    d.forEach(r=>{if(map[r[field]])map[r[field]][r[R.MES]]+=r[R.NETO]});
    return top.map((i,k)=>({name:names[i],type:'line',smooth:true,symbol:'circle',data:map[i].map(Math.round),lineStyle:{width:2.5,color:PAL[k%PAL.length]},itemStyle:{color:PAL[k%PAL.length]}}))}
  tVend(d,mo){
    this.hbz('c-vendrank',this.topN(this.groupBy(d,R.VEND),P.dims.vendedor,25).map(x=>[x[0],x[1]]),{color:'#24205b',left:120,zoom:true,window:12,click:n=>this.toggleFilter('vend',n)});
    const cmp=this.chart('c-vendcmp');cmp.setOption({grid:{top:20,bottom:34,left:55,right:20,containLabel:true},
      legend:{type:'scroll',bottom:0},tooltip:{trigger:'axis',valueFormatter:v=>moneyFull(v)},
      xAxis:{type:'category',data:P.dims.mesLabels},yAxis:{type:'value',axisLabel:{formatter:money}},
      series:this.monthlyByDim(d,R.VEND,P.dims.vendedor,6),color:PAL},true);
    this.entTable('t-vend','s-vend',this.groupBy(d,R.VEND),P.dims.vendedor,'Vendedor',n=>this.toggleFilter('vend',n))}
  tMarca(d,mo){
    const g=this.groupBy(d,R.MARCA);
    this.hbz('c-marca-bars',this.topN(g,P.dims.marca,40).map(x=>[x[0],x[1]]),{color:'#17a39a',left:130,zoom:true,window:13,click:n=>this.toggleFilter('marca',n)});
    const cmp=this.chart('c-marcacmp');cmp.setOption({grid:{top:20,bottom:34,left:55,right:20,containLabel:true},
      legend:{type:'scroll',bottom:0},tooltip:{trigger:'axis',valueFormatter:v=>moneyFull(v)},
      xAxis:{type:'category',data:P.dims.mesLabels},yAxis:{type:'value',axisLabel:{formatter:money}},
      series:this.monthlyByDim(d,R.MARCA,P.dims.marca,6),color:PAL},true);
    const gm=this.chart('c-grupomes');const gs=this.groupBy(d,R.GRUPO);const gtop=[...gs.keys()];const nM=P.dims.mes.length;
    const gmap={};gtop.forEach(i=>gmap[i]=Array(nM).fill(0));d.forEach(r=>{gmap[r[R.GRUPO]][r[R.MES]]+=r[R.NETO]});
    gm.setOption({grid:{top:16,bottom:34,left:55,right:20,containLabel:true},legend:{type:'scroll',bottom:0},
      tooltip:{trigger:'axis',valueFormatter:v=>moneyFull(v)},xAxis:{type:'category',data:P.dims.mesLabels},
      yAxis:{type:'value',axisLabel:{formatter:money}},color:PAL,
      series:gtop.map((i,k)=>({name:P.dims.grupo[i],type:'bar',stack:'g',data:gmap[i].map(Math.round),barMaxWidth:38}))},true);
    this.entTable('t-marca','s-marca',g,P.dims.marca,'Marca',n=>this.toggleFilter('marca',n))}
  tCli(d,mo){
    const g=this.groupBy(d,R.CLI);
    this.hbz('c-cli',this.topN(g,P.dims.cliente,30).map(x=>[x[0],x[1]]),{color:'#e0708a',left:190,trunc:30,zoom:true,window:12});
    const all=[...g.values()].map(o=>o.neto).sort((a,b)=>b-a);const tot=all.reduce((a,b)=>a+b,0);
    let acc=0;const cumpct=all.map(v=>{acc+=v;return +(acc/tot*100).toFixed(1)});
    const step=Math.max(1,Math.ceil(all.length/80));const xs=[],barv=[],linev=[];
    for(let i=0;i<all.length;i+=step){xs.push(i+1);barv.push(Math.round(all[i]));linev.push(cumpct[i])}
    const pc=this.chart('c-pareto');pc.setOption({grid:{top:20,bottom:44,left:55,right:52,containLabel:true},
      tooltip:{trigger:'axis'},xAxis:{type:'category',data:xs,name:'ranking cliente'},
      yAxis:[{type:'value',axisLabel:{formatter:money}},{type:'value',max:100,position:'right',axisLabel:{formatter:'{value}%'}}],
      dataZoom:xs.length>25?[{type:'slider',xAxisIndex:0,height:12,bottom:20,start:0,end:Math.max(20,25/xs.length*100)}]:[],
      series:[{type:'bar',data:barv,itemStyle:{color:'#c9cfe6'}},{type:'line',yAxisIndex:1,data:linev,smooth:true,symbol:'none',lineStyle:{color:'#ff4f20',width:3}}]},true);
    this.entTable('t-cli','s-cli',g,P.dims.cliente,'Cliente',null)}
  tProd(d,mo){
    const g=this.groupBy(d,R.PROD);
    this.hbz('c-prodneto',this.topN(g,P.dims.producto,30).map(x=>[x[0],x[1]]),{color:'#ff4f20',left:230,trunc:36,zoom:true,window:11});
    const byU=[...g.entries()].map(([i,o])=>[P.dims.producto[i],o.cant]).sort((a,b)=>b[1]-a[1]).slice(0,30);
    this.hbz('c-produ',byU,{color:'#17a39a',left:230,trunc:36,zoom:true,window:11,units:true});
    this.entTable('t-prod','s-prod',g,P.dims.producto,'Producto',null)}
  entTable(tid,sid,map,names,label,onclick){
    const totN=[...map.values()].reduce((a,o)=>a+o.neto,0);
    let data=[...map.entries()].map(([i,o])=>({name:names[i],neto:o.neto,fac:o.docs.size,cli:o.clis.size,uni:o.cant,sku:o.prods.size,
      tk:o.docs.size?o.neto/o.docs.size:0,share:totN?o.neto/totN*100:0}));
    const cols=[{k:'name',l:label},{k:'neto',l:'Venta neta',n:1,f:moneyFull},{k:'share',l:'% total',n:1,f:v=>v.toFixed(1)+'%'},
      {k:'fac',l:'Facturas',n:1,f:intf},{k:'tk',l:'Ticket',n:1,f:moneyFull},{k:'cli',l:'Clientes',n:1,f:intf},{k:'sku',l:'SKU',n:1,f:intf},{k:'uni',l:'Unidades',n:1,f:intf}];
    const st=this.tsort[tid]||{k:'neto',dir:-1};this.tsort[tid]=st;
    const tbl=document.getElementById(tid);const search=document.getElementById(sid);
    const draw=()=>{const q=(search&&search.value||'').toLowerCase();
      let rows=data.filter(r=>r.name.toLowerCase().includes(q)).sort((a,b)=>{const x=a[st.k],y=b[st.k];return(x<y?-1:x>y?1:0)*st.dir}).slice(0,200);
      tbl.innerHTML=`<thead><tr>${cols.map(c=>`<th class="${c.n?'num':''}" data-k="${c.k}">${c.l}${st.k===c.k?(st.dir<0?' ▼':' ▲'):''}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td class="${c.n?'num':''}" ${c.k==='name'&&onclick?'style="cursor:pointer;color:#24205b;font-weight:600"':''} data-nm="${c.k==='name'?encodeURIComponent(r.name):''}">${c.f?c.f(r[c.k]):r[c.k]}</td>`).join('')}</tr>`).join('')}</tbody>`;
      tbl.querySelectorAll('th').forEach(th=>th.onclick=()=>{const k=th.dataset.k;st.dir=(st.k===k)?-st.dir:-1;st.k=k;draw()});
      if(onclick)tbl.querySelectorAll('td[data-nm]:not([data-nm=""])').forEach(td=>td.onclick=()=>onclick(decodeURIComponent(td.dataset.nm)))};
    if(search)search.oninput=draw;draw();
  }
}
const APP=new App();
</script>
</body>
</html>
"""

if __name__ == "__main__":
    main()
