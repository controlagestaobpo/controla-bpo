let dbCharts = {};

function renderDashboard() {
  const clientesAtivos = State.clientesAtivos.filter((c) => c.status === 'ativo');
  const pipeline = prospectsPipeline ? prospectsPipeline() : State.prospects.filter((p) => p.status !== 'fechado' && p.status !== 'descartado');
  const totalFechadosAllTime = State.clientesAtivos.length;
  const totalContatos = pipeline.length + totalFechadosAllTime;
  const taxaConversao = totalContatos > 0 ? Math.round(totalFechadosAllTime / totalContatos * 100) : 0;
  const valorFunil = pipeline.reduce((s, p) => s + (p.ticket || 0), 0);

  if (!State.periodo) State.periodo = mesAtual();
  const mes = State.periodo;
  const dre = montarDRE(mes);
  const despesaTotalMes = dre.deducoes + dre.totalDespesasOperacionais;
  const projecaoMes = projecaoFimDeMes(dre.receitaTotal, mes);
  const projecaoLabel = mes === mesAtual() ? 'Projeção (fim do mês)' : (mes < mesAtual() ? 'Total do mês' : 'Projeção do mês');

  const h = hj();
  const acoes = [];
  State.prospects.forEach((p) => {
    if (p.deadline && p.deadline <= h && p.status !== 'fechado' && p.status !== 'descartado') {
      const atrasado = p.deadline < h;
      acoes.push({ texto: `${p.empresa} — ${p.proximo || 'próximo passo'}`, tag: atrasado ? `atrasado ${fmtD(p.deadline)}` : 'hoje' });
    }
  });

  const el = document.getElementById('page-dashboard');
  el.innerHTML = `
    <div class="section">
      <div class="section-title">Resumo comercial</div>
      <div class="card-grid-2" style="margin-bottom:14px;">
        <div class="stat-card"><div class="stat-lbl">Clientes ativos</div><div class="stat-val" style="color:var(--positivo)">${clientesAtivos.length}</div><div class="stat-sub">meta: ${State.metas.sm_clientes}</div></div>
        <div class="stat-card"><div class="stat-lbl">Prospects</div><div class="stat-val" style="color:var(--blue)">${pipeline.length}</div><div class="stat-sub">em funil</div></div>
        <div class="stat-card"><div class="stat-lbl">Taxa conversão</div><div class="stat-val">${taxaConversao}%</div></div>
        <div class="stat-card"><div class="stat-lbl">Valor em funil</div><div class="stat-val">${fmtMoeda(valorFunil)}</div></div>
      </div>
    </div>

    ${htmlSeletorPeriodo()}

    <div class="section">
      <div class="section-title">Resumo financeiro</div>
      <div class="card-grid-2" style="margin-bottom:14px;">
        <div class="stat-card"><div class="stat-lbl">Receita</div><div class="stat-val" style="color:var(--positivo)">${fmtMoeda(dre.receitaTotal)}</div><div class="stat-sub">meta: ${fmtMoeda(State.metas.mm_fat)}</div></div>
        <div class="stat-card"><div class="stat-lbl">Despesas</div><div class="stat-val" style="color:var(--negativo)">${fmtMoeda(despesaTotalMes)}</div></div>
        <div class="stat-card"><div class="stat-lbl">Lucro líquido</div><div class="stat-val" style="color:${dre.lucroLiquido >= 0 ? 'var(--positivo)' : 'var(--negativo)'}">${fmtMoeda(dre.lucroLiquido)}</div></div>
        <div class="stat-card"><div class="stat-lbl">Margem</div><div class="stat-val">${dre.margem}%</div></div>
        <div class="stat-card" style="grid-column:1/-1;"><div class="stat-lbl">${projecaoLabel}</div><div class="stat-val">${fmtMoeda(projecaoMes)}</div><div class="stat-sub">no ritmo atual de faturamento</div></div>
      </div>
    </div>

    ${acoes.length ? `
    <div class="section">
      <div class="section-title" style="color:var(--negativo);">Ações imediatas</div>
      <div class="panel" style="border-left:4px solid var(--negativo);">
        ${acoes.map((a) => `<div style="display:flex;justify-content:space-between;gap:8px;padding:5px 0;font-size:12px;"><span>${a.texto}</span><span class="badge badge-red">${a.tag}</span></div>`).join('')}
      </div>
    </div>` : ''}

    <div class="section">
      <div class="section-title">DRE do mês</div>
      <div class="panel" id="db-dre"></div>
    </div>

    <div class="section">
      <div class="section-title">Entradas e saídas por categoria</div>
      <div class="chart-box panel">
        <div class="panel-title">Saídas por categoria</div>
        <div class="panel-sub">Despesas de ${nomeMesLongo(mes)}, do maior para o menor</div>
        <div style="position:relative;height:260px;"><canvas id="db-chart-despesas"></canvas></div>
      </div>
      <div class="chart-box panel">
        <div class="panel-title">Entradas por categoria</div>
        <div class="panel-sub">Receitas de ${nomeMesLongo(mes)}, do maior para o menor</div>
        <div style="position:relative;height:260px;"><canvas id="db-chart-receitas"></canvas></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Funil de conversão</div>
      <div class="chart-box panel">
        <div class="panel-sub">Todos os prospects já cadastrados</div>
        <div style="position:relative;height:200px;"><canvas id="db-chart-funil"></canvas></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Top segmentos</div>
      <div class="chart-box panel">
        <div class="panel-sub">Taxa de conversão por segmento (mín. 1 prospect)</div>
        <div style="position:relative;height:200px;"><canvas id="db-chart-segmentos"></canvas></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Crescimento</div>
      <div class="chart-box panel">
        <div class="panel-sub">Receita bruta dos últimos 6 meses</div>
        <div style="position:relative;height:220px;"><canvas id="db-chart-crescimento"></canvas></div>
      </div>
    </div>
  `;
  renderDreTabelaDashboard(dre);
  renderGraficosDashboard(mes, dre);
}

function renderDreTabelaDashboard(dre) {
  const el = document.getElementById('db-dre');
  const linhaDetalhe = (it) => `<tr><td style="padding-left:22px;color:var(--text3);font-size:11px;">· ${it.nome}</td><td style="text-align:right;color:var(--text3);font-size:11px;">${fmtMoeda2(it.total)}</td></tr>`;

  const linhaGrupoDespesa = (grupo) => {
    const total = dre.despPorGrupo[grupo];
    if (total === 0) return '';
    return `<tr><td>(−) ${GRUPO_DRE_LABELS[grupo]}</td><td style="text-align:right;">${fmtMoeda2(total)}</td></tr>${dre.grupos[grupo].map(linhaDetalhe).join('')}`;
  };
  const linhaDeducao = dre.deducoes > 0
    ? `<tr><td>(−) Impostos sobre serviço</td><td style="text-align:right;">${fmtMoeda2(dre.deducoes)}</td></tr>${dre.grupos.deducao.map(linhaDetalhe).join('')}`
    : '';
  const linhaNaoOperacional = dre.receitaNaoOperacional > 0
    ? `<tr><td>(+) Outras receitas</td><td style="text-align:right;">${fmtMoeda2(dre.receitaNaoOperacional)}</td></tr>${dre.receitaNaoOperacionalDetalhe.map(linhaDetalhe).join('')}`
    : '';

  el.innerHTML = `<div class="tbl-wrap"><table class="tbl">
    <tr><td><strong>Receita operacional</strong></td><td style="text-align:right;"><strong>${fmtMoeda2(dre.receitaOperacional)}</strong></td></tr>
    ${dre.receitaOperacionalDetalhe.map(linhaDetalhe).join('')}
    ${linhaDeducao}
    <tr style="border-top:1.5px solid var(--border);"><td>Receita operacional líquida</td><td style="text-align:right;">${fmtMoeda2(dre.receitaLiquidaOperacional)}</td></tr>
    ${GRUPO_DRE_ORDEM.map(linhaGrupoDespesa).join('')}
    <tr style="border-top:1.5px solid var(--border);"><td>Resultado operacional</td><td style="text-align:right;">${fmtMoeda2(dre.resultadoOperacional)}</td></tr>
    ${linhaNaoOperacional}
    <tr style="border-top:1.5px solid var(--border);"><td><strong>Lucro líquido</strong></td><td style="text-align:right;"><strong style="color:${dre.lucroLiquido >= 0 ? 'var(--positivo)' : 'var(--negativo)'}">${fmtMoeda2(dre.lucroLiquido)}</strong></td></tr>
    <tr><td style="color:var(--text3);font-size:11px;">margem de ${dre.margem}%</td><td></td></tr>
  </table></div>`;
}

function fnBarChartOrdenado(canvas, itens, corBase) {
  const ordenado = [...itens].sort((a, b) => b.total - a.total);
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ordenado.map((c) => c.nome),
      datasets: [{ data: ordenado.map((c) => c.total), backgroundColor: corBase, borderRadius: 4 }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { font: { size: 10 }, color: '#A9B8CF' }, grid: { color: 'rgba(255,255,255,0.06)' } },
        y: { ticks: { font: { size: 10 }, color: '#A9B8CF' } },
      },
    },
  });
}

function calcularFunil() {
  const todos = State.prospects;
  const nC = todos.filter((p) => p.status === 'conversa').length;
  const nP = todos.filter((p) => p.status === 'proposta').length;
  const nF = todos.filter((p) => p.status === 'fechado').length;
  return [
    { nome: 'Visitas totais', valor: todos.length, cor: '#4DB8F2' },
    { nome: 'Chegaram em conversa', valor: nC + nP + nF, cor: '#F5A623' },
    { nome: 'Propostas enviadas', valor: nP + nF, cor: '#9B7BF0' },
    { nome: 'Clientes fechados', valor: nF, cor: '#3DD68C' },
  ];
}

function calcularTopSegmentos() {
  const porNicho = {};
  State.prospects.forEach((p) => {
    if (!p.nicho) return;
    if (!porNicho[p.nicho]) porNicho[p.nicho] = { v: 0, f: 0 };
    porNicho[p.nicho].v += 1;
    if (p.status === 'fechado') porNicho[p.nicho].f += 1;
  });
  return Object.entries(porNicho)
    .map(([nome, d]) => ({ nome, valor: d.v > 0 ? Math.round(d.f / d.v * 100) : 0, v: d.v, f: d.f }))
    .sort((a, b) => b.valor - a.valor || b.f - a.f)
    .slice(0, 6);
}

function calcularCrescimento(nMeses) {
  const meses = [];
  for (let i = nMeses - 1; i >= 0; i--) meses.push(mesesAtras(i));
  return meses.map((m) => ({ mes: m, receita: montarDRE(m).receitaTotal }));
}

function fnBarChartOrdem(canvas, itens, cores, sufixo) {
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: itens.map((c) => c.nome),
      datasets: [{ data: itens.map((c) => c.valor), backgroundColor: itens.every((c) => c.cor) ? itens.map((c) => c.cor) : cores, borderRadius: 4 }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ctx.parsed.x + (sufixo || '') } },
      },
      scales: {
        x: { beginAtZero: true, ticks: { font: { size: 10 }, color: '#A9B8CF', callback: (v) => v + (sufixo || '') }, grid: { color: 'rgba(255,255,255,0.06)' } },
        y: { ticks: { font: { size: 10 }, color: '#A9B8CF' } },
      },
    },
  });
}

function renderGraficosDashboard(mes, dre) {
  Object.values(dbCharts).forEach((c) => { try { c.destroy(); } catch (e) {} });
  dbCharts = {};

  const todasDespesas = [...dre.grupos.deducao, ...GRUPO_DRE_ORDEM.flatMap((g) => dre.grupos[g])];
  const canvasDespesas = document.getElementById('db-chart-despesas');
  if (todasDespesas.length) {
    dbCharts.despesas = fnBarChartOrdenado(canvasDespesas, todasDespesas, CORES_CATEGORIA);
  } else {
    canvasDespesas.parentElement.innerHTML = '<div class="empty-state">Nenhuma despesa lançada em ' + nomeMesLongo(mes) + '.</div>';
  }

  const todasReceitas = [...dre.receitaOperacionalDetalhe, ...dre.receitaNaoOperacionalDetalhe];
  const canvasReceitas = document.getElementById('db-chart-receitas');
  if (todasReceitas.length) {
    dbCharts.receitas = fnBarChartOrdenado(canvasReceitas, todasReceitas, '#3DD68C');
  } else {
    canvasReceitas.parentElement.innerHTML = '<div class="empty-state">Nenhuma receita lançada em ' + nomeMesLongo(mes) + '.</div>';
  }

  const funil = calcularFunil();
  const canvasFunil = document.getElementById('db-chart-funil');
  if (funil[0].valor > 0) {
    dbCharts.funil = fnBarChartOrdem(canvasFunil, funil, CORES_CATEGORIA);
  } else {
    canvasFunil.parentElement.innerHTML = '<div class="empty-state">Nenhum prospect cadastrado ainda.</div>';
  }

  const segmentos = calcularTopSegmentos();
  const canvasSegmentos = document.getElementById('db-chart-segmentos');
  if (segmentos.length) {
    dbCharts.segmentos = fnBarChartOrdem(canvasSegmentos, segmentos, '#9B7BF0', '%');
  } else {
    canvasSegmentos.parentElement.innerHTML = '<div class="empty-state">Cadastre prospects com segmento pra ver este gráfico.</div>';
  }

  const crescimento = calcularCrescimento(6);
  const canvasCrescimento = document.getElementById('db-chart-crescimento');
  if (crescimento.some((c) => c.receita > 0)) {
    dbCharts.crescimento = new Chart(canvasCrescimento, {
      type: 'bar',
      data: {
        labels: crescimento.map((c) => nomeMesShort(c.mes)),
        datasets: [{ data: crescimento.map((c) => c.receita), backgroundColor: '#4DB8F2', borderRadius: 4 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { font: { size: 10 }, color: '#A9B8CF' }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { font: { size: 10 }, color: '#A9B8CF' }, grid: { color: 'rgba(255,255,255,0.06)' } },
        },
      },
    });
  } else {
    canvasCrescimento.parentElement.innerHTML = '<div class="empty-state">Ainda não há receita lançada nos últimos 6 meses.</div>';
  }
}
