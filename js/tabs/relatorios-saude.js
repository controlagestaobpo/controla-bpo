// ===== Relatórios: saúde financeira do mês ou do ano, com pontos de atenção =====
let rpModo = 'mes'; // 'mes' | 'ano'
let rpMes = null;
let rpAno = null;

function rpSetModo(m) { rpModo = m; renderRelatorios(); }
function rpMudar(delta) {
  if (rpModo === 'mes') rpMes = delta === 0 ? mesAtual() : somarMes(rpMes, delta);
  else rpAno = delta === 0 ? Number(mesAtual().slice(0, 4)) : rpAno + delta;
  renderRelatorios();
}

// Meses do período (no ano corrente, só até o mês atual) e o período de comparação.
function rpPeriodo() {
  const agora = mesAtual();
  if (rpModo === 'mes') {
    return { meses: [rpMes], anteriores: [somarMes(rpMes, -1)], titulo: nomeMesLongo(rpMes), comparacao: 'mês anterior' };
  }
  const ano = String(rpAno);
  const fim = ano === agora.slice(0, 4) ? agora : ano + '-12';
  const meses = mesesEntre(ano + '-01', fim);
  // Pula os meses do começo do ano em que ainda não havia nada lançado.
  while (meses.length > 1 && !montarDRE(meses[0]).receitaTotal && !montarDRE(meses[0]).totalDespesasOperacionais && !montarDRE(meses[0]).deducoes) meses.shift();
  const anteriores = meses.map((m) => somarMes(m, -12));
  return { meses, anteriores, titulo: `Ano de ${ano}${meses.length < 12 ? ` (${nomeMesShort(meses[0])} a ${nomeMesShort(fim)})` : ''}`, comparacao: 'mesmo período do ano anterior' };
}

function rpVariacao(atual, anterior) {
  if (!anterior) return null;
  return Math.round((atual - anterior) / Math.abs(anterior) * 100);
}

function rpSomarDRE(meses) {
  const dres = meses.map((m) => montarDRE(m));
  const soma = (f) => dres.reduce((s, d) => s + f(d), 0);
  const receita = soma((d) => d.receitaTotal);
  const despesas = soma((d) => d.deducoes + d.totalDespesasOperacionais);
  const lucro = soma((d) => d.lucroLiquido);
  const porCategoria = {};
  dres.forEach((d) => [...d.grupos.deducao, ...GRUPO_DRE_ORDEM.flatMap((g) => d.grupos[g])].forEach((c) => { porCategoria[c.nome] = (porCategoria[c.nome] || 0) + c.total; }));
  return {
    dres, receita, despesas, lucro,
    impostos: soma((d) => d.deducoes),
    margem: receita > 0 ? Math.round(lucro / receita * 100) : 0,
    porCategoria,
    despPorGrupo: Object.fromEntries(['deducao', ...GRUPO_DRE_ORDEM].map((g) => [g, g === 'deducao' ? soma((d) => d.deducoes) : soma((d) => d.despPorGrupo[g])])),
  };
}

// Junta todos os números e transforma em indicadores com sinal (ok / atenção / crítico).
function rpAnalisar() {
  const per = rpPeriodo();
  const de = per.meses[0] + '-01';
  const ate = ultimoDiaDoMes(per.meses[per.meses.length - 1]);
  const atual = rpSomarDRE(per.meses);
  const ant = rpSomarDRE(per.anteriores);
  const nMeses = per.meses.length;
  const ultimoMes = per.meses[per.meses.length - 1];

  // Meta de lucro (soma das metas dos meses)
  const metaLucro = per.meses.reduce((s, m) => s + Number((metaEfetivaDoMes(m) || {}).meta_lucro || 0), 0);

  // Concentração de receita por cliente
  const recebidas = State.receitas.filter((r) => r.status === 'ativa' && r.recebido && r.data_recebimento >= de && r.data_recebimento <= ate);
  const porCliente = {};
  recebidas.forEach((r) => {
    const nome = (State.clientesAtivos.find((c) => c.id === r.cliente_id) || {}).empresa || 'Outras receitas';
    porCliente[nome] = (porCliente[nome] || 0) + Number(r.valor || 0);
  });
  const ranking = Object.entries(porCliente).sort((a, b) => b[1] - a[1]);
  const maiorCliente = ranking[0] ? { nome: ranking[0][0], valor: ranking[0][1], pct: atual.receita > 0 ? Math.round(ranking[0][1] / atual.receita * 100) : 0 } : null;

  // Pontualidade: o que foi pago/recebido no período, comparando data do pagamento com o vencimento
  const pagas = State.despesas.filter((d) => d.pago && d.data_pagamento >= de && d.data_pagamento <= ate && d.data);
  const atrasoDias = (venc, pag) => Math.max(Math.round((new Date(pag + 'T12:00:00') - new Date(venc + 'T12:00:00')) / 86400000), 0);
  const pagasAtraso = pagas.filter((d) => d.data_pagamento > d.data);
  const recebAtraso = recebidas.filter((r) => r.data && r.data_recebimento > r.data);
  const atrasoMedioReceb = recebAtraso.length ? Math.round(recebAtraso.reduce((s, r) => s + atrasoDias(r.data, r.data_recebimento), 0) / recebAtraso.length) : 0;

  // Hoje: contas vencidas em aberto
  const atrasos = contasEmAtraso();

  // Ponto de equilíbrio (média de custos dos próximos meses) vs receita média do período
  const pe = calcularPontoEquilibrio(ultimoMes);
  const receitaMedia = atual.receita / nMeses;

  // Caixa: o que já está lançado pros próximos 3 meses
  const proximos = [1, 2, 3].map((i) => {
    const m = somarMes(mesAtual(), i);
    const rec = State.receitas.filter((r) => r.status === 'ativa' && r.mes_projecao === m).reduce((s, r) => s + Number(r.valor || 0), 0);
    const desp = State.despesas.filter((d) => d.mes_projecao === m).reduce((s, d) => s + Number(d.valor || 0), 0);
    return { mes: m, rec, desp, saldo: rec - desp };
  });

  // Comercial / carteira no fim do período
  const mFim = metricasDoMes(ultimoMes);
  const mIni = metricasDoMes(somarMes(per.meses[0], -1));
  const cancelamentos = per.meses.reduce((s, m) => s + metricasDoMes(m).encerrados, 0);
  const ganhos = per.meses.reduce((s, m) => s + metricasDoMes(m).ganhos, 0);

  // Maiores despesas e as que mais cresceram
  const topDespesas = Object.entries(atual.porCategoria).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([nome, valor]) => ({ nome, valor, pct: atual.despesas > 0 ? Math.round(valor / atual.despesas * 100) : 0, var: rpVariacao(valor, ant.porCategoria[nome] || 0) }));
  const cresceram = Object.entries(atual.porCategoria)
    .map(([nome, valor]) => ({ nome, valor, antes: ant.porCategoria[nome] || 0 }))
    .filter((c) => c.antes > 0 && c.valor - c.antes > Math.max(100 * nMeses, c.antes * 0.3))
    .sort((a, b) => (b.valor - b.antes) - (a.valor - a.antes));

  // ---- Indicadores ----
  const ind = [];
  const add = (nome, valor, nivel, detalhe) => ind.push({ nome, valor, nivel, detalhe });
  add('Resultado', fmtMoeda(atual.lucro), atual.lucro < 0 ? 'critico' : atual.margem < 20 ? 'atencao' : 'ok',
    atual.lucro < 0 ? 'Prejuízo no período' : `Margem de ${atual.margem}%`);
  if (metaLucro > 0) {
    const pct = Math.round(atual.lucro / metaLucro * 100);
    add('Meta de lucro', pct + '%', pct >= 100 ? 'ok' : pct >= 70 ? 'atencao' : 'critico', `${fmtMoeda(atual.lucro)} de ${fmtMoeda(metaLucro)}`);
  }
  const varRec = rpVariacao(atual.receita, ant.receita);
  add('Receita', fmtMoeda(atual.receita), varRec === null ? 'ok' : varRec < -10 ? 'critico' : varRec < 0 ? 'atencao' : 'ok',
    varRec === null ? 'Sem base de comparação' : `${varRec >= 0 ? '+' : ''}${varRec}% vs ${per.comparacao}`);
  const varDesp = rpVariacao(atual.despesas, ant.despesas);
  add('Despesas', fmtMoeda(atual.despesas), varDesp !== null && varDesp > 20 && (varRec === null || varDesp > varRec) ? 'atencao' : 'ok',
    varDesp === null ? 'Sem base de comparação' : `${varDesp >= 0 ? '+' : ''}${varDesp}% vs ${per.comparacao}`);
  if (pe.pontoEquilibrio > 0) {
    const cobertura = Math.round(receitaMedia / pe.pontoEquilibrio * 100);
    add('Ponto de equilíbrio', fmtMoeda(pe.pontoEquilibrio) + '/mês', cobertura >= 130 ? 'ok' : cobertura >= 100 ? 'atencao' : 'critico',
      `Receita média cobre ${cobertura}% dele`);
  }
  if (maiorCliente) {
    add('Maior cliente', maiorCliente.pct + '% da receita', maiorCliente.pct > 50 ? 'critico' : maiorCliente.pct > 35 ? 'atencao' : 'ok', maiorCliente.nome);
  }
  add('A receber em atraso (hoje)', fmtMoeda(atrasos.totalReceber), atrasos.totalReceber === 0 ? 'ok' : atrasos.totalReceber > receitaMedia * 0.2 ? 'critico' : 'atencao',
    `${atrasos.receber.length} lançamento${atrasos.receber.length === 1 ? '' : 's'}`);
  const despesaMedia = atual.despesas / nMeses;
  const atrasoPagarGrave = atrasos.totalPagar > despesaMedia * 0.15 || atrasos.pagar.some((x) => fnDiasEntre(x.venc, hj()) > 30);
  add('A pagar em atraso (hoje)', fmtMoeda(atrasos.totalPagar), atrasos.totalPagar === 0 ? 'ok' : atrasoPagarGrave ? 'critico' : 'atencao',
    `${atrasos.pagar.length} lançamento${atrasos.pagar.length === 1 ? '' : 's'}`);
  if (pagas.length) {
    const pct = Math.round((pagas.length - pagasAtraso.length) / pagas.length * 100);
    add('Contas pagas em dia', pct + '%', pct >= 90 ? 'ok' : pct >= 50 ? 'atencao' : 'critico', `${pagasAtraso.length} de ${pagas.length} pagas com atraso`);
  }
  if (recebidas.length) {
    const pct = Math.round((recebidas.length - recebAtraso.length) / recebidas.length * 100);
    add('Clientes pagando em dia', pct + '%', pct >= 90 ? 'ok' : pct >= 50 ? 'atencao' : 'critico',
      recebAtraso.length ? `atraso médio de ${atrasoMedioReceb} dia${atrasoMedioReceb === 1 ? '' : 's'}` : 'nenhum recebimento atrasado');
  }
  const saldoNegativo = proximos.find((p) => p.saldo < 0);
  add('Caixa dos próximos 3 meses', fmtMoeda(proximos.reduce((s, p) => s + p.saldo, 0)), saldoNegativo ? 'critico' : 'ok',
    saldoNegativo ? `${nomeMesShort(saldoNegativo.mes)} fecha negativo pelo que está lançado` : 'saldo previsto positivo em todos');
  add('Receita recorrente (MRR)', fmtMoeda(mFim.mrr) + '/mês', mFim.mrr < mIni.mrr ? 'atencao' : 'ok',
    `${mFim.clientesAtivos} clientes ativos · ${ganhos} novo${ganhos === 1 ? '' : 's'} · ${cancelamentos} cancelamento${cancelamentos === 1 ? '' : 's'}`);

  // ---- Pontos de atenção e pontos positivos (texto) ----
  const atencao = [];
  const positivos = [];
  if (atual.lucro < 0) atencao.push({ nivel: 'critico', txt: `O período fechou com prejuízo de ${fmtMoeda(Math.abs(atual.lucro))}. Revise as maiores despesas abaixo e a cobrança dos clientes.` });
  if (atrasos.totalPagar > 0) atencao.push({ nivel: atrasoPagarGrave ? 'critico' : 'atencao', txt: `Há ${fmtMoeda(atrasos.totalPagar)} em contas a pagar vencidas (${atrasos.pagar.length}). Atraso gera multa e juros — priorize ${atrasos.pagar[0].nome} (venceu ${fnDataBR(atrasos.pagar[0].venc)}).` });
  if (atrasos.totalReceber > 0) atencao.push({ nivel: atrasos.totalReceber > receitaMedia * 0.2 ? 'critico' : 'atencao', txt: `${fmtMoeda(atrasos.totalReceber)} a receber estão vencidos: ${atrasos.receber.slice(0, 3).map((x) => x.nome).join(', ')}${atrasos.receber.length > 3 ? '…' : ''}. Vale cobrar esta semana.` });
  if (maiorCliente && maiorCliente.pct > 35) atencao.push({ nivel: maiorCliente.pct > 50 ? 'critico' : 'atencao', txt: `${maiorCliente.nome} representa ${maiorCliente.pct}% da receita. Se esse cliente sair, o caixa sente muito — diversificar a carteira reduz esse risco.` });
  if (pe.pontoEquilibrio > 0 && receitaMedia < pe.pontoEquilibrio) atencao.push({ nivel: 'critico', txt: `A receita média (${fmtMoeda(receitaMedia)}/mês) está abaixo do ponto de equilíbrio (${fmtMoeda(pe.pontoEquilibrio)}/mês).` });
  if (saldoNegativo) atencao.push({ nivel: 'critico', txt: `Pelo que já está lançado, ${nomeMesLongo(saldoNegativo.mes)} fecha com saldo de ${fmtMoeda(saldoNegativo.saldo)}. Antecipe receitas ou renegocie vencimentos.` });
  cresceram.slice(0, 2).forEach((c) => atencao.push({ nivel: 'atencao', txt: `${c.nome} subiu de ${fmtMoeda(c.antes)} para ${fmtMoeda(c.valor)} vs ${per.comparacao}.` }));
  if (pagasAtraso.length) atencao.push({ nivel: 'atencao', txt: `${pagasAtraso.length} conta${pagasAtraso.length === 1 ? ' foi paga' : 's foram pagas'} depois do vencimento no período.` });
  if (recebAtraso.length) atencao.push({ nivel: 'atencao', txt: `${recebAtraso.length} recebimento${recebAtraso.length === 1 ? '' : 's'} chegou com atraso (média de ${atrasoMedioReceb} dias).` });
  if (cancelamentos > 0) atencao.push({ nivel: 'atencao', txt: `${cancelamentos} cliente${cancelamentos === 1 ? ' cancelou' : 's cancelaram'} no período.` });
  if (metaLucro > 0 && atual.lucro < metaLucro) atencao.push({ nivel: 'atencao', txt: `Faltaram ${fmtMoeda(metaLucro - atual.lucro)} pra bater a meta de lucro.` });

  if (atual.lucro > 0 && atual.margem >= 30) positivos.push(`Margem de ${atual.margem}% — saudável pra uma empresa de serviço.`);
  if (varRec !== null && varRec > 0) positivos.push(`Receita cresceu ${varRec}% vs ${per.comparacao}.`);
  if (metaLucro > 0 && atual.lucro >= metaLucro) positivos.push(`Meta de lucro batida (${fmtMoeda(atual.lucro)} de ${fmtMoeda(metaLucro)}).`);
  if (atrasos.totalPagar === 0) positivos.push('Nenhuma conta a pagar em atraso.');
  if (atrasos.totalReceber === 0) positivos.push('Nenhum recebimento em atraso.');
  if (ganhos > 0) positivos.push(`${ganhos} cliente${ganhos === 1 ? ' novo' : 's novos'} no período.`);
  if (mFim.mrr > mIni.mrr) positivos.push(`Receita recorrente subiu de ${fmtMoeda(mIni.mrr)} para ${fmtMoeda(mFim.mrr)}/mês.`);
  if (pe.pontoEquilibrio > 0 && receitaMedia >= pe.pontoEquilibrio * 1.3) positivos.push('Receita bem acima do ponto de equilíbrio.');

  const criticos = ind.filter((i) => i.nivel === 'critico').length;
  const avisos = ind.filter((i) => i.nivel === 'atencao').length;
  // Crítico de verdade: prejuízo, caixa negativo à frente, receita abaixo do equilíbrio, ou vários problemas graves juntos.
  const estrutural = atual.lucro < 0 || !!saldoNegativo || (pe.pontoEquilibrio > 0 && receitaMedia < pe.pontoEquilibrio);
  const geral = estrutural || criticos >= 4 ? 'critico' : criticos || avisos >= 2 ? 'atencao' : 'ok';

  return { per, atual, ant, nMeses, ind, atencao, positivos, geral, criticos, avisos, topDespesas, ranking, proximos, metaLucro };
}

const RP_NIVEL = {
  ok: { cor: 'var(--positivo)', badge: 'badge-green', txt: 'Saudável' },
  atencao: { cor: 'var(--amber)', badge: 'badge-amber', txt: 'Atenção' },
  critico: { cor: 'var(--negativo)', badge: 'badge-red', txt: 'Crítico' },
};

function renderRelatorios() {
  if (!rpMes) rpMes = mesAtual();
  if (!rpAno) rpAno = Number(mesAtual().slice(0, 4));
  const a = rpAnalisar();
  const g = RP_NIVEL[a.geral];
  const label = rpModo === 'mes' ? nomeMesLongo(rpMes) : String(rpAno);
  const atual = rpModo === 'mes' ? rpMes === mesAtual() : rpAno === Number(mesAtual().slice(0, 4));

  document.getElementById('page-relatorios').innerHTML = `
    <div class="periodo-nav av-filtros">
      <div class="av-modos">
        <span class="pill ${rpModo === 'mes' ? 'on' : ''}" onclick="rpSetModo('mes')">Mês</span>
        <span class="pill ${rpModo === 'ano' ? 'on' : ''}" onclick="rpSetModo('ano')">Ano</span>
      </div>
      <button class="periodo-btn" onclick="rpMudar(-1)">‹</button>
      <div class="periodo-label">${label}</div>
      <button class="periodo-btn" onclick="rpMudar(1)">›</button>
      ${!atual ? `<button class="btn btn-xs" onclick="rpMudar(0)">Hoje</button>` : ''}
    </div>

    <div class="section">
      <div class="panel rp-diag" style="border-left:4px solid ${g.cor};">
        <div class="rp-diag-topo">
          <div>
            <div class="stat-lbl">Saúde financeira · ${a.per.titulo}</div>
            <div class="rp-diag-status" style="color:${g.cor};">${g.txt}</div>
          </div>
          <div class="rp-diag-cont">
            <span class="badge badge-red">${a.criticos} crítico${a.criticos === 1 ? '' : 's'}</span>
            <span class="badge badge-amber">${a.avisos} atenção</span>
            <span class="badge badge-green">${a.ind.length - a.criticos - a.avisos} ok</span>
          </div>
        </div>
        ${atual ? '<div class="panel-sub" style="margin:6px 0 0;">Período em andamento — os números ainda vão mudar até o fim.</div>' : ''}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Indicadores</div>
      <div class="rp-ind-grid">
        ${a.ind.map((i) => `<div class="rp-ind" style="border-left-color:${RP_NIVEL[i.nivel].cor};">
          <div class="stat-lbl">${i.nome}</div>
          <div class="rp-ind-val">${i.valor}</div>
          <div class="rp-ind-det"><span class="rp-dot" style="background:${RP_NIVEL[i.nivel].cor};"></span>${i.detalhe}</div>
        </div>`).join('')}
      </div>
    </div>

    <div class="section">
      <div class="chart-row">
        <div class="panel">
          <div class="panel-title">Pontos de atenção</div>
          ${a.atencao.length ? a.atencao.sort((x, y) => (x.nivel === 'critico' ? 0 : 1) - (y.nivel === 'critico' ? 0 : 1)).map((p) => `<div class="rp-ponto"><span class="badge ${RP_NIVEL[p.nivel].badge}">${RP_NIVEL[p.nivel].txt}</span><span>${p.txt}</span></div>`).join('')
            : '<div class="atraso-sub" style="padding-top:6px;">Nenhum ponto de atenção no período.</div>'}
        </div>
        <div class="panel">
          <div class="panel-title">O que está indo bem</div>
          ${a.positivos.length ? a.positivos.map((p) => `<div class="rp-ponto"><span class="rp-check">✓</span><span>${p}</span></div>`).join('')
            : '<div class="atraso-sub" style="padding-top:6px;">Lance receitas e despesas pra começar a ver os destaques.</div>'}
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Resultado (DRE)</div>
      <div class="panel"><div class="tbl-wrap"><table class="tbl">
        <tr><th>Linha</th><th style="text-align:right;">${label}</th><th style="text-align:right;">Anterior</th><th style="text-align:right;">Variação</th></tr>
        ${[
          ['Receita', a.atual.receita, a.ant.receita],
          ['(−) Impostos', a.atual.impostos, a.ant.impostos],
          ...GRUPO_DRE_ORDEM.map((gr) => [`(−) ${GRUPO_DRE_LABELS[gr]}`, a.atual.despPorGrupo[gr], a.ant.despPorGrupo[gr]]),
          ['Lucro líquido', a.atual.lucro, a.ant.lucro],
        ].filter(([, v, ant]) => v || ant).map(([nome, v, ant], i, arr) => {
          const varPct = rpVariacao(v, ant);
          const ultima = i === arr.length - 1;
          return `<tr${ultima ? ' style="border-top:1.5px solid var(--border);"' : ''}><td>${ultima ? '<strong>' + nome + '</strong>' : nome}</td>
            <td style="text-align:right;${ultima ? `color:${v >= 0 ? 'var(--positivo)' : 'var(--negativo)'};font-weight:800;` : ''}">${fmtMoeda2(v)}</td>
            <td style="text-align:right;color:var(--cinza-claro);">${fmtMoeda2(ant)}</td>
            <td style="text-align:right;color:var(--cinza-claro);">${varPct === null ? '—' : (varPct >= 0 ? '+' : '') + varPct + '%'}</td></tr>`;
        }).join('')}
        <tr><td style="color:var(--text3);font-size:11px;">margem de ${a.atual.margem}% (antes ${a.ant.margem}%)</td><td></td><td></td><td></td></tr>
      </table></div></div>
    </div>

    <div class="section">
      <div class="chart-row">
        <div class="panel">
          <div class="panel-title">Para onde foi o dinheiro</div>
          <div class="panel-sub">Maiores despesas do período</div>
          ${a.topDespesas.length ? a.topDespesas.map((c) => `<div class="rp-barra">
            <div class="rp-barra-topo"><span>${c.nome}</span><span>${fmtMoeda(c.valor)} <span class="atraso-sub">· ${c.pct}%${c.var !== null ? ` · ${c.var >= 0 ? '+' : ''}${c.var}%` : ''}</span></span></div>
            <div class="funil-step-bar-wrap"><div class="funil-step-bar" style="width:${c.pct}%;background:var(--neutro-grafico);"></div></div>
          </div>`).join('') : '<div class="atraso-sub">Nenhuma despesa paga no período.</div>'}
        </div>
        <div class="panel">
          <div class="panel-title">De onde veio o dinheiro</div>
          <div class="panel-sub">Receita recebida por cliente</div>
          ${a.ranking.length ? a.ranking.slice(0, 6).map(([nome, valor]) => {
            const pct = a.atual.receita > 0 ? Math.round(valor / a.atual.receita * 100) : 0;
            return `<div class="rp-barra">
              <div class="rp-barra-topo"><span>${nome}</span><span>${fmtMoeda(valor)} <span class="atraso-sub">· ${pct}%</span></span></div>
              <div class="funil-step-bar-wrap"><div class="funil-step-bar" style="width:${pct}%;background:var(--positivo);"></div></div>
            </div>`;
          }).join('') : '<div class="atraso-sub">Nenhuma receita recebida no período.</div>'}
        </div>
      </div>
    </div>

    ${rpModo === 'ano' ? `<div class="section">
      <div class="section-title">Mês a mês</div>
      <div class="panel"><div class="tbl-wrap"><table class="tbl">
        <tr><th>Mês</th><th style="text-align:right;">Receita</th><th style="text-align:right;">Despesas</th><th style="text-align:right;">Lucro</th><th style="text-align:right;">Margem</th></tr>
        ${a.atual.dres.map((d, i) => `<tr class="av-linha" onclick="rpModo='mes';rpMes='${a.per.meses[i]}';renderRelatorios();window.scrollTo(0,0);">
          <td>${nomeMesShort(a.per.meses[i])}</td><td style="text-align:right;">${fmtMoeda(d.receitaTotal)}</td>
          <td style="text-align:right;">${fmtMoeda(d.deducoes + d.totalDespesasOperacionais)}</td>
          <td style="text-align:right;color:${d.lucroLiquido >= 0 ? 'var(--positivo)' : 'var(--negativo)'};">${fmtMoeda(d.lucroLiquido)}</td>
          <td style="text-align:right;">${d.margem}%</td></tr>`).join('')}
      </table></div></div>
      <div class="panel-sub" style="margin-top:6px;">Toque num mês pra ver o relatório dele.</div>
    </div>` : ''}

    <div class="section">
      <div class="section-title">Próximos 3 meses (pelo que já está lançado)</div>
      <div class="card-grid-2">
        ${a.proximos.map((p) => `<div class="stat-card">
          <div class="stat-lbl">${nomeMesShort(p.mes)}</div>
          <div class="stat-val" style="color:${p.saldo >= 0 ? 'var(--positivo)' : 'var(--negativo)'};font-size:18px;">${fmtMoeda(p.saldo)}</div>
          <div class="stat-sub">entra ${fmtMoeda(p.rec)} · sai ${fmtMoeda(p.desp)}</div>
        </div>`).join('')}
      </div>
    </div>
  `;
}
