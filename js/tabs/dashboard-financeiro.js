let dfCharts = {};

function calcularReceitaVsMeta(mes) {
  const dre = montarDRE(mes);
  const metaSalva = State.metasFinanceiras.find((m) => m.mes === mes);
  const meta = metaSalva ? metaSalva.meta_receita : State.metas.mm_fat;
  return { atual: dre.receitaTotal, meta };
}

function calcularEvolucaoTicketMedio(nMeses) {
  const meses = [];
  for (let i = nMeses - 1; i >= 0; i--) meses.push(mesesAtras(i));
  return meses.map((m) => {
    const receitasMes = State.receitas.filter((r) => r.mes_projecao === m && r.status === 'ativa' && r.cliente_id);
    if (!receitasMes.length) return { mes: m, ticket: 0 };
    const porCliente = {};
    receitasMes.forEach((r) => { porCliente[r.cliente_id] = (porCliente[r.cliente_id] || 0) + Number(r.valor || 0); });
    const valores = Object.values(porCliente);
    return { mes: m, ticket: valores.reduce((s, v) => s + v, 0) / valores.length };
  });
}

function gerarInsightsFinanceiro(mes) {
  const dre = montarDRE(mes);
  const drePassado = montarDRE(somarMes(mes, -1));
  const insights = [];

  if (mes === mesAtual()) {
    const projecao = projecaoFimDeMes(dre.receitaTotal, mes);
    const { meta } = calcularReceitaVsMeta(mes);
    if (meta > 0) {
      insights.push(projecao >= meta
        ? `No ritmo atual, você deve fechar o mês em ${fmtMoeda(projecao)} — acima da meta de ${fmtMoeda(meta)}.`
        : `No ritmo atual, você deve fechar o mês em ${fmtMoeda(projecao)} — abaixo da meta de ${fmtMoeda(meta)}. Faltam ${fmtMoeda(Math.max(meta - projecao, 0))}.`);
    }
  }

  const despesaAtual = dre.deducoes + dre.totalDespesasOperacionais;
  const despesaPassada = drePassado.deducoes + drePassado.totalDespesasOperacionais;
  if (despesaPassada > 0) {
    const variacao = Math.round((despesaAtual - despesaPassada) / despesaPassada * 100);
    if (variacao > 10) insights.push(`Despesas subiram ${variacao}% em relação ao mês anterior — vale revisar.`);
    else if (variacao < -10) insights.push(`Despesas caíram ${Math.abs(variacao)}% em relação ao mês anterior.`);
  }

  if (!insights.length) insights.push('Lance receitas e despesas por alguns meses pra começar a ver tendências aqui.');
  return insights;
}

function renderDashboardFinanceiro() {
  if (!State.periodo) State.periodo = mesAtual();
  const mes = State.periodo;
  const dre = montarDRE(mes);
  const despesaTotalMes = dre.deducoes + dre.totalDespesasOperacionais;
  const projecaoMes = projecaoFimDeMes(dre.receitaTotal, mes);
  const projecaoLabel = mes === mesAtual() ? 'Projeção (fim do mês)' : (mes < mesAtual() ? 'Total do mês' : 'Projeção do mês');

  const el = document.getElementById('page-dashboard-financeiro');
  el.innerHTML = `
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

    <div class="section">
      <div class="section-title">Insights</div>
      <div class="panel" style="border-left:4px solid var(--blue);">
        ${gerarInsightsFinanceiro(mes).map((i) => `<div style="font-size:12px;color:var(--text2);line-height:1.7;">• ${i}</div>`).join('')}
      </div>
    </div>

    <div class="section">
      <div class="section-title">DRE do mês</div>
      <div class="panel" id="db-dre"></div>
    </div>

    <div class="section">
      <div class="section-title">Entradas e saídas por categoria</div>
      <div class="chart-row">
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
    </div>

    <div class="section">
      <div class="section-title">Receita vs. meta do mês</div>
      <div class="chart-box panel">
        <div style="position:relative;height:160px;"><canvas id="fn-chart-meta"></canvas></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Evolução do ticket médio</div>
      <div class="chart-box panel">
        <div class="panel-sub">Últimos 12 meses</div>
        <div style="position:relative;height:200px;"><canvas id="fn-chart-ticket"></canvas></div>
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
  renderGraficosDashboardFinanceiro(mes, dre);
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

function renderGraficosDashboardFinanceiro(mes, dre) {
  Object.values(dfCharts).forEach((c) => { try { c.destroy(); } catch (e) {} });
  dfCharts = {};

  const todasDespesas = [...dre.grupos.deducao, ...GRUPO_DRE_ORDEM.flatMap((g) => dre.grupos[g])];
  const canvasDespesas = document.getElementById('db-chart-despesas');
  if (todasDespesas.length) {
    dfCharts.despesas = fnBarChartOrdenado(canvasDespesas, todasDespesas, CORES_CATEGORIA);
  } else {
    canvasDespesas.parentElement.innerHTML = '<div class="empty-state">Nenhuma despesa lançada em ' + nomeMesLongo(mes) + '.</div>';
  }

  const todasReceitas = [...dre.receitaOperacionalDetalhe, ...dre.receitaNaoOperacionalDetalhe];
  const canvasReceitas = document.getElementById('db-chart-receitas');
  if (todasReceitas.length) {
    dfCharts.receitas = fnBarChartOrdenado(canvasReceitas, todasReceitas, '#3DD68C');
  } else {
    canvasReceitas.parentElement.innerHTML = '<div class="empty-state">Nenhuma receita lançada em ' + nomeMesLongo(mes) + '.</div>';
  }

  const { atual, meta } = calcularReceitaVsMeta(mes);
  const canvasMeta = document.getElementById('fn-chart-meta');
  if (meta > 0 || atual > 0) {
    dfCharts.meta = new Chart(canvasMeta, {
      type: 'bar',
      data: { labels: ['Atual', 'Meta'], datasets: [{ data: [atual, meta], backgroundColor: [atual >= meta && meta > 0 ? '#3DD68C' : '#4DB8F2', '#A9B8CF'], borderRadius: 4 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { font: { size: 10 } } }, y: { ticks: { font: { size: 11 } } } } },
    });
  } else {
    canvasMeta.parentElement.innerHTML = '<div class="empty-state">Defina uma meta em Configurações ou na aba Metas pra ver a comparação.</div>';
  }

  const evolucao = calcularEvolucaoTicketMedio(12);
  const canvasTicket = document.getElementById('fn-chart-ticket');
  if (evolucao.some((e) => e.ticket > 0)) {
    dfCharts.ticket = new Chart(canvasTicket, {
      type: 'line',
      data: {
        labels: evolucao.map((e) => nomeMesShort(e.mes)),
        datasets: [{ data: evolucao.map((e) => Math.round(e.ticket)), borderColor: '#9B7BF0', backgroundColor: 'rgba(155,123,240,0.15)', fill: true, tension: 0.3, pointRadius: 3 }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { font: { size: 10 } } }, y: { beginAtZero: true, ticks: { font: { size: 10 } } } } },
    });
  } else {
    canvasTicket.parentElement.innerHTML = '<div class="empty-state">Ainda não há receita vinculada a clientes nos últimos 12 meses.</div>';
  }

  const crescimento = calcularCrescimento(6);
  const canvasCrescimento = document.getElementById('db-chart-crescimento');
  if (crescimento.some((c) => c.receita > 0)) {
    dfCharts.crescimento = new Chart(canvasCrescimento, {
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
