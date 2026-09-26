let rlCharts = [];

function rlLimparCharts() {
  rlCharts.forEach((c) => { try { c.destroy(); } catch (e) {} });
  rlCharts = [];
}

function rlCabecalho(titulo) {
  return `
    <div style="text-align:center;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #001438;">
      <div style="font-size:11px;color:#4DB8F2;letter-spacing:2px;text-transform:uppercase;font-weight:700;">${State.perfil.nome_empresa || 'Controla Gestão BPO'}</div>
      <div style="font-size:22px;font-weight:800;color:#001438;margin-top:4px;">${titulo}</div>
      <div style="font-size:11px;color:#5B6B82;margin-top:4px;">Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
    </div>`;
}

function rlSecao(titulo) {
  return `<div style="font-size:13px;font-weight:800;color:#001438;text-transform:uppercase;letter-spacing:.5px;margin:22px 0 10px;padding-bottom:4px;border-bottom:1px solid #E2E8F0;">${titulo}</div>`;
}

function rlTabela(headers, rows) {
  if (!rows.length) return '<div style="color:#5B6B82;font-size:12px;margin-bottom:8px;">Sem dados.</div>';
  return `<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:8px;">
    <thead><tr>${headers.map((h) => `<th style="text-align:left;padding:6px 8px;border-bottom:1.5px solid #001438;color:#001438;font-size:9px;text-transform:uppercase;letter-spacing:.4px;">${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td style="padding:6px 8px;border-bottom:1px solid #E2E8F0;">${c}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>`;
}

function rlGrafico(id, altura) {
  return `<div style="position:relative;height:${altura || 200}px;width:100%;margin-bottom:16px;"><canvas id="${id}"></canvas></div>`;
}

function rlImprimir() {
  setTimeout(() => window.print(), 300);
}

// ===================== RELATÓRIO COMERCIAL =====================
function gerarRelatorioComercial() {
  rlLimparCharts();
  const clientesAtivos = State.clientesAtivos.filter((c) => c.status === 'ativo');
  const pipeline = prospectsPipeline();
  const funil = calcularFunil();
  const segmentos = calcularTopSegmentos();
  const porOrigem = {};
  State.clientesAtivos.forEach((c) => { const o = c.origem || 'não informado'; porOrigem[o] = (porOrigem[o] || 0) + 1; });
  const indicacoes = State.clientesAtivos.filter((c) => c.origem === 'indicacao').length;
  const taxaIndicacoes = State.clientesAtivos.length ? Math.round(indicacoes / State.clientesAtivos.length * 100) : 0;

  document.getElementById('print-container').innerHTML = `
    ${rlCabecalho('Relatório Comercial')}
    ${rlSecao('Funil de conversão')}
    ${rlTabela(['Etapa', 'Quantidade'], funil.map((f) => [f.nome, f.valor]))}
    ${rlGrafico('rl-chart-funil')}

    ${rlSecao(`Clientes ativos (${clientesAtivos.length})`)}
    ${rlTabela(['Empresa', 'Contato', 'Ticket mensal', 'Fechado em', 'Origem'],
      clientesAtivos.map((c) => [c.empresa, c.contato || '-', fmtMoeda(c.ticket_mensal), fmtD(c.data_fechamento), c.origem || '-']))}

    ${rlSecao(`Prospects em funil (${pipeline.length})`)}
    ${rlTabela(['Empresa', 'Status', 'Segmento', 'Próximo passo', 'Deadline'],
      pipeline.map((p) => [p.empresa, STATUS_LBL[p.status] || p.status, p.nicho || '-', p.proximo || '-', p.deadline ? fmtD(p.deadline) : '-']))}

    ${rlSecao('Análise por segmento')}
    ${rlTabela(['Segmento', 'Prospects', 'Fechados', 'Conversão'], segmentos.map((s) => [s.nome, s.v, s.f, s.valor + '%']))}
    ${segmentos.length ? rlGrafico('rl-chart-segmentos') : ''}

    ${rlSecao('Indicações')}
    ${rlTabela(['Origem', 'Quantidade'], Object.entries(porOrigem).map(([o, n]) => [o, n]))}
    <div style="font-size:11px;color:#5B6B82;">Taxa de indicação: ${taxaIndicacoes}% dos clientes.</div>
  `;

  requestAnimationFrame(() => {
    rlCharts.push(fnBarChartOrdem(document.getElementById('rl-chart-funil'), funil, CORES_CATEGORIA, null, true));
    if (segmentos.length) rlCharts.push(fnBarChartOrdem(document.getElementById('rl-chart-segmentos'), segmentos, '#9B7BF0', '%', true));
    rlImprimir();
  });
}

// ===================== RELATÓRIO FINANCEIRO =====================
function gerarRelatorioFinanceiro() {
  rlLimparCharts();
  const historico = [];
  for (let i = 11; i >= 0; i--) historico.push(mesesAtras(i));
  const dreHistorico = historico.map((m) => montarDRE(m));

  const mesAgora = mesAtual();
  const dreAtual = montarDRE(mesAgora);
  const despesasPorCategoria = [...dreAtual.grupos.deducao, ...GRUPO_DRE_ORDEM.flatMap((g) => dreAtual.grupos[g])];
  const receitasPorCategoria = [...dreAtual.receitaOperacionalDetalhe, ...dreAtual.receitaNaoOperacionalDetalhe];

  const porProduto = {};
  State.receitas.forEach((r) => { if (r.produto_id) porProduto[r.produto_id] = (porProduto[r.produto_id] || 0) + Number(r.valor || 0); });
  const analiseProduto = Object.entries(porProduto)
    .map(([pid, total]) => ({ nome: (State.produtos.find((p) => p.id === pid) || {}).nome || 'Produto removido', total }))
    .sort((a, b) => b.total - a.total);

  const projecaoMes = projecaoFimDeMes(dreAtual.receitaTotal, mesAgora);
  const clientesAtivos = State.clientesAtivos.filter((c) => c.status === 'ativo');
  const mrr = clientesAtivos.filter((c) => c.frequencia === 'mensal').reduce((s, c) => s + Number(c.ticket_mensal || 0), 0);
  const ticketMedio = clientesAtivos.length ? clientesAtivos.reduce((s, c) => s + Number(c.ticket_mensal || 0), 0) / clientesAtivos.length : 0;

  document.getElementById('print-container').innerHTML = `
    ${rlCabecalho('Relatório Financeiro')}
    ${rlSecao('DRE — últimos 12 meses')}
    ${rlTabela(['Mês', 'Receita', 'Despesas', 'Lucro líquido', 'Margem'],
      dreHistorico.map((d) => [nomeMesLongo(d.mes), fmtMoeda(d.receitaTotal), fmtMoeda(d.deducoes + d.totalDespesasOperacionais), fmtMoeda(d.lucroLiquido), d.margem + '%']))}
    ${rlGrafico('rl-chart-dre12', 220)}

    ${rlSecao(`Receitas por categoria — ${nomeMesLongo(mesAgora)}`)}
    ${rlTabela(['Categoria', 'Valor'], receitasPorCategoria.map((c) => [c.nome, fmtMoeda(c.total)]))}

    ${rlSecao(`Despesas por categoria — ${nomeMesLongo(mesAgora)}`)}
    ${rlTabela(['Categoria', 'Valor'], despesasPorCategoria.map((c) => [c.nome, fmtMoeda(c.total)]))}

    ${rlSecao('Análise por produto (histórico)')}
    ${rlTabela(['Produto', 'Receita total'], analiseProduto.map((p) => [p.nome, fmtMoeda(p.total)]))}

    ${rlSecao('Projeções')}
    ${rlTabela(['Indicador', 'Valor'], [
      ['Projeção de receita (fim do mês)', fmtMoeda(projecaoMes)],
      ['Receita recorrente mensal (MRR)', fmtMoeda(mrr)],
    ])}

    ${rlSecao('Margem & índices')}
    ${rlTabela(['Indicador', 'Valor'], [
      ['Margem líquida do mês', dreAtual.margem + '%'],
      ['Clientes ativos', clientesAtivos.length],
      ['Ticket médio', fmtMoeda(ticketMedio)],
    ])}
  `;

  requestAnimationFrame(() => {
    rlCharts.push(new Chart(document.getElementById('rl-chart-dre12'), {
      type: 'bar',
      data: {
        labels: historico.map((m) => nomeMesShort(m)),
        datasets: [
          { label: 'Receita', data: dreHistorico.map((d) => d.receitaTotal), backgroundColor: '#3DD68C', borderRadius: 3 },
          { label: 'Despesas', data: dreHistorico.map((d) => d.deducoes + d.totalDespesasOperacionais), backgroundColor: '#FF6B81', borderRadius: 3 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        layout: { padding: { top: 16 } },
        plugins: {
          legend: { display: true, labels: { font: { size: 10 }, boxWidth: 10 } },
          datalabels: { display: false },
        },
        scales: { x: { ticks: { font: { size: 10 } }, grid: { display: false } }, y: { display: false, beginAtZero: true, grid: { display: false } } },
      },
    }));
    rlImprimir();
  });
}

// ===================== RELATÓRIO INTEGRADO =====================
function gerarRelatorioIntegrado() {
  rlLimparCharts();
  const clientesAtivos = State.clientesAtivos.filter((c) => c.status === 'ativo');
  const pipeline = prospectsPipeline();
  const mes = mesAtual();
  const dre = montarDRE(mes);
  const funil = calcularFunil();
  const crescimento = calcularCrescimento(6);
  const despesasPorCategoria = [...dre.grupos.deducao, ...GRUPO_DRE_ORDEM.flatMap((g) => dre.grupos[g])];
  const receitasPorCategoria = [...dre.receitaOperacionalDetalhe, ...dre.receitaNaoOperacionalDetalhe];
  const encerrados = State.clientesAtivos.filter((c) => c.status === 'encerrado');
  const churnRate = State.clientesAtivos.length ? Math.round(encerrados.length / State.clientesAtivos.length * 100) : 0;
  const taxaConv = (pipeline.length + clientesAtivos.length) > 0 ? Math.round(clientesAtivos.length / (pipeline.length + clientesAtivos.length) * 100) : 0;

  const insights = [];
  if (dre.receitaTotal > 0) insights.push(dre.margem >= 70 ? `Margem de ${dre.margem}% — muito saudável.` : dre.margem >= 40 ? `Margem de ${dre.margem}% — saudável, dá pra melhorar.` : `Margem de ${dre.margem}% — vale revisar despesas.`);
  insights.push(`Churn rate de ${churnRate}% (${encerrados.length} de ${State.clientesAtivos.length} clientes all-time).`);
  insights.push(`Taxa de conversão geral de ${taxaConv}% (prospects → clientes).`);

  document.getElementById('print-container').innerHTML = `
    ${rlCabecalho('Relatório Integrado — Visão 360°')}
    ${rlSecao('KPIs principais')}
    ${rlTabela(['Indicador', 'Valor'], [
      ['Clientes ativos', clientesAtivos.length],
      ['Prospects em funil', pipeline.length],
      ['Taxa de conversão', taxaConv + '%'],
      ['Churn rate', churnRate + '%'],
      ['Receita do mês', fmtMoeda(dre.receitaTotal)],
      ['Despesas do mês', fmtMoeda(dre.deducoes + dre.totalDespesasOperacionais)],
      ['Lucro líquido', fmtMoeda(dre.lucroLiquido)],
      ['Margem', dre.margem + '%'],
    ])}

    ${rlSecao('Funil de conversão')}
    ${rlGrafico('rl-chart-funil2')}

    ${rlSecao('Crescimento — últimos 6 meses')}
    ${rlGrafico('rl-chart-cresc2')}

    ${rlSecao('Saídas por categoria')}
    ${despesasPorCategoria.length ? rlGrafico('rl-chart-desp2') : '<div style="color:#5B6B82;font-size:12px;">Sem despesas neste mês.</div>'}

    ${rlSecao('Entradas por categoria')}
    ${receitasPorCategoria.length ? rlGrafico('rl-chart-rec2') : '<div style="color:#5B6B82;font-size:12px;">Sem receitas neste mês.</div>'}

    ${rlSecao('Insights')}
    ${insights.map((i) => `<div style="font-size:12px;color:#4A5568;padding:3px 0;">• ${i}</div>`).join('')}
  `;

  requestAnimationFrame(() => {
    rlCharts.push(fnBarChartOrdem(document.getElementById('rl-chart-funil2'), funil, CORES_CATEGORIA, null, true));
    rlCharts.push(new Chart(document.getElementById('rl-chart-cresc2'), {
      type: 'bar',
      data: { labels: crescimento.map((c) => nomeMesShort(c.mes)), datasets: [{ data: crescimento.map((c) => c.receita), backgroundColor: '#4DB8F2', borderRadius: 3 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        layout: { padding: { top: 16 } },
        plugins: { legend: { display: false }, datalabels: { formatter: (v) => v > 0 ? fmtMoeda(v) : '', color: '#001438', font: { size: 9, weight: '600' }, align: 'top', offset: 4 } },
        scales: { x: { ticks: { font: { size: 10 } }, grid: { display: false } }, y: { display: false, beginAtZero: true, grid: { display: false } } },
      },
    }));
    if (despesasPorCategoria.length) rlCharts.push(fnBarChartOrdenado(document.getElementById('rl-chart-desp2'), despesasPorCategoria, CORES_CATEGORIA, true));
    if (receitasPorCategoria.length) rlCharts.push(fnBarChartOrdenado(document.getElementById('rl-chart-rec2'), receitasPorCategoria, '#3DD68C', true));
    rlImprimir();
  });
}

// ===================== EXPORTAÇÃO BRUTA =====================
function rlExportarJSON() {
  const dados = {
    gerado_em: new Date().toISOString(),
    perfil: State.perfil,
    prospects: State.prospects,
    clientes_ativos: State.clientesAtivos,
    receitas: State.receitas,
    despesas: State.despesas,
    produtos: State.produtos,
    categorias_despesa: State.categoriasDespesa,
    categorias_receita: State.categoriasReceita,
    segmentos: State.segmentos,
    metas: State.metas,
    metas_financeiras: State.metasFinanceiras,
  };
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `controla-gestao-dados-${hj()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function rlCopiarResumoIA() {
  const mes = mesAtual();
  const dre = montarDRE(mes);
  const clientesAtivos = State.clientesAtivos.filter((c) => c.status === 'ativo');
  const pipeline = prospectsPipeline();
  const encerrados = State.clientesAtivos.filter((c) => c.status === 'encerrado');

  let t = `=== CONTROLA GESTÃO BPO — RESUMO ===\nGerado em ${new Date().toLocaleDateString('pt-BR')}\n\n`;
  t += `COMERCIAL\nClientes ativos: ${clientesAtivos.length} | Prospects em funil: ${pipeline.length} | Cancelados: ${encerrados.length}\n\n`;
  t += `FINANCEIRO (${nomeMesLongo(mes)})\nReceita: ${fmtMoeda(dre.receitaTotal)} | Despesas: ${fmtMoeda(dre.deducoes + dre.totalDespesasOperacionais)} | Lucro líquido: ${fmtMoeda(dre.lucroLiquido)} | Margem: ${dre.margem}%\n\n`;
  t += `CLIENTES ATIVOS\n`;
  clientesAtivos.forEach((c) => { t += `- ${c.empresa} | ${fmtMoeda(c.ticket_mensal)}/mês | fechado em ${fmtD(c.data_fechamento)}\n`; });
  t += `\nPROSPECTS EM ABERTO\n`;
  pipeline.forEach((p) => { t += `- ${p.empresa} | ${STATUS_LBL[p.status] || p.status} | ${p.proximo || 'sem próximo passo'}\n`; });
  t += `\nCANCELAMENTOS\n`;
  encerrados.forEach((c) => { t += `- ${c.empresa} | ${c.motivo_cancelamento || '-'} | ${fmtD(c.data_encerramento)}\n`; });
  t += '\n---\nPeça: Analise esses dados do meu negócio de BPO e me diga onde estou indo bem, onde preciso melhorar e quais ações tomar essa semana.';

  try {
    await navigator.clipboard.writeText(t);
    alert('Resumo copiado! Cole no Claude ou ChatGPT pra pedir uma análise.');
  } catch (e) {
    alert('Não consegui copiar automaticamente — veja o console.');
    console.log(t);
  }
}
