let fnReceitaEditId = null;
let fnDespesaEditId = null;
let fnCharts2 = {};

function dataPadraoPeriodo() {
  return State.periodo === mesAtual() ? hj() : State.periodo + '-01';
}

function clientesSemRecorrenciaNoMes(mes) {
  return State.clientesAtivos.filter((c) =>
    c.status === 'ativo' && c.frequencia === 'mensal' && Number(c.ticket_mensal) > 0 &&
    !State.receitas.some((r) => r.cliente_id === c.id && r.mes_projecao === mes)
  );
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

function calcularReceitaVsMeta(mes) {
  const dre = montarDRE(mes);
  const metaSalva = State.metasFinanceiras.find((m) => m.mes === mes);
  const meta = metaSalva ? metaSalva.meta_receita : State.metas.mm_fat;
  return { atual: dre.receitaTotal, meta };
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

// ===================== FLUXO DE CAIXA =====================
function fluxoDoPeriodo(mes) {
  const receitas = State.receitas.filter((r) => r.mes_projecao === mes).map((r) => {
    const cliente = State.clientesAtivos.find((c) => c.id === r.cliente_id);
    return {
      tipo: 'receita', id: r.id, data: r.data, valor: Number(r.valor || 0),
      titulo: cliente ? cliente.empresa : (r.categoria || 'Receita'),
      sub: [r.categoria, r.subcategoria, r.descricao].filter(Boolean).join(' · '),
    };
  });
  const despesas = State.despesas.filter((d) => d.mes_projecao === mes).map((d) => ({
    tipo: 'despesa', id: d.id, data: d.data, valor: Number(d.valor || 0),
    titulo: d.categoria,
    sub: [d.subcategoria, d.descricao].filter(Boolean).join(' · '),
  }));
  return [...receitas, ...despesas].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
}

function renderFluxoCaixa(mes) {
  const el = document.getElementById('fn-fluxo-list');
  if (!el) return;
  const itens = fluxoDoPeriodo(mes);
  if (!itens.length) { el.innerHTML = `<div class="empty-state">Nenhum lançamento em ${nomeMesLongo(mes)}.</div>`; return; }

  const porDia = {};
  itens.forEach((it) => { if (!porDia[it.data]) porDia[it.data] = []; porDia[it.data].push(it); });
  const dias = Object.keys(porDia).sort((a, b) => b.localeCompare(a));

  el.innerHTML = dias.map((d) => {
    const linhas = porDia[d];
    const totalDia = linhas.reduce((s, it) => s + (it.tipo === 'receita' ? it.valor : -it.valor), 0);
    const header = `<div class="day-hdr"><div class="day-tit">${fmtD(d)}</div><div class="day-cnt">${linhas.length}</div><div class="day-hdr-total" style="color:${totalDia >= 0 ? 'var(--green2)' : 'var(--red)'}">${totalDia >= 0 ? '+' : '−'}${fmtMoeda2(Math.abs(totalDia))}</div></div>`;
    const rows = linhas.map((it) => `<div class="fluxo-row">
      <div class="fluxo-desc">
        <div class="fluxo-desc-cat">${it.titulo}</div>
        ${it.sub ? `<div class="fluxo-desc-sub">${it.sub}</div>` : ''}
      </div>
      <div class="fluxo-valor" style="color:${it.tipo === 'receita' ? 'var(--green2)' : 'var(--red)'}">${it.tipo === 'receita' ? '+' : '−'}${fmtMoeda2(it.valor)}</div>
      <div class="fluxo-acts">
        <button class="btn btn-xs" onclick="${it.tipo === 'receita' ? 'abrirModalReceita' : 'abrirModalDespesa'}('${it.id}')">editar</button>
        <button class="btn btn-xs btn-danger" onclick="${it.tipo === 'receita' ? 'excluirReceita' : 'excluirDespesa'}('${it.id}')">×</button>
      </div>
    </div>`).join('');
    return `<div class="day-group">${header}<div class="item-card">${rows}</div></div>`;
  }).join('');
}

function renderFinanceiro() {
  if (!State.periodo) State.periodo = mesAtual();
  const mes = State.periodo;
  const dre = montarDRE(mes);
  const pendentes = mes === mesAtual() ? clientesSemRecorrenciaNoMes(mes) : [];

  const el = document.getElementById('page-financeiro');
  el.innerHTML = `
    ${htmlSeletorPeriodo()}

    <div class="section">
      <div class="section-title">Resumo financeiro</div>
      <div class="panel-sub" style="margin-top:-4px;">O DRE completo e os gráficos por categoria estão no Dashboard.</div>
      <div class="card-grid-2" style="margin-bottom:14px;">
        <div class="stat-card"><div class="stat-lbl">Receita</div><div class="stat-val" style="color:var(--green2)">${fmtMoeda(dre.receitaTotal)}</div></div>
        <div class="stat-card"><div class="stat-lbl">Despesas</div><div class="stat-val" style="color:var(--red)">${fmtMoeda(dre.deducoes + dre.totalDespesasOperacionais)}</div></div>
        <div class="stat-card"><div class="stat-lbl">Lucro líquido</div><div class="stat-val" style="color:${dre.lucroLiquido >= 0 ? 'var(--green2)' : 'var(--red)'}">${fmtMoeda(dre.lucroLiquido)}</div></div>
        <div class="stat-card"><div class="stat-lbl">Margem</div><div class="stat-val">${dre.margem}%</div></div>
      </div>
    </div>

    ${pendentes.length ? `
    <div class="section">
      <div class="panel" style="border-left:4px solid var(--amber);background:#FFFBEB;">
        <div class="panel-title">${pendentes.length} cliente${pendentes.length === 1 ? '' : 's'} recorrente${pendentes.length === 1 ? '' : 's'} sem receita lançada em ${nomeMesLongo(mes)}</div>
        <div class="panel-sub">${pendentes.map((c) => c.empresa).join(', ')}</div>
        <button class="btn btn-primary btn-sm" onclick="fnGerarRecorrencias()">Gerar receitas do mês</button>
      </div>
    </div>` : ''}

    <div class="section">
      <div class="section-title">Insights</div>
      <div class="panel" style="border-left:4px solid var(--blue);">
        ${gerarInsightsFinanceiro(mes).map((i) => `<div style="font-size:12px;color:var(--text2);line-height:1.7;">• ${i}</div>`).join('')}
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
      <div class="section-title">Fluxo de caixa</div>
      <div class="panel-sub" style="margin-top:-4px;">Retiradas de lucro e pró-labore entram como despesa, categoria "Pessoal".</div>
      <div style="display:flex;gap:8px;margin-bottom:10px;">
        <button class="btn btn-primary btn-sm" style="flex:1;" onclick="abrirModalReceita()">+ Receita</button>
        <button class="btn btn-sm" style="flex:1;border-color:#FECACA;color:var(--red);" onclick="abrirModalDespesa()">+ Despesa</button>
      </div>
      <div class="list" id="fn-fluxo-list" style="padding:0;"></div>
    </div>
  `;
  renderFluxoCaixa(mes);
  renderGraficosFinanceiro2(mes);
}

function renderGraficosFinanceiro2(mes) {
  Object.values(fnCharts2).forEach((c) => { try { c.destroy(); } catch (e) {} });
  fnCharts2 = {};

  const { atual, meta } = calcularReceitaVsMeta(mes);
  const canvasMeta = document.getElementById('fn-chart-meta');
  if (meta > 0 || atual > 0) {
    fnCharts2.meta = new Chart(canvasMeta, {
      type: 'bar',
      data: { labels: ['Atual', 'Meta'], datasets: [{ data: [atual, meta], backgroundColor: [atual >= meta && meta > 0 ? '#00C896' : '#1A3A6B', '#CBD5E0'], borderRadius: 4 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { font: { size: 10 } } }, y: { ticks: { font: { size: 11 } } } } },
    });
  } else {
    canvasMeta.parentElement.innerHTML = '<div class="empty-state">Defina uma meta em Configurações ou na aba Metas pra ver a comparação.</div>';
  }

  const evolucao = calcularEvolucaoTicketMedio(12);
  const canvasTicket = document.getElementById('fn-chart-ticket');
  if (evolucao.some((e) => e.ticket > 0)) {
    fnCharts2.ticket = new Chart(canvasTicket, {
      type: 'line',
      data: {
        labels: evolucao.map((e) => nomeMesShort(e.mes)),
        datasets: [{ data: evolucao.map((e) => Math.round(e.ticket)), borderColor: '#7C3AED', backgroundColor: 'rgba(124,58,237,0.1)', fill: true, tension: 0.3, pointRadius: 3 }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { font: { size: 10 } } }, y: { beginAtZero: true, ticks: { font: { size: 10 } } } } },
    });
  } else {
    canvasTicket.parentElement.innerHTML = '<div class="empty-state">Ainda não há receita vinculada a clientes nos últimos 12 meses.</div>';
  }
}

async function fnGerarRecorrencias() {
  const mes = mesAtual();
  const pendentes = clientesSemRecorrenciaNoMes(mes);
  if (!pendentes.length) return;
  const payload = pendentes.map((c) => ({
    cliente_id: c.id,
    produto_id: c.produto_id || null,
    valor: c.ticket_mensal,
    data: hj(),
    mes_projecao: mes,
    categoria: 'Serviços recorrentes',
    e_recorrente: true,
    origem: 'cliente_crm',
    descricao: `${c.empresa} — recorrência mensal`,
  }));
  const { error } = await db.from('receitas').insert(payload);
  if (error) { alert('Erro: ' + error.message); return; }
  showSaving();
  const r = await db.from('receitas').select('*').order('data', { ascending: false });
  State.receitas = r.data || [];
  renderFinanceiro();
}

// ===================== RECEITA =====================
function fnAtualizarSubcategoriasReceita() {
  const catNome = document.getElementById('rc-categoria').value;
  const cat = State.categoriasReceita.find((c) => c.nome_principal === catNome);
  const selSub = document.getElementById('rc-subcategoria');
  const subs = (cat && cat.subcategorias) || [];
  selSub.innerHTML = '<option value="">Nenhuma</option>' + subs.map((s) => `<option>${s}</option>`).join('');
}

function abrirModalReceita(id) {
  fnReceitaEditId = id || null;
  document.getElementById('rc-tit').textContent = id ? 'Editar receita' : 'Nova receita';
  const selProd = document.getElementById('rc-produto');
  selProd.innerHTML = '<option value="">Nenhum</option>' + State.produtos.filter(p => p.ativo).map((p) => `<option value="${p.id}">${p.nome}</option>`).join('');
  const selCat = document.getElementById('rc-categoria');
  selCat.innerHTML = State.categoriasReceita.map((c) => `<option>${c.nome_principal}</option>`).join('');
  if (id) {
    const r = State.receitas.find((x) => x.id === id);
    selCat.value = r.categoria || (State.categoriasReceita[0] && State.categoriasReceita[0].nome_principal) || '';
    fnAtualizarSubcategoriasReceita();
    document.getElementById('rc-subcategoria').value = r.subcategoria || '';
    document.getElementById('rc-valor').value = r.valor;
    document.getElementById('rc-data').value = r.data;
    selProd.value = r.produto_id || '';
    document.getElementById('rc-descricao').value = r.descricao || '';
    document.getElementById('rc-recorrente').checked = r.e_recorrente;
  } else {
    selCat.value = State.categoriasReceita[0] ? State.categoriasReceita[0].nome_principal : '';
    fnAtualizarSubcategoriasReceita();
    document.getElementById('rc-valor').value = '';
    document.getElementById('rc-data').value = dataPadraoPeriodo();
    selProd.value = '';
    document.getElementById('rc-descricao').value = '';
    document.getElementById('rc-recorrente').checked = false;
  }
  abrirOv('ov-receita');
}

async function salvarReceita() {
  const valor = parseFloat(document.getElementById('rc-valor').value);
  if (!valor) { alert('Informe o valor.'); return; }
  const data = document.getElementById('rc-data').value;
  const payload = {
    valor,
    data,
    mes_projecao: data.slice(0, 7),
    categoria: document.getElementById('rc-categoria').value,
    subcategoria: document.getElementById('rc-subcategoria').value || null,
    produto_id: document.getElementById('rc-produto').value || null,
    descricao: document.getElementById('rc-descricao').value.trim(),
    e_recorrente: document.getElementById('rc-recorrente').checked,
    origem: 'manual',
  };
  let error;
  if (fnReceitaEditId) ({ error } = await db.from('receitas').update(payload).eq('id', fnReceitaEditId));
  else ({ error } = await db.from('receitas').insert([payload]));
  if (error) { alert('Erro: ' + error.message); return; }
  showSaving();
  fecharOv('ov-receita');
  const r = await db.from('receitas').select('*').order('data', { ascending: false });
  State.receitas = r.data || [];
  renderFinanceiro();
}

async function excluirReceita(id) {
  if (!confirm('Excluir esta receita?')) return;
  await db.from('receitas').delete().eq('id', id);
  showSaving();
  State.receitas = State.receitas.filter((r) => r.id !== id);
  renderFinanceiro();
}

// ===================== DESPESA =====================
function fnAtualizarSubcategorias() {
  const catNome = document.getElementById('ds-categoria').value;
  const cat = State.categoriasDespesa.find((c) => c.nome_principal === catNome);
  const selSub = document.getElementById('ds-subcategoria');
  const subs = (cat && cat.subcategorias) || [];
  selSub.innerHTML = '<option value="">Nenhuma</option>' + subs.map((s) => `<option>${s}</option>`).join('');
}

function fnToggleRecorrenteAte() {
  document.getElementById('row-recorrente-ate').style.display = document.getElementById('ds-recorrente').checked ? 'block' : 'none';
}

function abrirModalDespesa(id) {
  fnDespesaEditId = id || null;
  document.getElementById('ds-tit').textContent = id ? 'Editar despesa' : 'Nova despesa';
  const selCat = document.getElementById('ds-categoria');
  selCat.innerHTML = State.categoriasDespesa.map((c) => `<option>${c.nome_principal}</option>`).join('');
  if (id) {
    const d = State.despesas.find((x) => x.id === id);
    selCat.value = d.categoria;
    fnAtualizarSubcategorias();
    document.getElementById('ds-subcategoria').value = d.subcategoria || '';
    document.getElementById('ds-valor').value = d.valor;
    document.getElementById('ds-data').value = d.data;
    document.getElementById('ds-descricao').value = d.descricao || '';
    document.getElementById('ds-recorrente').checked = d.e_recorrente;
    document.getElementById('ds-recorrente-ate').value = d.recorrente_ate || '';
  } else {
    selCat.value = State.categoriasDespesa[0] ? State.categoriasDespesa[0].nome_principal : '';
    fnAtualizarSubcategorias();
    document.getElementById('ds-valor').value = '';
    document.getElementById('ds-data').value = dataPadraoPeriodo();
    document.getElementById('ds-descricao').value = '';
    document.getElementById('ds-recorrente').checked = false;
    document.getElementById('ds-recorrente-ate').value = '';
  }
  fnToggleRecorrenteAte();
  abrirOv('ov-despesa');
}

async function salvarDespesa() {
  const valor = parseFloat(document.getElementById('ds-valor').value);
  if (!valor) { alert('Informe o valor.'); return; }
  const data = document.getElementById('ds-data').value;
  const payload = {
    categoria: document.getElementById('ds-categoria').value,
    subcategoria: document.getElementById('ds-subcategoria').value || null,
    valor,
    data,
    mes_projecao: data.slice(0, 7),
    descricao: document.getElementById('ds-descricao').value.trim(),
    e_recorrente: document.getElementById('ds-recorrente').checked,
    recorrente_ate: document.getElementById('ds-recorrente').checked ? (document.getElementById('ds-recorrente-ate').value || null) : null,
  };
  let error;
  if (fnDespesaEditId) ({ error } = await db.from('despesas').update(payload).eq('id', fnDespesaEditId));
  else ({ error } = await db.from('despesas').insert([payload]));
  if (error) { alert('Erro: ' + error.message); return; }
  showSaving();
  fecharOv('ov-despesa');
  const r = await db.from('despesas').select('*').order('data', { ascending: false });
  State.despesas = r.data || [];
  renderFinanceiro();
}

async function excluirDespesa(id) {
  if (!confirm('Excluir esta despesa?')) return;
  await db.from('despesas').delete().eq('id', id);
  showSaving();
  State.despesas = State.despesas.filter((d) => d.id !== id);
  renderFinanceiro();
}
