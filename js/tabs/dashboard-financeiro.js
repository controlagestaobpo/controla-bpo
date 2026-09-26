let dfCharts = {};

function calcularReceitaVsMeta(mes) {
  const dre = montarDRE(mes);
  const metaSalva = metaEfetivaDoMes(mes);
  const meta = metaSalva ? metaSalva.meta_receita : 0;
  return { atual: dre.receitaTotal, meta };
}

function calcularLucroVsMeta(mes) {
  const dre = montarDRE(mes);
  const metaSalva = metaEfetivaDoMes(mes);
  const meta = metaSalva ? metaSalva.meta_lucro : 0;
  const pct = meta > 0 ? Math.max(0, Math.min(100, Math.round(dre.lucroLiquido / meta * 100))) : null;
  return { atual: dre.lucroLiquido, meta, pct };
}

function calcularEvolucaoTicketMedio(nMeses) {
  const meses = [];
  for (let i = nMeses - 1; i >= 0; i--) meses.push(mesesAtras(i));
  return meses.map((m) => {
    const receitasMes = State.receitas.filter((r) => r.status === 'ativa' && r.recebido && r.cliente_id && (r.data_recebimento || '').slice(0, 7) === m);
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

function calcularPontoEquilibrio(mes, ticketOverride) {
  const despesasMes = State.despesas.filter((d) => d.mes_projecao === mes);
  const despesasTotais = despesasMes.reduce((s, d) => s + Number(d.valor || 0), 0);
  const clientesAtivos = State.clientesAtivos.filter((c) => c.status === 'ativo');
  const ticketMedioReal = clientesAtivos.length ? clientesAtivos.reduce((s, c) => s + Number(c.ticket_mensal || 0), 0) / clientesAtivos.length : 0;
  const ticket = ticketOverride > 0 ? ticketOverride : ticketMedioReal;
  const clientesNecessarios = ticket > 0 ? Math.ceil(despesasTotais / ticket) : null;
  const dre = montarDRE(mes);
  const faltam = Math.max(despesasTotais - dre.receitaTotal, 0);
  return { despesasTotais, ticketMedioReal, ticket, clientesNecessarios, receitaAtual: dre.receitaTotal, faltam, atingido: dre.receitaTotal >= despesasTotais };
}

function fnRecalcularPontoEquilibrio() {
  const override = parseFloat(document.getElementById('pe-ticket').value) || 0;
  const pe = calcularPontoEquilibrio(State.periodo, override);
  document.getElementById('pe-clientes').textContent = pe.clientesNecessarios === null ? '-' : pe.clientesNecessarios;
}

// Projeção de fechamento: e se tudo que já está lançado (recebido ou não) acontecer?
function calcularProjecaoFechamento(mes) {
  const resumo = calcularResumoContas(mes);
  const receitaPrevista = resumo.totalReceber + resumo.totalRecebido;
  const despesaPrevista = resumo.totalPagar + resumo.totalPago;
  return {
    receitaPrevista, despesaPrevista,
    lucroPrevisto: receitaPrevista - despesaPrevista,
    margemPrevista: receitaPrevista > 0 ? Math.round((receitaPrevista - despesaPrevista) / receitaPrevista * 100) : 0,
  };
}

function svgVelocimetro(pct) {
  if (pct === null) {
    return `<div class="empty-state" style="padding:20px 16px;">Defina uma meta de lucro líquido na aba Metas pra ver a velocidade até ela.</div>`;
  }
  const p = Math.max(0, Math.min(100, pct));
  const cx = 100, cy = 100, r = 78, L = 60;
  const rad = (deg) => deg * Math.PI / 180;
  const pt = (deg, radius) => [cx + radius * Math.cos(rad(deg)), cy - radius * Math.sin(rad(deg))];
  const [x180, y180] = pt(180, r), [x120, y120] = pt(120, r), [x60, y60] = pt(60, r), [x0, y0] = pt(0, r);
  const anguloAgulha = 180 - (p / 100) * 180;
  const [xN, yN] = pt(anguloAgulha, L);
  const corPct = p >= 66 ? '#3DD68C' : p >= 33 ? '#F5A623' : '#FF6B81';
  return `
    <svg viewBox="0 0 200 145" style="width:100%;max-width:220px;display:block;margin:0 auto;">
      <path d="M${x180},${y180} A${r},${r} 0 0,1 ${x120},${y120}" fill="none" stroke="#FF6B81" stroke-width="14" stroke-linecap="round"/>
      <path d="M${x120},${y120} A${r},${r} 0 0,1 ${x60},${y60}" fill="none" stroke="#F5A623" stroke-width="14" stroke-linecap="round"/>
      <path d="M${x60},${y60} A${r},${r} 0 0,1 ${x0},${y0}" fill="none" stroke="#3DD68C" stroke-width="14" stroke-linecap="round"/>
      <line x1="${cx}" y1="${cy}" x2="${xN}" y2="${yN}" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${cy}" r="6" fill="#FFFFFF"/>
      <text x="${cx}" y="${cy + 26}" text-anchor="middle" font-size="22" font-weight="800" fill="${corPct}" font-family="Montserrat, sans-serif">${p}%</text>
    </svg>
  `;
}

function renderDashboardFinanceiro() {
  if (!State.periodo) State.periodo = mesAtual();
  const mes = State.periodo;
  const dre = montarDRE(mes);
  const despesaTotalMes = dre.deducoes + dre.totalDespesasOperacionais;
  const projecaoMes = projecaoFimDeMes(dre.receitaTotal, mes);
  const projecaoLabel = mes === mesAtual() ? 'Projeção (fim do mês)' : (mes < mesAtual() ? 'Total do mês' : 'Projeção do mês');
  const metaMes = metaEfetivaDoMes(mes);
  const lucroVsMeta = calcularLucroVsMeta(mes);
  const pe = calcularPontoEquilibrio(mes);
  const proj = calcularProjecaoFechamento(mes);

  const el = document.getElementById('page-dashboard-financeiro');
  el.innerHTML = `
    ${htmlSeletorPeriodo()}

    <div class="section">
      <div class="section-title">Resumo financeiro</div>
      <div class="card-grid-2" style="margin-bottom:14px;">
        <div class="stat-card"><div class="stat-lbl">Receita</div><div class="stat-val" style="color:var(--positivo)">${fmtMoeda(dre.receitaTotal)}</div><div class="stat-sub">${metaMes ? 'meta: ' + fmtMoeda(metaMes.meta_receita) : 'defina uma meta em Metas'}</div></div>
        <div class="stat-card"><div class="stat-lbl">Despesas</div><div class="stat-val" style="color:var(--negativo)">${fmtMoeda(despesaTotalMes)}</div></div>
        <div class="stat-card"><div class="stat-lbl">Lucro líquido</div><div class="stat-val" style="color:${dre.lucroLiquido >= 0 ? 'var(--positivo)' : 'var(--negativo)'}">${fmtMoeda(dre.lucroLiquido)}</div><div class="stat-sub">${metaMes ? 'meta: ' + fmtMoeda(metaMes.meta_lucro) : 'defina uma meta em Metas'}</div></div>
        <div class="stat-card"><div class="stat-lbl">Margem</div><div class="stat-val">${dre.margem}%</div></div>
        <div class="stat-card"><div class="stat-lbl">${projecaoLabel}</div><div class="stat-val">${fmtMoeda(projecaoMes)}</div><div class="stat-sub">no ritmo atual</div></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Projeção de fechamento do mês</div>
      <div class="panel" style="border-left:4px solid var(--purple);">
        <div class="panel-sub" style="margin-top:0;">Se todas as contas já lançadas com vencimento em ${nomeMesLongo(mes)} forem recebidas e pagas</div>
        <div class="card-grid-2" style="margin-bottom:0;">
          <div class="stat-card"><div class="stat-lbl">Receita prevista</div><div class="stat-val" style="color:var(--positivo);font-size:18px;">${fmtMoeda(proj.receitaPrevista)}</div></div>
          <div class="stat-card"><div class="stat-lbl">Despesas previstas</div><div class="stat-val" style="color:var(--negativo);font-size:18px;">${fmtMoeda(proj.despesaPrevista)}</div></div>
          <div class="stat-card" style="grid-column:1/-1;"><div class="stat-lbl">Lucro líquido previsto</div><div class="stat-val" style="color:${proj.lucroPrevisto >= 0 ? 'var(--positivo)' : 'var(--negativo)'};">${fmtMoeda(proj.lucroPrevisto)}</div><div class="stat-sub">margem prevista de ${proj.margemPrevista}%</div></div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Velocidade até a meta e ponto de equilíbrio</div>
      <div class="chart-row">
        <div class="chart-box panel" style="text-align:center;">
          <div class="panel-title">Velocidade até a meta de lucro</div>
          <div class="panel-sub">${metaMes ? fmtMoeda(dre.lucroLiquido) + ' de ' + fmtMoeda(metaMes.meta_lucro) : 'Meta de lucro líquido do mês'}</div>
          ${svgVelocimetro(lucroVsMeta.pct)}
        </div>
        <div class="chart-box panel">
          <div class="panel-title">Ponto de equilíbrio</div>
          <div class="panel-sub">Quanto você precisa faturar pra cobrir as despesas do mês</div>
          <div style="font-size:20px;font-weight:800;color:${pe.atingido ? 'var(--positivo)' : 'var(--branco)'};margin:8px 0 2px;">${fmtMoeda(pe.despesasTotais)}</div>
          <div style="font-size:11px;color:${pe.atingido ? 'var(--positivo)' : 'var(--negativo)'};font-weight:600;margin-bottom:10px;">${pe.atingido ? '✓ Ponto de equilíbrio atingido' : `Faltam ${fmtMoeda(pe.faltam)} pra cobrir os custos`}</div>
          <div class="fg" style="margin-bottom:0;">
            <div class="fr" style="margin-bottom:0;"><label>Ticket por atendimento</label><input type="number" id="pe-ticket" min="0" value="${Math.round(pe.ticketMedioReal)}" oninput="fnRecalcularPontoEquilibrio()"></div>
            <div class="fr" style="margin-bottom:0;"><label>Atendimentos p/ equilíbrio</label><div class="stat-val" id="pe-clientes" style="font-size:20px;">${pe.clientesNecessarios === null ? '-' : pe.clientesNecessarios}</div></div>
          </div>
        </div>
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
          <div style="position:relative;height:190px;"><canvas id="db-chart-despesas"></canvas></div>
        </div>
        <div class="chart-box panel">
          <div class="panel-title">Entradas por categoria</div>
          <div class="panel-sub">Receitas de ${nomeMesLongo(mes)}, do maior para o menor</div>
          <div style="position:relative;height:190px;"><canvas id="db-chart-receitas"></canvas></div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Meta e ticket médio</div>
      <div class="chart-row">
        <div class="chart-box panel">
          <div class="panel-title">Receita vs. meta do mês</div>
          <div style="position:relative;height:150px;"><canvas id="fn-chart-meta"></canvas></div>
        </div>
        <div class="chart-box panel">
          <div class="panel-title">Evolução do ticket médio</div>
          <div class="panel-sub">Últimos 12 meses</div>
          <div style="position:relative;height:150px;"><canvas id="fn-chart-ticket"></canvas></div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Crescimento</div>
      <div class="chart-box panel">
        <div class="panel-sub">Receita bruta dos últimos 6 meses</div>
        <div style="position:relative;height:170px;"><canvas id="db-chart-crescimento"></canvas></div>
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
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        layout: { padding: { right: 50 } },
        plugins: { legend: { display: false }, datalabels: { formatter: (v) => fmtMoeda(v) } },
        scales: { x: { display: false, beginAtZero: true, grid: { display: false } }, y: { ticks: { font: { size: 11 } }, grid: { display: false } } },
      },
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
      options: {
        responsive: true, maintainAspectRatio: false,
        layout: { padding: { top: 20 } },
        plugins: {
          legend: { display: false },
          datalabels: { formatter: (v) => v > 0 ? fmtMoeda(v) : '', color: '#A9B8CF', font: { size: 9, weight: '600' }, align: 'top', offset: 4 },
        },
        scales: { x: { ticks: { font: { size: 10 } }, grid: { display: false } }, y: { display: false, beginAtZero: true, grid: { display: false } } },
      },
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
        layout: { padding: { top: 20 } },
        plugins: {
          legend: { display: false },
          datalabels: { formatter: (v) => v > 0 ? fmtMoeda(v) : '', color: '#A9B8CF', font: { size: 9, weight: '600' }, align: 'top', offset: 4 },
        },
        scales: {
          x: { ticks: { font: { size: 10 }, color: '#A9B8CF' }, grid: { display: false } },
          y: { display: false, beginAtZero: true, grid: { display: false } },
        },
      },
    });
  } else {
    canvasCrescimento.parentElement.innerHTML = '<div class="empty-state">Ainda não há receita lançada nos últimos 6 meses.</div>';
  }
}
