// ===== Visão anual: comercial + financeiro do ano todo, de um mês ou de um período =====
// Os Dashboards Comercial/Financeiro mostram o mês vigente; aqui fica o histórico.
let avCharts = {};
let avModo = 'ano'; // 'ano' | 'mes' | 'periodo'
let avAno = null;
let avMes = null;
let avDe = null;
let avAte = null;

function avMesesSelecionados() {
  const agora = mesAtual();
  if (avModo === 'mes') return [avMes];
  if (avModo === 'periodo') return mesesEntre(avDe, avAte);
  const ano = String(avAno);
  const ultimo = ano === agora.slice(0, 4) ? agora : ano + '-12';
  return mesesEntre(ano + '-01', ultimo);
}

function avDescricaoPeriodo(meses) {
  if (!meses.length) return 'Período inválido';
  if (avModo === 'ano') return `Ano de ${avAno}` + (meses.length < 12 ? ` (${nomeMesShort(meses[0])} a ${nomeMesShort(meses[meses.length - 1])})` : '');
  if (meses.length === 1) return nomeMesLongo(meses[0]);
  return `${nomeMesShort(meses[0])} a ${nomeMesShort(meses[meses.length - 1])}`;
}

function avSetModo(modo) { avModo = modo; renderVisaoAnual(); }
function avMudarAno(delta) { avAno += delta; renderVisaoAnual(); }
function avSetMes(v) { if (v) { avMes = v; renderVisaoAnual(); } }
function avSetPeriodo() {
  const de = document.getElementById('av-de').value;
  const ate = document.getElementById('av-ate').value;
  if (de && ate && de <= ate) { avDe = de; avAte = ate; renderVisaoAnual(); }
}

function avCard(lbl, val, sub, cor, onclick) {
  return `<div class="stat-card stat-card-link" onclick="${onclick}"><div class="stat-lbl">${lbl}</div><div class="stat-val" style="${cor ? 'color:' + cor : ''}">${val}</div>${sub ? `<div class="stat-sub">${sub}</div>` : ''}</div>`;
}

function renderVisaoAnual() {
  const agora = mesAtual();
  if (avAno === null) avAno = Number(agora.slice(0, 4));
  if (!avMes) avMes = agora;
  if (!avDe) { avDe = agora.slice(0, 4) + '-01'; avAte = agora; }

  let meses = avMesesSelecionados();
  let dados = meses.map(metricasDoMes);
  // No ano, pula os meses do começo em que ainda não havia nada lançado.
  if (avModo === 'ano') {
    const vazio = (d) => !d.receita && !d.despesas && !d.iniciados && !d.ganhos && !d.clientesAtivos;
    while (dados.length > 1 && vazio(dados[0])) { dados.shift(); meses.shift(); }
  }
  const soma = (k) => dados.reduce((s, d) => s + d[k], 0);
  const ultimoMes = meses[meses.length - 1] || agora;
  const ultimo = dados[dados.length - 1];

  const receita = soma('receita'), despesas = soma('despesas'), lucro = soma('lucro'), impostos = soma('impostos');
  const margem = receita > 0 ? Math.round(lucro / receita * 100) : 0;
  const iniciados = soma('iniciados'), ganhos = soma('ganhos'), perdidos = soma('perdidos');
  // Conversão: dos prospects iniciados no período, quantos já viraram cliente.
  const deP = meses[0] + '-01', ateP = ultimoDiaDoMes(meses[meses.length - 1] || agora);
  const coorte = State.prospects.filter((p) => p.status !== 'indicado' && p.data_visita >= deP && p.data_visita <= ateP);
  const conversao = coorte.length ? Math.round(coorte.filter((p) => p.status === 'fechado').length / coorte.length * 100) : 0;
  const nMeses = Math.max(meses.length, 1);

  const el = document.getElementById('page-anual');
  el.innerHTML = `
    <div class="periodo-nav av-filtros">
      <div class="av-modos">
        ${[['ano', 'Ano'], ['mes', 'Mês'], ['periodo', 'Período']].map(([v, l]) => `<span class="pill ${avModo === v ? 'on' : ''}" onclick="avSetModo('${v}')">${l}</span>`).join('')}
      </div>
      ${avModo === 'ano' ? `
        <button class="periodo-btn" onclick="avMudarAno(-1)">‹</button>
        <div class="periodo-label">${avAno}</div>
        <button class="periodo-btn" onclick="avMudarAno(1)">›</button>` : ''}
      ${avModo === 'mes' ? `<input type="month" class="av-input" value="${avMes}" onchange="avSetMes(this.value)">` : ''}
      ${avModo === 'periodo' ? `
        <input type="month" class="av-input" id="av-de" value="${avDe}" onchange="avSetPeriodo()">
        <span style="color:var(--cinza-claro);font-size:12px;">até</span>
        <input type="month" class="av-input" id="av-ate" value="${avAte}" onchange="avSetPeriodo()">` : ''}
    </div>

    <div class="section">
      <div class="section-title">Financeiro · ${avDescricaoPeriodo(meses)}</div>
      <div class="card-grid-2" style="margin-bottom:14px;">
        ${avCard('Receita', fmtMoeda(receita), `média de ${fmtMoeda(receita / nMeses)}/mês`, 'var(--positivo)', `irPara('financeiro',{mes:'${ultimoMes}',tipo:'receita'})`)}
        ${avCard('Despesas', fmtMoeda(despesas), `média de ${fmtMoeda(despesas / nMeses)}/mês`, 'var(--negativo)', `irPara('financeiro',{mes:'${ultimoMes}',tipo:'despesa'})`)}
        ${avCard('Lucro líquido', fmtMoeda(lucro), `média de ${fmtMoeda(lucro / nMeses)}/mês`, lucro >= 0 ? 'var(--positivo)' : 'var(--negativo)', `irPara('dashboard-financeiro',{mes:'${ultimoMes}'})`)}
        ${avCard('Margem', margem + '%', `impostos: ${fmtMoeda(impostos)}`, '', `irPara('dashboard-financeiro',{mes:'${ultimoMes}'})`)}
      </div>
      ${meses.length > 1 ? `<div class="chart-box panel" style="margin-bottom:14px;">
        <div class="panel-title">Receita, despesas e lucro por mês</div>
        <div style="position:relative;height:200px;"><canvas id="av-chart-fin"></canvas></div>
      </div>` : ''}
      <div class="panel"><div class="tbl-wrap"><table class="tbl av-tbl">
        <tr><th>Mês</th><th>Receita</th><th>Despesas</th><th>Lucro</th><th>Margem</th></tr>
        ${dados.map((d) => `<tr class="av-linha" onclick="irPara('dashboard-financeiro',{mes:'${d.mes}'})">
          <td>${nomeMesShort(d.mes)}</td><td>${fmtMoeda(d.receita)}</td><td>${fmtMoeda(d.despesas)}</td>
          <td style="color:${d.lucro >= 0 ? 'var(--positivo)' : 'var(--negativo)'}">${fmtMoeda(d.lucro)}</td><td>${d.margem}%</td></tr>`).join('')}
      </table></div></div>
    </div>

    <div class="section">
      <div class="section-title">Comercial · ${avDescricaoPeriodo(meses)}</div>
      <div class="card-grid-2" style="margin-bottom:14px;">
        ${avCard('Prospects iniciados', iniciados, 'empresas diferentes (1º contato)', 'var(--blue)', `irPara('comercial')`)}
        ${avCard('Atendimentos', soma('atendimentos'), `${soma('indicacoesRecebidas')} indicações recebidas`, '', `irPara('comercial')`)}
        ${avCard('Ganhos', ganhos, fmtMoeda(soma('valorGanho')) + '/mês em contratos', 'var(--positivo)', `irPara('comercial',{ancora:'cm-sec-clientes'})`)}
        ${avCard('Perdidos', perdidos, fmtMoeda(soma('valorPerdido')) + '/mês em propostas', 'var(--negativo)', `irPara('comercial',{status:'descartado'})`)}
        ${avCard('Conversão', conversao + '%', `${coorte.filter((p) => p.status === 'fechado').length} de ${coorte.length} iniciados viraram cliente`, '', `irPara('dashboard-comercial',{mes:'${ultimoMes}'})`)}
        ${avCard('Cancelamentos', soma('encerrados'), 'contratos encerrados no período', soma('encerrados') ? 'var(--negativo)' : '', `irPara('comercial',{ancora:'cm-sec-churn'})`)}
        ${avCard('Clientes ativos', ultimo ? ultimo.clientesAtivos : 0, `no fim de ${nomeMesShort(ultimoMes)}`, 'var(--positivo)', `irPara('comercial',{ancora:'cm-sec-clientes'})`)}
        ${avCard('Receita recorrente', fmtMoeda(ultimo ? ultimo.mrr : 0) + '/mês', `contratos ativos no fim de ${nomeMesShort(ultimoMes)}`, '', `irPara('comercial',{ancora:'cm-sec-clientes'})`)}
      </div>
      <div class="panel"><div class="tbl-wrap"><table class="tbl av-tbl">
        <tr><th>Mês</th><th>Iniciados</th><th>Atend.</th><th>Ganhos</th><th>Perdidos</th><th>Cancel.</th><th>Ativos</th><th>MRR</th></tr>
        ${dados.map((d) => `<tr class="av-linha" onclick="irPara('dashboard-comercial',{mes:'${d.mes}'})">
          <td>${nomeMesShort(d.mes)}</td><td>${d.iniciados}</td><td>${d.atendimentos}</td><td>${d.ganhos}</td><td>${d.perdidos}</td>
          <td>${d.encerrados}</td><td>${d.clientesAtivos}</td><td>${fmtMoeda(d.mrr)}</td></tr>`).join('')}
      </table></div></div>
      <div class="panel-sub" style="margin-top:8px;">Toque num card pra abrir a tela correspondente, ou numa linha pra ver o dashboard daquele mês.</div>
    </div>
  `;

  Object.values(avCharts).forEach((c) => { try { c.destroy(); } catch (e) {} });
  avCharts = {};
  const canvas = document.getElementById('av-chart-fin');
  if (canvas) {
    avCharts.fin = new Chart(canvas, {
      data: {
        labels: meses.map(nomeMesShort),
        datasets: [
          { type: 'bar', label: 'Receita', data: dados.map((d) => d.receita), backgroundColor: '#3DD68C', borderRadius: 3 },
          { type: 'bar', label: 'Despesas', data: dados.map((d) => d.despesas), backgroundColor: '#FF6B81', borderRadius: 3 },
          { type: 'line', label: 'Lucro', data: dados.map((d) => d.lucro), borderColor: '#4DB8F2', backgroundColor: '#4DB8F2', tension: 0.3, pointRadius: 3 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: true, labels: { font: { size: 10 }, boxWidth: 10 } },
          datalabels: { display: false },
          tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmtMoeda(ctx.parsed.y)}` } },
        },
        scales: { x: { ticks: { font: { size: 10 } }, grid: { display: false } }, y: { ticks: { font: { size: 10 }, callback: (v) => fmtMoeda(v) }, grid: { color: 'rgba(255,255,255,0.05)' } } },
      },
    });
  }
}
