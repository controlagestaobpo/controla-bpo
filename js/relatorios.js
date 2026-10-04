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

  const projecaoMes = calcularProjecaoFechamento(mesAgora).receitaPrevista;
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
          { label: 'Despesas', data: dreHistorico.map((d) => d.deducoes + d.totalDespesasOperacionais), backgroundColor: '#7F93B5', borderRadius: 3 },
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
    prospect_atendimentos: State.prospectAtendimentos,
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

// ===================== DADOS COMPLETOS PARA IA =====================
// Monta um texto com TODOS os dados da empresa, mês a mês (realizado), mais projeção,
// clientes, prospects com histórico e metas — pra colar numa IA e pedir uma análise geral.
function rlPrimeiroMesComDados() {
  const datas = [
    ...State.receitas.filter((r) => r.status === 'ativa' && r.recebido).map((r) => r.data_recebimento),
    ...State.despesas.filter((d) => d.pago).map((d) => d.data_pagamento),
    ...State.prospects.map((p) => p.data_visita),
    ...State.clientesAtivos.map((c) => c.data_fechamento),
  ].filter((d) => d && d >= '2000-01-01').sort();
  return datas.length ? datas[0].slice(0, 7) : mesAtual();
}

function rlAgrupar(lista, chave, valor) {
  const out = {};
  lista.forEach((x) => { const k = chave(x) || 'sem informação'; out[k] = (out[k] || 0) + valor(x); });
  return Object.entries(out).sort((a, b) => b[1] - a[1]);
}

function gerarTextoDadosIA() {
  const hoje = hj();
  const mesHoje = mesAtual();
  const meses = mesesEntre(rlPrimeiroMesComDados(), mesHoje);
  const nomeCliente = (id) => (State.clientesAtivos.find((c) => c.id === id) || {}).empresa || 'Sem cliente vinculado';
  const linhaMoeda = ([k, v]) => `    - ${k}: ${fmtMoeda2(v)}`;
  const clientesAtivos = State.clientesAtivos.filter((c) => c.status === 'ativo');
  const mrr = clientesAtivos.reduce((s, c) => s + Number(c.ticket_mensal || 0), 0);
  const pipeline = prospectsPipeline();

  let t = `=== ${State.perfil.nome_empresa || 'CONTROLA GESTÃO BPO'} — DADOS COMPLETOS DA EMPRESA ===\n`;
  t += `Gerado em ${new Date().toLocaleDateString('pt-BR')}. Empresa de BPO financeiro (terceirização financeira) com contratos mensais.\n`;
  t += `Regime de caixa: receita/despesa entra no mês em que o dinheiro entrou/saiu. Valores em R$.\n\n`;

  t += `## FOTO DE HOJE (${new Date().toLocaleDateString('pt-BR')})\n`;
  t += `- Clientes ativos: ${clientesAtivos.length} | Receita recorrente (MRR): ${fmtMoeda2(mrr)}/mês | Ticket médio: ${fmtMoeda2(clientesAtivos.length ? mrr / clientesAtivos.length : 0)}\n`;
  t += `- Prospects em negociação: ${pipeline.length} (valor ${fmtMoeda2(pipeline.reduce((s, p) => s + Number(p.ticket || 0), 0))}/mês) | Indicações ainda não contatadas: ${indicacoesAContatar().length}\n`;
  t += `- Pausados pra retomar depois: ${prospectsParaRetomar().map((p) => `${p.empresa} (em ${fmtD(p.retorno)})`).join(', ') || 'nenhum'}\n`;
  t += `- Quem mais indica: ${rankingIndicadores().map((r) => `${r.nome}: indicou ${r.indicados.length} (${r.fechados} fechou, ${r.abertos} em aberto, ${r.perdidos} não fechou — ${r.indicados.map((i) => i.empresa).join(', ')})`).join(' | ') || 'nenhuma indicação registrada'}\n`;
  t += `- Clientes já cancelados (desde o início): ${State.clientesAtivos.filter((c) => c.status === 'encerrado').length}\n\n`;

  t += `## MÊS A MÊS (${nomeMesShort(meses[0])} a ${nomeMesShort(mesHoje)}${mesHoje === meses[meses.length - 1] ? ', mês atual parcial' : ''})\n`;
  t += `Resumo: Mês | Receita | Despesas | Impostos | Lucro líquido | Margem | Clientes ativos (fim) | MRR (fim) | Prospects iniciados | Atendimentos | Ganhos | Perdidos | Cancelamentos\n`;
  const metricas = meses.map(metricasDoMes);
  metricas.forEach((m) => {
    t += `${nomeMesShort(m.mes)} | ${fmtMoeda2(m.receita)} | ${fmtMoeda2(m.despesas)} | ${fmtMoeda2(m.impostos)} | ${fmtMoeda2(m.lucro)} | ${m.margem}% | ${m.clientesAtivos} | ${fmtMoeda2(m.mrr)} | ${m.iniciados} | ${m.atendimentos} | ${m.ganhos} | ${m.perdidos} | ${m.encerrados}\n`;
  });
  t += '\n';

  metricas.forEach((m) => {
    const mes = m.mes;
    const noMes = (d) => (d || '').slice(0, 7) === mes;
    const receitas = receitasDoMes(mes);
    const despesas = despesasDoMes(mes);
    const meta = metaEfetivaDoMes(mes);
    t += `### ${nomeMesLongo(mes).toUpperCase()}\n`;
    t += `Financeiro: receita ${fmtMoeda2(m.receita)} | despesas ${fmtMoeda2(m.despesas)} | lucro ${fmtMoeda2(m.lucro)} | margem ${m.margem}%`;
    if (meta) t += ` | meta de lucro ${fmtMoeda2(meta.meta_lucro)} (${meta.meta_lucro > 0 ? Math.round(m.lucro / meta.meta_lucro * 100) : 0}% atingido)`;
    t += '\n';
    if (receitas.length) {
      t += `  Receita por cliente:\n${rlAgrupar(receitas, (r) => r.cliente_id ? nomeCliente(r.cliente_id) : (r.descricao || r.categoria), (r) => Number(r.valor || 0)).map(linhaMoeda).join('\n')}\n`;
      t += `  Receita por categoria:\n${rlAgrupar(receitas, (r) => r.categoria, (r) => Number(r.valor || 0)).map(linhaMoeda).join('\n')}\n`;
    }
    if (despesas.length) {
      t += `  Despesas por categoria › subcategoria:\n${rlAgrupar(despesas, (d) => d.categoria + (d.subcategoria ? ' › ' + d.subcategoria : ''), (d) => Number(d.valor || 0)).map(linhaMoeda).join('\n')}\n`;
    }
    const iniciados = State.prospects.filter((p) => p.status !== 'indicado' && noMes(p.data_visita));
    const ganhos = State.clientesAtivos.filter((c) => noMes(c.data_fechamento));
    const perdidos = State.prospects.filter((p) => noMes(dataPerdaProspect(p)));
    const cancelados = State.clientesAtivos.filter((c) => c.status === 'encerrado' && noMes(c.data_encerramento));
    t += `Comercial: ${m.iniciados} prospects iniciados, ${m.atendimentos} atendimentos, ${m.indicacoesRecebidas} indicações recebidas, ${m.ganhos} ganhos, ${m.perdidos} perdidos, ${m.encerrados} cancelamentos (churn do mês ${m.churn}%)\n`;
    if (iniciados.length) t += `  Iniciados: ${iniciados.map((p) => `${p.empresa}${p.nicho ? ' (' + p.nicho + ')' : ''}`).join('; ')}\n`;
    if (ganhos.length) t += `  Ganhos: ${ganhos.map((c) => `${c.empresa} — ${fmtMoeda2(c.ticket_mensal)}/${c.frequencia || 'mês'}, origem ${ORIGEM_LBL[c.origem] || c.origem || '-'}${c.quem_indicou ? ' (indicado por ' + c.quem_indicou + ')' : ''}`).join('; ')}\n`;
    if (perdidos.length) t += `  Perdidos: ${perdidos.map((p) => `${p.empresa} — ${p.motivo_perda || 'motivo não informado'}`).join('; ')}\n`;
    if (cancelados.length) t += `  Cancelamentos: ${cancelados.map((c) => `${c.empresa} — ${c.motivo_cancelamento || '-'} (cancelado por ${c.quem_cancelou === 'empresa' ? 'nós' : 'cliente'})`).join('; ')}\n`;
    t += '\n';
  });

  t += `## PROJEÇÃO (o que já está lançado pros próximos 6 meses)\n`;
  for (let i = 0; i <= 6; i++) {
    const mes = somarMes(mesHoje, i);
    const rec = State.receitas.filter((r) => r.status === 'ativa' && r.mes_projecao === mes);
    const desp = State.despesas.filter((d) => d.mes_projecao === mes);
    const totRec = rec.reduce((s, r) => s + Number(r.valor || 0), 0);
    const totDesp = desp.reduce((s, d) => s + Number(d.valor || 0), 0);
    t += `- ${nomeMesShort(mes)}: receitas previstas ${fmtMoeda2(totRec)} | despesas previstas ${fmtMoeda2(totDesp)} | saldo ${fmtMoeda2(totRec - totDesp)}\n`;
  }
  const receberAtrasado = State.receitas.filter((r) => r.status === 'ativa' && !r.recebido && r.data < hoje);
  const pagarAtrasado = State.despesas.filter((d) => !d.pago && d.data < hoje);
  t += `- Em atraso hoje: ${receberAtrasado.length} recebimentos (${fmtMoeda2(receberAtrasado.reduce((s, r) => s + Number(r.valor || 0), 0))}) e ${pagarAtrasado.length} pagamentos (${fmtMoeda2(pagarAtrasado.reduce((s, d) => s + Number(d.valor || 0), 0))})\n`;
  receberAtrasado.forEach((r) => { t += `    - a receber: ${r.cliente_id ? nomeCliente(r.cliente_id) : r.descricao || r.categoria} ${fmtMoeda2(r.valor)} venc. ${fmtD(r.data)}\n`; });
  t += '\n';

  t += `## CLIENTES (todos, desde o início)\n`;
  State.clientesAtivos.forEach((c) => {
    const recebido = State.receitas.filter((r) => r.cliente_id === c.id && r.status === 'ativa' && r.recebido).reduce((s, r) => s + Number(r.valor || 0), 0);
    const produto = State.produtos.find((p) => p.id === c.produto_id);
    t += `- ${c.empresa} | ${c.status} | desde ${fmtD(c.data_fechamento)}${c.data_encerramento ? ' até ' + fmtD(c.data_encerramento) : ''} | ${fmtMoeda2(c.ticket_mensal)}/${c.frequencia || 'mês'}${produto ? ' | ' + produto.nome : ''} | origem ${ORIGEM_LBL[c.origem] || c.origem || '-'}${c.quem_indicou ? ' (' + c.quem_indicou + ')' : ''} | já recebido ${fmtMoeda2(recebido)}${c.motivo_cancelamento ? ' | cancelou: ' + c.motivo_cancelamento : ''}\n`;
  });
  t += '\n';

  t += `## PROSPECTS E HISTÓRICO DE ATENDIMENTOS\n`;
  [...State.prospects].sort((a, b) => (a.data_visita || '').localeCompare(b.data_visita || '')).forEach((p) => {
    t += `- ${p.empresa} | ${STATUS_LBL[p.status] || p.status}${p.nicho ? ' | ' + p.nicho : ''} | ticket ${fmtMoeda2(p.ticket)} | 1º contato ${fmtD(p.data_visita)}${p.proximo ? ' | próximo: ' + p.proximo : ''}${p.deadline ? ' até ' + fmtD(p.deadline) : ''}${p.motivo_perda ? ' | perdido: ' + p.motivo_perda : ''}\n`;
    [...atendimentosDoProspect(p.id)].reverse().forEach((a) => { t += `    · ${fmtD(a.data)} [${STATUS_LBL[a.status] || a.status}] ${a.obs || ''}\n`; });
  });
  t += '\n';

  if (State.metasFinanceiras.length) {
    t += `## METAS DE LUCRO DEFINIDAS\n`;
    [...State.metasFinanceiras].sort((a, b) => a.mes.localeCompare(b.mes)).forEach((m) => { t += `- ${nomeMesShort(m.mes)}: lucro ${fmtMoeda2(m.meta_lucro)} | receita necessária ${fmtMoeda2(m.meta_receita)}\n`; });
    t += '\n';
  }

  t += `---\nPEDIDO: Você é um consultor de gestão de pequenas empresas de serviço. Com base em TODOS os dados acima, faça uma análise geral da saúde da empresa:\n`;
  t += `1. Saúde financeira: evolução de receita, despesas, lucro e margem mês a mês; despesas que mais pesam e onde cortar; dependência de poucos clientes; caixa e contas em atraso.\n`;
  t += `2. Comercial: volume e ritmo de prospecção, taxa de conversão, motivos de perda, origem dos clientes (indicação x prospecção), segmentos que mais convertem.\n`;
  t += `3. Retenção: churn, motivos de cancelamento, receita recorrente e previsibilidade.\n`;
  t += `4. O que está indo bem e deve ser mantido; o que precisa melhorar; riscos.\n`;
  t += `5. Um plano de ação priorizado para os próximos 30 e 90 dias, com metas numéricas.\n`;
  return t;
}

async function rlCopiarResumoIA() {
  const t = gerarTextoDadosIA();
  try {
    await navigator.clipboard.writeText(t);
    alert('Dados completos copiados! Cole no Claude ou ChatGPT pra pedir a análise.');
  } catch (e) {
    // Sem permissão de área de transferência: baixa como arquivo de texto.
    const blob = new Blob([t], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `controla-dados-para-ia-${hj()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert('Não consegui copiar automaticamente, então baixei um arquivo .txt com os dados — é só abrir e colar na IA.');
  }
}
