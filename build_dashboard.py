#!/usr/bin/env python3
"""
Generador del dashboard IP.
Uso: python3 build_dashboard.py <ruta_xlsx> <version_str> <salida_html>
Lee el Excel de ventas, codifica los datos y produce un HTML autocontenido
con KPIs, graficos (Chart.js) y segmentadores que filtran en vivo.
El <version_str> se incrusta como marcador para la deteccion de cambios.
"""
import sys, json, html
import pandas as pd

def main():
    xlsx = sys.argv[1]
    version = sys.argv[2]
    out = sys.argv[3]

    df = pd.read_excel(xlsx, engine="openpyxl")

    # Limpieza
    for c in ["GRUPO", "VENDEDOR", "SECTOR", "MARCA", "NOMBRECLI", "DOCUMENTO"]:
        df[c] = df[c].fillna("(Sin dato)").astype(str).str.strip()
    df["MARCA"] = df["MARCA"].replace({"nan": "(Sin marca)"})
    df["CANTIDAD"] = pd.to_numeric(df["CANTIDAD"], errors="coerce").fillna(0.0)
    df["CNTDEVUELT"] = pd.to_numeric(df["CNTDEVUELT"], errors="coerce").fillna(0.0)
    df["SUMANETO"] = pd.to_numeric(df["SUMANETO"], errors="coerce").fillna(0.0)
    df["FECHADOC"] = pd.to_datetime(df["FECHADOC"], errors="coerce")
    df = df.dropna(subset=["FECHADOC"])
    df["MES"] = df["FECHADOC"].dt.strftime("%Y-%m")

    # Diccionarios
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
    doc_vals, doc_i = encode("DOCUMENTO")

    cant = df["CANTIDAD"].round(2).tolist()
    dev = df["CNTDEVUELT"].round(2).tolist()
    neto = df["SUMANETO"].round(2).tolist()

    rows = [[mes_i[k], grupo_i[k], vend_i[k], sector_i[k], marca_i[k],
             cli_i[k], doc_i[k], cant[k], dev[k], neto[k]]
            for k in range(len(df))]

    # Etiquetas de mes en espanol
    meses_es = {"01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr", "05": "May",
                "06": "Jun", "07": "Jul", "08": "Ago", "09": "Sep", "10": "Oct",
                "11": "Nov", "12": "Dic"}
    mes_labels = [f"{meses_es.get(m.split('-')[1], m)} {m.split('-')[0]}" for m in mes_vals]

    payload = {
        "version": version,
        "generated": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M"),
        "dateMin": df["FECHADOC"].min().strftime("%Y-%m-%d"),
        "dateMax": df["FECHADOC"].max().strftime("%Y-%m-%d"),
        "dims": {
            "mes": mes_vals, "mesLabels": mes_labels, "grupo": grupo_vals,
            "vendedor": vend_vals, "sector": sector_vals, "marca": marca_vals,
            "cliente": cli_vals, "doc": doc_vals,
        },
        "rows": rows,
    }

    data_json = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))

    htmlout = TEMPLATE.replace("__VERSION__", html.escape(version)) \
                      .replace("__DATA_JSON__", data_json)
    with open(out, "w", encoding="utf-8") as f:
        f.write(htmlout)
    print(f"OK -> {out} ({len(htmlout)/1e6:.2f} MB, {len(rows)} filas)")


TEMPLATE = r"""<!DOCTYPE html>
<!-- DATA_VERSION: __VERSION__ -->
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dashboard IP - Ventas</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.5.1"></script>
<style>
:root{--bg:#f4f6fb;--card:#fff;--head:#12203b;--accent:#3b6fd4;--txt:#1b2537;--muted:#6c7789;--pos:#1f9d55;--neg:#d64545;--radius:12px;--gap:16px;}
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--txt);line-height:1.5;}
.wrap{max-width:1440px;margin:0 auto;padding:var(--gap);}
.head{background:linear-gradient(135deg,#12203b,#1c355f);color:#fff;padding:22px 26px;border-radius:var(--radius);margin-bottom:var(--gap);}
.head h1{font-size:21px;font-weight:700;}
.head .sub{font-size:13px;opacity:.75;margin-top:4px;}
.filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;background:var(--card);padding:16px;border-radius:var(--radius);margin-bottom:var(--gap);box-shadow:0 1px 3px rgba(0,0,0,.07);}
.fg{display:flex;flex-direction:column;gap:4px;}
.fg label{font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;}
.fg select{padding:8px 10px;border:1px solid #d7dce5;border-radius:8px;background:#fff;font-size:13px;color:var(--txt);}
.reset{align-self:end;padding:8px 14px;border:none;border-radius:8px;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;}
.reset:hover{background:#2f5cb8;}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:var(--gap);margin-bottom:var(--gap);}
.kpi{background:var(--card);border-radius:var(--radius);padding:18px 20px;box-shadow:0 1px 3px rgba(0,0,0,.07);border-left:4px solid var(--accent);}
.kpi .lab{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;}
.kpi .val{font-size:26px;font-weight:700;margin-top:6px;}
.charts{display:grid;grid-template-columns:2fr 1fr;gap:var(--gap);margin-bottom:var(--gap);}
.charts2{display:grid;grid-template-columns:1fr 1fr;gap:var(--gap);margin-bottom:var(--gap);}
.card{background:var(--card);border-radius:var(--radius);padding:18px 20px;box-shadow:0 1px 3px rgba(0,0,0,.07);}
.card h3{font-size:14px;font-weight:600;margin-bottom:14px;}
.card canvas{max-height:300px;}
.tablecard{background:var(--card);border-radius:var(--radius);padding:18px 20px;box-shadow:0 1px 3px rgba(0,0,0,.07);overflow-x:auto;margin-bottom:var(--gap);}
table{width:100%;border-collapse:collapse;font-size:13px;}
th{text-align:left;padding:10px;border-bottom:2px solid #e4e8ef;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.5px;cursor:pointer;white-space:nowrap;}
th:hover{color:var(--txt);}
td{padding:9px 10px;border-bottom:1px solid #f0f2f6;}
tbody tr:hover{background:#f7f9fc;}
td.num{text-align:right;font-variant-numeric:tabular-nums;}
.foot{font-size:12px;color:var(--muted);text-align:center;padding:8px;}
@media(max-width:900px){.charts,.charts2{grid-template-columns:1fr;}}
</style>
</head>
<body>
<div class="wrap">
  <div class="head">
    <h1>Dashboard de Ventas — Informes IP</h1>
    <div class="sub" id="sub"></div>
  </div>

  <div class="filters">
    <div class="fg"><label>Mes</label><select id="f-mes"></select></div>
    <div class="fg"><label>Grupo</label><select id="f-grupo"></select></div>
    <div class="fg"><label>Vendedor</label><select id="f-vend"></select></div>
    <div class="fg"><label>Sector</label><select id="f-sector"></select></div>
    <div class="fg"><label>Marca</label><select id="f-marca"></select></div>
    <button class="reset" onclick="D.reset()">Limpiar filtros</button>
  </div>

  <div class="kpis">
    <div class="kpi"><div class="lab">Venta neta</div><div class="val" id="k-neto"></div></div>
    <div class="kpi"><div class="lab">Facturas</div><div class="val" id="k-fac"></div></div>
    <div class="kpi"><div class="lab">Clientes</div><div class="val" id="k-cli"></div></div>
    <div class="kpi"><div class="lab">Unidades</div><div class="val" id="k-uni"></div></div>
    <div class="kpi"><div class="lab">Ticket prom.</div><div class="val" id="k-tk"></div></div>
    <div class="kpi"><div class="lab">Devoluciones (u.)</div><div class="val" id="k-dev"></div></div>
  </div>

  <div class="charts">
    <div class="card"><h3>Venta neta por mes</h3><canvas id="c-mes"></canvas></div>
    <div class="card"><h3>Participacion por grupo</h3><canvas id="c-grupo"></canvas></div>
  </div>
  <div class="charts2">
    <div class="card"><h3>Top 10 vendedores</h3><canvas id="c-vend"></canvas></div>
    <div class="card"><h3>Top 10 marcas</h3><canvas id="c-marca"></canvas></div>
  </div>

  <div class="tablecard">
    <h3 style="font-size:14px;margin-bottom:14px;">Top 15 clientes</h3>
    <table id="tbl"><thead><tr>
      <th data-k="nombre">Cliente</th>
      <th data-k="neto" class="num">Venta neta</th>
      <th data-k="fac" class="num">Facturas</th>
      <th data-k="uni" class="num">Unidades</th>
    </tr></thead><tbody></tbody></table>
  </div>

  <div class="foot" id="foot"></div>
</div>

<script>
const PAYLOAD = __DATA_JSON__;
const COLORS=['#3b6fd4','#dd8452','#55a868','#c44e52','#8172b3','#937860','#da8bc3','#8c8c8c','#ccb974','#64b5cd'];
const R={MES:0,GRUPO:1,VEND:2,SECTOR:3,MARCA:4,CLI:5,DOC:6,CANT:7,DEV:8,NETO:9};

const fmtMoney=v=>v>=1e6?(v/1e6).toFixed(2)+'M':v>=1e3?(v/1e3).toFixed(1)+'K':v.toFixed(0);
const fmtInt=v=>v.toLocaleString('es');
const fmtFull=v=>v.toLocaleString('es',{maximumFractionDigits:0});

class Dash{
  constructor(p){this.p=p;this.rows=p.rows;this.charts={};this.sortK='neto';this.sortDir=-1;this.init();}
  init(){
    document.getElementById('sub').textContent=
      `Periodo ${this.p.dateMin} a ${this.p.dateMax} · ${this.rows.length.toLocaleString('es')} lineas · generado ${this.p.generated}`;
    document.getElementById('foot').textContent=`Version de datos: ${this.p.version}`;
    this.fill('f-mes',this.p.dims.mesLabels,'Todos');
    this.fill('f-grupo',this.p.dims.grupo,'Todos');
    this.fill('f-vend',this.p.dims.vendedor,'Todos');
    this.fill('f-sector',this.p.dims.sector,'Todos');
    this.fill('f-marca',this.p.dims.marca,'Todas');
    ['f-mes','f-grupo','f-vend','f-sector','f-marca'].forEach(id=>
      document.getElementById(id).addEventListener('change',()=>this.render()));
    document.querySelectorAll('#tbl th').forEach(th=>th.addEventListener('click',()=>{
      const k=th.dataset.k;this.sortDir=(this.sortK===k)?-this.sortDir:-1;this.sortK=k;this.renderTable();}));
    this.build();this.render();
  }
  fill(id,vals,allLabel){
    const s=document.getElementById(id);s.innerHTML=`<option value="-1">${allLabel}</option>`;
    vals.forEach((v,i)=>{const o=document.createElement('option');o.value=i;o.textContent=v;s.appendChild(o);});
  }
  reset(){['f-mes','f-grupo','f-vend','f-sector','f-marca'].forEach(id=>document.getElementById(id).value='-1');this.render();}
  filtered(){
    const g=id=>parseInt(document.getElementById(id).value);
    const m=g('f-mes'),gr=g('f-grupo'),ve=g('f-vend'),se=g('f-sector'),ma=g('f-marca');
    return this.rows.filter(r=>
      (m<0||r[R.MES]===m)&&(gr<0||r[R.GRUPO]===gr)&&(ve<0||r[R.VEND]===ve)&&
      (se<0||r[R.SECTOR]===se)&&(ma<0||r[R.MARCA]===ma));
  }
  build(){
    const mk=(id,type,opts)=>this.charts[id]=new Chart(document.getElementById(id),opts);
    mk('c-mes','bar',{type:'bar',data:{labels:this.p.dims.mesLabels,datasets:[{data:[],backgroundColor:'#3b6fd4',borderRadius:4}]},
      options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:false},
      tooltip:{callbacks:{label:c=>fmtFull(c.parsed.y)}}},scales:{y:{beginAtZero:true,ticks:{callback:v=>fmtMoney(v)}},x:{grid:{display:false}}}}});
    mk('c-grupo','doughnut',{type:'doughnut',data:{labels:this.p.dims.grupo,datasets:[{data:[],backgroundColor:COLORS,borderColor:'#fff',borderWidth:2}]},
      options:{responsive:true,maintainAspectRatio:false,animation:false,cutout:'58%',plugins:{legend:{position:'right',labels:{usePointStyle:true,padding:12,font:{size:11}}},
      tooltip:{callbacks:{label:c=>{const t=c.dataset.data.reduce((a,b)=>a+b,0);return `${c.label}: ${fmtFull(c.parsed)} (${(c.parsed/t*100).toFixed(1)}%)`;}}}}}});
    const hbar=(id)=>({type:'bar',data:{labels:[],datasets:[{data:[],backgroundColor:'#55a868',borderRadius:4}]},
      options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:false},
      tooltip:{callbacks:{label:c=>fmtFull(c.parsed.x)}}},scales:{x:{beginAtZero:true,ticks:{callback:v=>fmtMoney(v)}}}}});
    mk('c-vend','bar',hbar('c-vend'));mk('c-marca','bar',hbar('c-marca'));
    this.charts['c-marca'].data.datasets[0].backgroundColor='#dd8452';
  }
  agg(data,dimIdx,names,topN){
    const m=new Map();
    data.forEach(r=>m.set(r[dimIdx],(m.get(r[dimIdx])||0)+r[R.NETO]));
    let arr=[...m.entries()].map(([i,v])=>[names[i],v]).sort((a,b)=>b[1]-a[1]);
    if(topN)arr=arr.slice(0,topN);
    return {labels:arr.map(a=>a[0]),data:arr.map(a=>a[1])};
  }
  render(){
    const d=this.filtered();
    let neto=0,uni=0,dev=0;const facs=new Set(),clis=new Set();
    d.forEach(r=>{neto+=r[R.NETO];uni+=r[R.CANT];dev+=r[R.DEV];facs.add(r[R.DOC]);clis.add(r[R.CLI]);});
    document.getElementById('k-neto').textContent=fmtFull(neto);
    document.getElementById('k-fac').textContent=fmtInt(facs.size);
    document.getElementById('k-cli').textContent=fmtInt(clis.size);
    document.getElementById('k-uni').textContent=fmtFull(uni);
    document.getElementById('k-tk').textContent=facs.size?fmtFull(neto/facs.size):'0';
    document.getElementById('k-dev').textContent=fmtFull(dev);
    // mes
    const mv=this.p.dims.mes.map((_,i)=>0);d.forEach(r=>mv[r[R.MES]]+=r[R.NETO]);
    this.charts['c-mes'].data.datasets[0].data=mv;this.charts['c-mes'].update('none');
    // grupo
    const gv=this.p.dims.grupo.map((_,i)=>0);d.forEach(r=>gv[r[R.GRUPO]]+=r[R.NETO]);
    this.charts['c-grupo'].data.datasets[0].data=gv;this.charts['c-grupo'].update('none');
    // vend
    const v=this.agg(d,R.VEND,this.p.dims.vendedor,10);
    this.charts['c-vend'].data.labels=v.labels;this.charts['c-vend'].data.datasets[0].data=v.data;this.charts['c-vend'].update('none');
    // marca
    const ma=this.agg(d,R.MARCA,this.p.dims.marca,10);
    this.charts['c-marca'].data.labels=ma.labels;this.charts['c-marca'].data.datasets[0].data=ma.data;this.charts['c-marca'].update('none');
    // table data
    const cm=new Map();
    d.forEach(r=>{let o=cm.get(r[R.CLI]);if(!o){o={nombre:this.p.dims.cliente[r[R.CLI]],neto:0,uni:0,facs:new Set()};cm.set(r[R.CLI],o);}o.neto+=r[R.NETO];o.uni+=r[R.CANT];o.facs.add(r[R.DOC]);});
    this.tableRows=[...cm.values()].map(o=>({nombre:o.nombre,neto:o.neto,fac:o.facs.size,uni:o.uni}));
    this.renderTable();
  }
  renderTable(){
    const rows=[...this.tableRows].sort((a,b)=>{const x=a[this.sortK],y=b[this.sortK];return (x<y?-1:x>y?1:0)*this.sortDir;}).slice(0,15);
    const tb=document.querySelector('#tbl tbody');tb.innerHTML='';
    rows.forEach(o=>{const tr=document.createElement('tr');
      tr.innerHTML=`<td>${o.nombre}</td><td class="num">${fmtFull(o.neto)}</td><td class="num">${fmtInt(o.fac)}</td><td class="num">${fmtFull(o.uni)}</td>`;tb.appendChild(tr);});
  }
}
const D=new Dash(PAYLOAD);
</script>
</body>
</html>
"""

if __name__ == "__main__":
    main()
