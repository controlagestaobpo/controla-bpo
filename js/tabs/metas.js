let mtMes = null;
let mtLucroDesejado = 0;
let mtModo = 'mes'; // 'mes' | 'periodo'
let mtDe = null;
let mtAte = null;

// Intervalo analisado: o mês escolhido inteiro, ou um período personalizado por data.
function mtIntervalo() {
  if (!mtMes) mtMes = mesAtual();
  if (mtModo === 'periodo' && mtDe && mtAte && mtDe <= mtAte) return { de: mtDe, ate: mtAte };
  return { de: mtMes + '-01', ate: ultimoDiaDoMes(mtMes) };
}

function mtSetModo(modo) {
  mtModo = modo;
  if (modo === 'periodo' && !mtDe) { mtDe = mtMes + '-01'; mtAte = hj() < ultimoDiaDoMes(mtMes) ? hj() : ultimoDiaDoMes(mtMes); }
  renderMetasInteligentes();
}
function mtMudarMes(delta) { mtMes = delta === 0 ? mesAtual() : somarMes(mtMes, delta); renderMetasInteligentes(); }
function mtSetDatas() {
  const de = document.getElementById('mt-de').value, ate = document.getElementById('mt-ate').value;
  if (de && ate && de <= ate) { mtDe = de; mtAte = ate; renderMetasInteligentes(); }
}

function htmlSeletorMetas() {
  const { de, ate } = mtIntervalo();
  return `<div class="periodo-nav av-filtros">
    <div class="av-modos">
      <span class="pill ${mtModo === 'mes' ? 'on' : ''}" onclick="mtSetModo('mes')">Mês</span>
      <span class="pill ${mtModo === 'periodo' ? 'on' : ''}" onclick="mtSetModo('periodo')">Personalizado</span>
    </div>
    ${mtModo === 'mes' ? `
      <button class="periodo-btn" onclick="mtMudarMes(-1)">‹</button>
      <div class="periodo-label">${nomeMesLongo(mtMes)}</div>
      <button class="periodo-btn" onclick="mtMudarMes(1)">›</button>
      ${mtMes !== mesAtual() ? `<button class="btn btn-xs" onclick="mtMudarMes(0)">Hoje</button>` : ''}` : `
      <input type="date" class="av-input" id="mt-de" value="${de}" onchange="mtSetDatas()">
      <span style="color:var(--cinza-claro);font-size:12px;">até</span>
      <input type="date" class="av-input" id="mt-ate" value="${ate}" onchange="mtSetDatas()">`}
  </div>`;
}

function mtDadosBase() {
  const { de, ate } = mtIntervalo();
  const dias = Math.round((new Date(ate + 'T12:00:00') - new Date(de + 'T12:00:00')) / 86400000) + 1;
  // Os cenários comparam valores mensais: num período personalizado, os totais viram média por mês.
  const nMeses = mtModo === 'periodo' ? Math.max(dias / 30.44, 1 / 30.44) : 1;
  const dreTotal = montarDREIntervalo(de, ate);
  const dre30 = {
    receitaTotal: dreTotal.receitaTotal / nMeses,
    deducoes: dreTotal.deducoes / nMeses,
    totalDespesasOperacionais: dreTotal.totalDespesasOperacionais / nMeses,
    lucroLiquido: dreTotal.lucroLiquido / nMeses,
    margem: dreTotal.margem,
  };
  const mesRef = ate.slice(0, 7);
  const clientesAtivos = clientesAtivosEm(ate);
  const tickets = clientesAtivos.map((c) => Number(c.ticket_mensal || 0));
  const ticketMedio = tickets.length ? tickets.reduce((s, v) => s + v, 0) / tickets.length : 0;
  const ticketMax = tickets.length ? Math.max(...tickets) : 0;
  const ticketMin = tickets.length ? Math.min(...tickets) : 0;

  const receitaAgora = montarDRE(mesRef).receitaTotal;
  const receita3MesesAtras = montarDRE(somarMes(mesRef, -3)).receitaTotal;
  const crescimento3m = receita3MesesAtras > 0 ? Math.round((receitaAgora - receita3MesesAtras) / receita3MesesAtras * 100) : null;

  const receitaRecorrenteMes = State.receitas
    .filter((r) => r.mes_projecao === mesRef && r.status === 'ativa' && r.e_recorrente)
    .reduce((s, r) => s + Number(r.valor || 0), 0);

  return {
    receitaBruta: dre30.receitaTotal,
    despesasTotais: dre30.deducoes + dre30.totalDespesasOperacionais,
    lucroLiquido: dre30.lucroLiquido,
    margem: dre30.margem,
    clientesAtivos: clientesAtivos.length,
    ticketMedio, ticketMax, ticketMin,
    crescimento3m,
    receitaRecorrenteMes,
    totais: {
      receita: dreTotal.receitaTotal,
      despesas: dreTotal.deducoes + dreTotal.totalDespesasOperacionais,
      lucro: dreTotal.lucroLiquido,
    },
    de, ate, dias, nMeses, mesRef,
  };
}

function renderMetasInteligentes() {
  if (!mtMes) mtMes = mesAtual();
  const dados = mtDadosBase();
  const metaRef = mtModo === 'mes' ? State.metasFinanceiras.find((m) => m.mes === mtMes) || metaEfetivaDoMes(mtMes) : metaEfetivaDoMes(dados.mesRef);
  mtLucroDesejado = metaRef ? Number(metaRef.meta_lucro) : Math.max(Math.round(dados.lucroLiquido), 0);
  const tituloPeriodo = mtModo === 'mes' ? nomeMesLongo(mtMes) : `${fmtD(dados.de)} a ${fmtD(dados.ate)}`;

  const el = document.getElementById('page-metas');
  el.innerHTML = `
    ${htmlSeletorMetas()}
    <div class="section">
      <div class="panel" style="border-left:4px solid var(--azul);">
        <div class="panel-title">Meta de lucro líquido${mtModo === 'mes' ? ' de ' + nomeMesLongo(mtMes) : ' (por mês)'}: ${fmtMoeda(mtLucroDesejado)}</div>
        <div class="panel-sub">Pra mudar, vá em Configurações → Metas → Editar meta de lucro líquido.${mtModo === 'periodo' ? ' No período personalizado, os cenários comparam a média mensal do período com a meta do mês.' : ''}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Dados de ${tituloPeriodo}</div>
      <div class="card-grid-2" style="margin-bottom:4px;">
        <div class="stat-card"><div class="stat-lbl">Receita bruta</div><div class="stat-val" style="color:var(--positivo)">${fmtMoeda(dados.totais.receita)}</div>${mtModo === 'periodo' ? `<div class="stat-sub">${fmtMoeda(dados.receitaBruta)}/mês</div>` : ''}</div>
        <div class="stat-card"><div class="stat-lbl">Despesas totais</div><div class="stat-val" style="color:var(--negativo)">${fmtMoeda(dados.totais.despesas)}</div>${mtModo === 'periodo' ? `<div class="stat-sub">${fmtMoeda(dados.despesasTotais)}/mês</div>` : ''}</div>
        <div class="stat-card"><div class="stat-lbl">Lucro líquido</div><div class="stat-val">${fmtMoeda(dados.totais.lucro)}</div>${mtModo === 'periodo' ? `<div class="stat-sub">${fmtMoeda(dados.lucroLiquido)}/mês</div>` : ''}</div>
        <div class="stat-card"><div class="stat-lbl">Margem</div><div class="stat-val">${dados.margem}%</div></div>
        <div class="stat-card"><div class="stat-lbl">Clientes ativos</div><div class="stat-val">${dados.clientesAtivos}</div></div>
        <div class="stat-card"><div class="stat-lbl">Ticket médio</div><div class="stat-val">${fmtMoeda(dados.ticketMedio)}</div></div>
        <div class="stat-card"><div class="stat-lbl">Ticket máx. / mín.</div><div class="stat-val" style="font-size:16px;">${fmtMoeda(dados.ticketMax)} / ${fmtMoeda(dados.ticketMin)}</div></div>
        <div class="stat-card"><div class="stat-lbl">Crescimento (3 meses)</div><div class="stat-val">${dados.crescimento3m === null ? '-' : (dados.crescimento3m >= 0 ? '+' : '') + dados.crescimento3m + '%'}</div></div>
        <div class="stat-card"><div class="stat-lbl">Receita recorrente projetada</div><div class="stat-val">${fmtMoeda(dados.receitaRecorrenteMes)}/mês</div></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Projeção anualizada (no ritmo atual)</div>
      <div class="panel-sub" style="margin-top:-4px;">Se ${mtModo === 'mes' ? 'esse mês se repetir' : 'a média mensal desse período se repetir'} por 12 meses.</div>
      <div class="card-grid-2" style="margin-bottom:4px;">
        <div class="stat-card"><div class="stat-lbl">Receita anualizada</div><div class="stat-val" style="color:var(--positivo)">${fmtMoeda(dados.receitaBruta * 12)}</div></div>
        <div class="stat-card"><div class="stat-lbl">Despesas anualizadas</div><div class="stat-val" style="color:var(--negativo)">${fmtMoeda(dados.despesasTotais * 12)}</div></div>
        <div class="stat-card"><div class="stat-lbl">Lucro líquido anualizado</div><div class="stat-val" style="color:${dados.lucroLiquido >= 0 ? 'var(--positivo)' : 'var(--negativo)'}">${fmtMoeda(dados.lucroLiquido * 12)}</div></div>
      </div>
    </div>

    <div class="section" id="mt-resultado"></div>
  `;
  mtRenderResultado();
  mtRenderHistorico();
}

function mtRenderResultado() {
  const el = document.getElementById('mt-resultado');
  if (!el) return;
  const d = mtDadosBase();
  const meta = mtLucroDesejado;
  const gap = meta - d.lucroLiquido;
  const tolerancia = Math.max(meta * 0.05, 100);

  // ---- Status ----
  let status, statusCor, statusBg;
  if (d.lucroLiquido >= meta + tolerancia) { status = `✓ Você já está acima da meta — ${fmtMoeda(d.lucroLiquido - meta)} a mais`; statusCor = 'var(--positivo)'; statusBg = 'rgba(61,214,140,0.12)'; }
  else if (Math.abs(d.lucroLiquido - meta) < tolerancia) { status = '✓ Você está no alvo'; statusCor = 'var(--positivo)'; statusBg = 'rgba(61,214,140,0.12)'; }
  else { status = `❌ Você precisa de ${fmtMoeda(gap)} a mais de lucro`; statusCor = 'var(--negativo)'; statusBg = 'rgba(255,107,129,0.12)'; }

  // ---- Cenário 1: sem mudar nada ----
  const c1Bate = d.lucroLiquido >= meta;

  // ---- Cenário 2: aumentar clientes ----
  let c2 = null;
  if (d.ticketMedio > 0) {
    const necessarios = Math.max(Math.ceil((meta + d.despesasTotais) / d.ticketMedio), 0);
    const tiers = [necessarios, necessarios + 2].filter((n, i, arr) => arr.indexOf(n) === i);
    c2 = tiers.map((n) => ({ clientes: n, bruto: n * d.ticketMedio, liquido: n * d.ticketMedio - d.despesasTotais }));
  }

  // ---- Cenário 3: aumentar ticket médio ----
  let c3 = null;
  if (d.clientesAtivos > 0) {
    const necessario = (meta + d.despesasTotais) / d.clientesAtivos;
    const tierA = Math.max(Math.ceil(necessario / 50) * 50, 0);
    const tiers = [tierA, tierA + 500];
    c3 = tiers.map((t) => ({ ticket: t, bruto: d.clientesAtivos * t, liquido: d.clientesAtivos * t - d.despesasTotais }));
  }

  // ---- Cenário 4: reduzir despesas ----
  let c4 = null;
  const reducaoNecessaria = d.despesasTotais - (d.receitaBruta - meta);
  if (reducaoNecessaria > 0) {
    const tiers = [Math.round(reducaoNecessaria), Math.round(reducaoNecessaria + 500)];
    c4 = tiers.map((r) => ({ reducao: r, novaDespesa: Math.max(d.despesasTotais - r, 0), liquido: d.receitaBruta - Math.max(d.despesasTotais - r, 0) }));
  }

  // ---- Combinações inteligentes ----
  let combos = [];
  if (gap > 0) {
    if (d.ticketMedio > 0 && d.clientesAtivos > 0) {
      const metade = gap / 2;
      const novosClientes = Math.max(Math.ceil(metade / d.ticketMedio), 0);
      const incTicket = Math.max(Math.ceil((metade / d.clientesAtivos) / 50) * 50, 0);
      const liquidoA = (d.clientesAtivos + novosClientes) * (d.ticketMedio + incTicket) - d.despesasTotais;
      combos.push({ texto: `${novosClientes} cliente${novosClientes === 1 ? '' : 's'} novo${novosClientes === 1 ? '' : 's'} + ticket médio ${fmtMoeda(d.ticketMedio + incTicket)}`, liquido: liquidoA });
    }
    if (d.ticketMedio > 0) {
      const reducaoB = Math.min(gap / 2, d.despesasTotais * 0.4);
      const restante = gap - reducaoB;
      const novosClientesB = Math.max(Math.ceil(restante / d.ticketMedio), 0);
      const novaDespesaB = Math.max(d.despesasTotais - reducaoB, 0);
      const liquidoB = (d.clientesAtivos + novosClientesB) * d.ticketMedio - novaDespesaB;
      combos.push({ texto: `${novosClientesB} cliente${novosClientesB === 1 ? '' : 's'} novo${novosClientesB === 1 ? '' : 's'} + reduzir despesas em ${fmtMoeda(reducaoB)}`, liquido: liquidoB });
    }
  }

  // ---- Insights ----
  const insights = [];
  if (d.receitaBruta > 0) {
    if (d.margem >= 70) insights.push(`Sua margem está em ${d.margem}% — muito saudável.`);
    else if (d.margem >= 40) insights.push(`Sua margem está em ${d.margem}% — saudável, dá pra melhorar.`);
    else insights.push(`Sua margem está em ${d.margem}% — vale revisar as despesas.`);
  }
  if (d.crescimento3m !== null) {
    if (d.crescimento3m > 0) insights.push(`Nos últimos 3 meses sua receita cresceu ${d.crescimento3m}% — mantenha esse ritmo.`);
    else if (d.crescimento3m < 0) insights.push(`Nos últimos 3 meses sua receita caiu ${Math.abs(d.crescimento3m)}% — hora de acelerar a prospecção.`);
    else insights.push('Sua receita está estável nos últimos 3 meses.');
  } else {
    insights.push('Ainda não há histórico de 3 meses pra calcular a tendência de crescimento.');
  }
  if (d.ticketMax > 0 && d.ticketMax > d.ticketMin * 1.5) {
    insights.push(`Seu maior cliente paga ${fmtMoeda(d.ticketMax)} e o menor ${fmtMoeda(d.ticketMin)} — negociar reajuste dos menores ajuda a fechar o gap.`);
  }
  if (d.receitaRecorrenteMes > 0) {
    insights.push(`${fmtMoeda(d.receitaRecorrenteMes)}/mês já é receita recorrente — isso te dá previsibilidade de caixa.`);
  }

  el.innerHTML = `
    <div class="section-title">Status da meta</div>
    <div class="panel" style="border-left:4px solid ${statusCor};background:${statusBg};margin-bottom:14px;">
      <div style="font-size:14px;font-weight:800;color:${statusCor};">${status}</div>
    </div>

    <div class="section-title">Cenários</div>

    <div class="panel">
      <div class="panel-title">1 · Sem mudar nada</div>
      <div class="panel-sub">${d.clientesAtivos} clientes × ${fmtMoeda(d.ticketMedio)} − ${fmtMoeda(d.despesasTotais)} despesas</div>
      <div style="font-size:20px;font-weight:800;color:${c1Bate ? 'var(--positivo)' : 'var(--negativo)'};">${fmtMoeda(d.lucroLiquido)}</div>
      <div style="font-size:11px;color:${c1Bate ? 'var(--positivo)' : 'var(--negativo)'};font-weight:600;">${c1Bate ? '✓ Meta atingida' : '❌ Meta não atingida'}</div>
    </div>

    <div class="panel">
      <div class="panel-title">2 · Aumentar clientes</div>
      ${c2 ? c2.map((t) => `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;"><span>${t.clientes} clientes × ${fmtMoeda(d.ticketMedio)}</span><strong style="color:${t.liquido >= meta ? 'var(--positivo)' : 'var(--text)'}">${fmtMoeda(t.liquido)}</strong></div>`).join('')
      : '<div class="empty-state">Cadastre clientes com ticket definido pra calcular este cenário.</div>'}
      ${c2 ? `<div class="panel-sub" style="margin-top:6px;">Recomendação: feche mais ${Math.max(c2[0].clientes - d.clientesAtivos, 0)} cliente${Math.max(c2[0].clientes - d.clientesAtivos, 0) === 1 ? '' : 's'} novo${Math.max(c2[0].clientes - d.clientesAtivos, 0) === 1 ? '' : 's'}.</div>` : ''}
    </div>

    <div class="panel">
      <div class="panel-title">3 · Aumentar ticket médio</div>
      ${c3 ? c3.map((t) => `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;"><span>${d.clientesAtivos} clientes × ${fmtMoeda(t.ticket)}</span><strong style="color:${t.liquido >= meta ? 'var(--positivo)' : 'var(--text)'}">${fmtMoeda(t.liquido)}</strong></div>`).join('')
      : '<div class="empty-state">Cadastre ao menos 1 cliente ativo pra calcular este cenário.</div>'}
      ${c3 ? `<div class="panel-sub" style="margin-top:6px;">Recomendação: aumente o ticket em ${fmtMoeda(Math.max(c3[0].ticket - d.ticketMedio, 0))} por cliente.</div>` : ''}
    </div>

    <div class="panel">
      <div class="panel-title">4 · Reduzir despesas</div>
      ${c4 ? c4.map((t) => `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;"><span>Reduzir ${fmtMoeda(t.reducao)} (despesa vai a ${fmtMoeda(t.novaDespesa)})</span><strong style="color:var(--positivo)">${fmtMoeda(t.liquido)}</strong></div>`).join('')
      : '<div class="empty-state">Reduzir despesas sozinho não é suficiente pra bater essa meta — combine com os outros cenários.</div>'}
      ${c4 ? `<div class="panel-sub" style="margin-top:6px;">Recomendação: renegocie Apps/Softwares, tarifas bancárias ou outras despesas administrativas.</div>` : ''}
    </div>

    ${combos.length ? `
    <div class="section-title" style="margin-top:16px;">Combinações inteligentes</div>
    ${combos.map((c) => `<div class="panel" style="border-left:4px solid var(--purple);">
      <div style="font-size:12px;color:var(--text2);">${c.texto}</div>
      <div style="font-size:16px;font-weight:800;color:${c.liquido >= meta ? 'var(--positivo)' : 'var(--text)'};margin-top:4px;">${fmtMoeda(c.liquido)}</div>
    </div>`).join('')}` : ''}

    <div class="section-title" style="margin-top:16px;">Insights</div>
    <div class="panel">
      ${insights.map((i) => `<div style="font-size:12px;color:var(--text2);line-height:1.7;padding:3px 0;">• ${i}</div>`).join('')}
    </div>

    ${mtModo === 'mes' ? `<div style="margin-top:14px;">
      <button class="btn btn-primary" style="width:100%;padding:13px;" onclick="mtSalvarMeta()">✓ Salvar meta de ${nomeMesLongo(mtMes)}</button>
    </div>` : ''}
  `;
}

async function mtSalvarMeta() {
  const dados = mtDadosBase();
  const payload = {
    mes: mtMes,
    meta_lucro: mtLucroDesejado,
    meta_receita: mtLucroDesejado + dados.despesasTotais,
    dados_historicos: { ...dados, calculado_em: new Date().toISOString() },
  };
  const existente = State.metasFinanceiras.find((m) => m.mes === mtMes);
  let error;
  if (existente) ({ error } = await db.from('metas_financeiras').update(payload).eq('id', existente.id));
  else ({ error } = await db.from('metas_financeiras').insert([payload]));
  if (error) { alert('Erro: ' + error.message); return; }
  showSaving();
  const r = await db.from('metas_financeiras').select('*');
  State.metasFinanceiras = r.data || [];
  renderMetasInteligentes();
}

function mtRenderHistorico() {
  const existing = document.getElementById('mt-historico');
  if (existing) existing.remove();
  if (!State.metasFinanceiras.length) return;

  const wrap = document.createElement('div');
  wrap.id = 'mt-historico';
  wrap.className = 'section';
  const ordenado = [...State.metasFinanceiras].sort((a, b) => b.mes.localeCompare(a.mes));
  wrap.innerHTML = `
    <div class="section-title">Histórico: meta vs. realizado</div>
    <div class="simple-list">
      ${ordenado.map((m) => {
        const realizado = montarDRE(m.mes).lucroLiquido;
        const pct = m.meta_lucro > 0 ? Math.round(realizado / m.meta_lucro * 100) : 0;
        const bateu = realizado >= m.meta_lucro;
        return `<div class="simple-row">
          <div class="simple-row-main">
            <div class="simple-row-title">${nomeMesLongo(m.mes)}</div>
            <div class="simple-row-sub">Meta: ${fmtMoeda(m.meta_lucro)} · Realizado: ${fmtMoeda(realizado)}</div>
          </div>
          <span class="badge ${bateu ? 'badge-green' : 'badge-amber'}">${pct}%</span>
        </div>`;
      }).join('')}
    </div>
  `;
  document.getElementById('page-metas').appendChild(wrap);
}
