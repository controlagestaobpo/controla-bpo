let dcCharts = {};

function calcularFunilConversao() {
  const todos = prospectsAtendidos();
  const nC = todos.filter((p) => p.status === 'conversa').length;
  const nP = todos.filter((p) => p.status === 'proposta').length;
  const nF = todos.filter((p) => p.status === 'fechado').length;
  const nD = todos.filter((p) => p.status === 'descartado').length;
  const total = todos.length;
  const etapas = [
    { nome: 'Visita', valor: total },
    { nome: 'Conversa/Reunião', valor: nC + nP + nF },
    { nome: 'Proposta', valor: nP + nF },
    { nome: 'Fechado', valor: nF },
  ];
  const passos = [];
  for (let i = 1; i < etapas.length; i++) {
    const anterior = etapas[i - 1].valor;
    const atual = etapas[i].valor;
    passos.push({ de: etapas[i - 1].nome, para: etapas[i].nome, anterior, atual, pct: anterior > 0 ? Math.round(atual / anterior * 100) : 0 });
  }
  return { passos, descartados: nD, pctDescartados: total > 0 ? Math.round(nD / total * 100) : 0, total };
}

function corFunilPct(pct) {
  return pct >= 50 ? 'var(--positivo)' : pct >= 25 ? '#F5A623' : 'var(--negativo)';
}

function calcularOrigemClientes() {
  const porOrigem = {};
  State.clientesAtivos.forEach((c) => {
    const o = c.origem || 'não informado';
    porOrigem[o] = (porOrigem[o] || 0) + 1;
  });
  return Object.entries(porOrigem).map(([k, v]) => ({ nome: ORIGEM_LBL[k] || (k === 'não informado' ? 'Não informado' : k), valor: v }));
}

function gerarInsightComercial() {
  const segmentos = calcularTopSegmentos().filter((s) => s.v >= 1);
  if (!segmentos.length) return 'Cadastre prospects com segmento pra começar a ver insights aqui.';
  const top = segmentos[0];
  if (top.valor === 0) return `Nenhum segmento com conversão ainda. Foque em fechar os primeiros clientes de "${top.nome}" ou de outro nicho pra começar a enxergar padrão.`;
  return `Seu melhor segmento é <strong>${top.nome}</strong>, com ${top.valor}% de conversão (${top.f} de ${top.v}). Vale concentrar a prospecção nesse nicho.`;
}

function calcularPipelineDoMes(mes) {
  // Perdidos contam no mês em que o negócio foi dado como perdido (não no mês do 1º contato).
  const m = metricasDoMes(mes);
  const pipeline = prospectsPipeline();
  return {
    iniciados: m.iniciados,
    atendimentos: m.atendimentos,
    ganhos: m.ganhos,
    valorGanho: m.valorGanho,
    perdidos: m.perdidos,
    valorPerdido: m.valorPerdido,
    noPipeline: pipeline.length,
    valorPipeline: pipeline.reduce((s, p) => s + Number(p.ticket || 0), 0),
  };
}

function clientesNecessariosParaMeta() {
  const mes = mesAtual();
  const metaMes = metaEfetivaDoMes(mes);
  if (!metaMes) return null;
  const clientesAtivos = State.clientesAtivos.filter((c) => c.status === 'ativo');
  const ticketMedio = clientesAtivos.length ? clientesAtivos.reduce((s, c) => s + Number(c.ticket_mensal || 0), 0) / clientesAtivos.length : 0;
  if (ticketMedio <= 0) return null;
  return Math.ceil(metaMes.meta_receita / ticketMedio);
}

function renderDashboardComercial() {
  if (!State.periodo) State.periodo = mesAtual();
  const mesPipeline = State.periodo;
  const clientesAtivos = State.clientesAtivos.filter((c) => c.status === 'ativo');
  const pipeline = prospectsPipeline();
  const totalFechadosAllTime = State.clientesAtivos.length;
  const totalContatos = pipeline.length + totalFechadosAllTime;
  const taxaConversao = totalContatos > 0 ? Math.round(totalFechadosAllTime / totalContatos * 100) : 0;
  const valorFunil = pipeline.reduce((s, p) => s + (p.ticket || 0), 0);
  const metaClientes = clientesNecessariosParaMeta();
  const pipe = calcularPipelineDoMes(mesPipeline);

  const h = hj();
  const acoes = [];
  State.prospects.forEach((p) => {
    if (p.status === 'retomar' && p.retorno && p.retorno <= h) {
      acoes.push({ texto: `${p.empresa} — retomar contato`, tag: p.retorno < h ? `desde ${fmtD(p.retorno)}` : 'hoje' });
    } else if (p.deadline && p.deadline <= h && p.status !== 'fechado' && p.status !== 'descartado' && !prospectPausado(p)) {
      const atrasado = p.deadline < h;
      acoes.push({ texto: `${p.empresa} — ${p.proximo || 'próximo passo'}`, tag: atrasado ? `atrasado ${fmtD(p.deadline)}` : 'hoje' });
    }
  });
  const paraRetomar = prospectsParaRetomar();
  const ranking = rankingIndicadores();

  const funilConv = calcularFunilConversao();
  const indicacoes = State.clientesAtivos.filter((c) => c.origem === 'indicacao');
  const taxaIndicacoes = State.clientesAtivos.length > 0 ? Math.round(indicacoes.length / State.clientesAtivos.length * 100) : 0;

  const el = document.getElementById('page-dashboard-comercial');
  el.innerHTML = `
    ${htmlSeletorPeriodo()}
    <div class="dash-acoes">
      <button class="btn btn-primary" onclick="abrirEscolherProspect()">+ Novo atendimento</button>
    </div>
    <div class="section">
      <div class="section-title">Situação atual</div>
      <div class="card-grid-2" style="margin-bottom:14px;">
        <div class="stat-card stat-card-link" onclick="irPara('comercial',{ancora:'cm-sec-clientes'})"><div class="stat-lbl">Clientes ativos</div><div class="stat-val" style="color:var(--positivo)">${clientesAtivos.length}</div><div class="stat-sub">${metaClientes === null ? 'defina uma meta em Metas' : 'meta: ' + metaClientes + ' (p/ bater a meta de lucro)'}</div></div>
        <div class="stat-card stat-card-link" onclick="irPara('comercial')"><div class="stat-lbl">Prospects</div><div class="stat-val" style="color:var(--blue)">${pipeline.length}</div><div class="stat-sub">em negociação${pipeline.length ? ': ' + pipeline.slice(0, 3).map((p) => p.empresa).join(', ') + (pipeline.length > 3 ? '…' : '') : ''}${indicacoesAContatar().length ? ` · ${indicacoesAContatar().length} a contatar` : ''}${paraRetomar.length ? ` · ${paraRetomar.length} pra retomar (próx. ${fmtD(paraRetomar[0].retorno)})` : ''}</div></div>
        <div class="stat-card stat-card-link" onclick="irPara('anual')"><div class="stat-lbl">Taxa conversão</div><div class="stat-val">${taxaConversao}%</div><div class="stat-sub">desde o início</div></div>
        <div class="stat-card stat-card-link" onclick="irPara('comercial')"><div class="stat-lbl">Valor em funil</div><div class="stat-val">${fmtMoeda(valorFunil)}</div></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">${nomeMesLongo(mesPipeline)}</div>
      <div class="card-grid-2" style="margin-bottom:14px;">
        <div class="stat-card stat-card-link" onclick="irPara('comercial')"><div class="stat-lbl">Negócios iniciados</div><div class="stat-val" style="color:var(--blue)">${pipe.iniciados}</div><div class="stat-sub">${pipe.atendimentos} atendimento${pipe.atendimentos === 1 ? '' : 's'} no mês</div></div>
        <div class="stat-card stat-card-link" onclick="irPara('comercial')"><div class="stat-lbl">No pipeline (agora)</div><div class="stat-val">${pipe.noPipeline}</div><div class="stat-sub">${fmtMoeda(pipe.valorPipeline)}</div></div>
        <div class="stat-card stat-card-link" onclick="irPara('comercial',{ancora:'cm-sec-clientes'})"><div class="stat-lbl">Ganhos</div><div class="stat-val" style="color:var(--positivo)">${pipe.ganhos}</div><div class="stat-sub">${fmtMoeda(pipe.valorGanho)}</div></div>
        <div class="stat-card stat-card-link" onclick="irPara('comercial',{status:'descartado'})"><div class="stat-lbl">Perdidos</div><div class="stat-val" style="color:var(--negativo)">${pipe.perdidos}</div><div class="stat-sub">${fmtMoeda(pipe.valorPerdido)}</div></div>
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
      <div class="section-title">Funil e segmentos</div>
      <div class="chart-row">
        <div class="chart-box panel">
          <div class="panel-title">Funil de conversão</div>
          <div class="panel-sub">Todos os prospects já cadastrados</div>
          <div style="position:relative;height:170px;"><canvas id="db-chart-funil"></canvas></div>
        </div>
        <div class="chart-box panel">
          <div class="panel-title">Top segmentos</div>
          <div class="panel-sub">Conversão por segmento (mín. 1 prospect)</div>
          <div style="position:relative;height:170px;"><canvas id="db-chart-segmentos"></canvas></div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Onde você está perdendo prospects</div>
      <div class="panel">
        ${funilConv.total === 0 ? '<div class="empty-state">Cadastre prospects pra ver a taxa de conversão entre etapas.</div>' : `
          ${funilConv.passos.map((p) => `
            <div class="funil-step">
              <div class="funil-step-lbl">${p.de} → ${p.para}</div>
              <div class="funil-step-bar-wrap"><div class="funil-step-bar" style="width:${p.pct}%;background:${corFunilPct(p.pct)}"></div></div>
              <div class="funil-step-pct" style="color:${corFunilPct(p.pct)}">${p.pct}% <span style="font-weight:500;color:var(--cinza-claro);">(${p.atual}/${p.anterior})</span></div>
            </div>
          `).join('')}
          ${funilConv.descartados > 0 ? `<div class="funil-step-perda">${funilConv.descartados} prospect${funilConv.descartados === 1 ? '' : 's'} descartado${funilConv.descartados === 1 ? '' : 's'} (${funilConv.pctDescartados}% do total cadastrado)</div>` : ''}
        `}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Origem dos clientes</div>
      <div class="card-grid-2" style="margin-bottom:10px;">
        <div class="stat-card"><div class="stat-lbl">Total indicações</div><div class="stat-val">${indicacoes.length}</div></div>
        <div class="stat-card"><div class="stat-lbl">Taxa de indicações</div><div class="stat-val">${taxaIndicacoes}%</div><div class="stat-sub">dos clientes</div></div>
      </div>
      <div class="chart-box panel" id="cm-origem-wrap">
        <div style="position:relative;height:170px;"><canvas id="cm-chart-origem"></canvas></div>
      </div>
      <div class="panel" style="margin-top:10px;">
        <div class="panel-title">Quem mais indica</div>
        ${ranking.length ? ranking.map((r) => `<div class="ranking-row">
          <div><div style="font-size:13px;font-weight:700;">${r.nome}</div><div style="font-size:11px;color:var(--cinza-claro);">${r.indicados.join(', ')}</div></div>
          <div style="text-align:right;white-space:nowrap;"><div style="font-size:15px;font-weight:800;">${r.indicados.length}</div><div style="font-size:10px;color:var(--positivo);">${r.fechados} fechou</div></div>
        </div>`).join('') : '<div class="empty-state" style="padding:12px;">Quando você cadastrar um prospect com origem "Indicação" e informar quem indicou, o ranking aparece aqui.</div>'}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Insights</div>
      <div class="panel" style="border-left:4px solid var(--purple);">
        <div style="font-size:12px;color:var(--text2);line-height:1.6;">${gerarInsightComercial()}</div>
      </div>
    </div>
  `;

  renderGraficosDashboardComercial();
}

function renderGraficosDashboardComercial() {
  Object.values(dcCharts).forEach((c) => { try { c.destroy(); } catch (e) {} });
  dcCharts = {};

  const funil = calcularFunil();
  const canvasFunil = document.getElementById('db-chart-funil');
  if (funil[0].valor > 0) {
    dcCharts.funil = fnBarChartOrdem(canvasFunil, funil, CORES_CATEGORIA);
  } else {
    canvasFunil.parentElement.innerHTML = '<div class="empty-state">Nenhum prospect cadastrado ainda.</div>';
  }

  const segmentos = calcularTopSegmentos();
  const canvasSegmentos = document.getElementById('db-chart-segmentos');
  if (segmentos.length) {
    dcCharts.segmentos = fnBarChartOrdem(canvasSegmentos, segmentos, '#9B7BF0', '%');
  } else {
    canvasSegmentos.parentElement.innerHTML = '<div class="empty-state">Cadastre prospects com segmento pra ver este gráfico.</div>';
  }

  const origem = calcularOrigemClientes();
  const canvasOrigem = document.getElementById('cm-chart-origem');
  if (origem.length) {
    const totalOrigem = origem.reduce((s, o) => s + o.valor, 0);
    dcCharts.origem = new Chart(canvasOrigem, {
      type: 'doughnut',
      data: { labels: origem.map((o) => o.nome), datasets: [{ data: origem.map((o) => o.valor), backgroundColor: CORES_CATEGORIA }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 10 } },
          datalabels: { color: '#001438', font: { weight: '700', size: 11 }, anchor: 'center', align: 'center', formatter: (v) => Math.round(v / totalOrigem * 100) + '%' },
        },
      },
    });
  } else {
    canvasOrigem.parentElement.innerHTML = '<div class="empty-state">Feche clientes pra ver a origem deles aqui.</div>';
  }
}
