let fnReceitaEditId = null;
let fnDespesaEditId = null;
let fnFiltroTipo = 'todos'; // 'todos' | 'receita' | 'despesa'

function dataPadraoPeriodo() {
  return State.periodo === mesAtual() ? hj() : State.periodo + '-01';
}

function clientesSemRecorrenciaNoMes(mes) {
  return State.clientesAtivos.filter((c) =>
    c.status === 'ativo' && c.frequencia === 'mensal' && Number(c.ticket_mensal) > 0 &&
    !State.receitas.some((r) => r.cliente_id === c.id && r.mes_projecao === mes)
  );
}

// ===================== HELPERS DE PAGO/RECEBIDO =====================
function fnSyncRecebidoCheckbox() {
  if (fnReceitaEditId) return;
  const data = document.getElementById('rc-data').value;
  document.getElementById('rc-recebido').checked = !!data && data <= hj();
}

function fnSyncPagoCheckbox() {
  if (fnDespesaEditId) return;
  const data = document.getElementById('ds-data').value;
  document.getElementById('ds-pago').checked = !!data && data <= hj();
}

function fnToggleParcelar() {
  const parcelando = document.getElementById('ds-parcelar').checked;
  document.getElementById('row-qtd-parcelas').style.display = parcelando ? 'block' : 'none';
  document.getElementById('row-recorrente-row').style.display = parcelando ? 'none' : '';
  document.getElementById('ds-valor-lbl').textContent = parcelando ? '(de cada parcela)' : '(R$)';
  document.getElementById('ds-data-lbl').textContent = parcelando ? '(1ª parcela)' : '';
  if (parcelando) {
    document.getElementById('ds-recorrente').checked = false;
    fnToggleRecorrenteAte();
  }
}

// ===================== RECORRÊNCIA (mensal/quinzenal/semanal/personalizado) =====================
function somarDiasData(dataISO, nDias) {
  const [y, m, d] = dataISO.split('-').map(Number);
  const nova = new Date(y, m - 1, d + nDias);
  return nova.getFullYear() + '-' + String(nova.getMonth() + 1).padStart(2, '0') + '-' + String(nova.getDate()).padStart(2, '0');
}

function fnAvancarData(dataISO, frequencia, intervaloDias) {
  if (frequencia === 'quinzenal') return somarDiasData(dataISO, 15);
  if (frequencia === 'semanal') return somarDiasData(dataISO, 7);
  if (frequencia === 'trimestral') return somarMesData(dataISO, 3);
  if (frequencia === 'semestral') return somarMesData(dataISO, 6);
  if (frequencia === 'anual') return somarMesData(dataISO, 12);
  if (frequencia === 'personalizado') return somarDiasData(dataISO, Math.max(parseInt(intervaloDias) || 30, 1));
  return somarMesData(dataISO, 1);
}

function fnGerarDatasRecorrencia(dataInicial, frequencia, intervaloDias, dataLimiteOpcional) {
  const [y, m, d] = dataInicial.split('-').map(Number);
  const horizonte = new Date(y, m - 1 + 12, d);
  const limite = dataLimiteOpcional ? new Date(dataLimiteOpcional + 'T00:00:00') : null;
  const dataLimite = limite && limite < horizonte ? limite : horizonte;
  const datas = [dataInicial];
  let atual = dataInicial;
  while (datas.length < 36) {
    atual = fnAvancarData(atual, frequencia, intervaloDias);
    if (new Date(atual + 'T00:00:00') > dataLimite) break;
    datas.push(atual);
  }
  return datas;
}

function fnToggleRecorrenciaReceita() {
  const ativo = document.getElementById('rc-recorrente').checked;
  document.getElementById('row-rc-frequencia').style.display = ativo ? 'flex' : 'none';
  document.getElementById('row-rc-intervalo').style.display = ativo && document.getElementById('rc-frequencia').value === 'personalizado' ? 'block' : 'none';
}

// ===================== STATUS DA CONTA (vencido / vence hoje / a vencer / pago) =====================
function fnStatusConta(dataVencimento, pago) {
  if (pago) return { label: 'Pago', cls: 'badge-green' };
  const h = hj();
  if (dataVencimento < h) return { label: 'Vencido', cls: 'badge-red' };
  if (dataVencimento === h) return { label: 'Vence hoje', cls: 'badge-amber' };
  return { label: 'A vencer', cls: 'badge-blue' };
}

// ===================== RESUMO (cards) =====================
function calcularResumoContas(mes) {
  const receitasMes = State.receitas.filter((r) => r.status === 'ativa' && r.mes_projecao === mes);
  const despesasMes = State.despesas.filter((d) => d.mes_projecao === mes);
  return {
    totalReceber: receitasMes.filter((r) => !r.recebido).reduce((s, r) => s + Number(r.valor || 0), 0),
    totalRecebido: receitasMes.filter((r) => r.recebido).reduce((s, r) => s + Number(r.valor || 0), 0),
    totalPagar: despesasMes.filter((d) => !d.pago).reduce((s, d) => s + Number(d.valor || 0), 0),
    totalPago: despesasMes.filter((d) => d.pago).reduce((s, d) => s + Number(d.valor || 0), 0),
  };
}

// ===================== CONTAS A PAGAR E RECEBER (ledger) =====================
function fluxoDoPeriodo(mes) {
  const receitas = State.receitas.filter((r) => r.status === 'ativa' && r.mes_projecao === mes).map((r) => {
    const cliente = State.clientesAtivos.find((c) => c.id === r.cliente_id);
    return {
      tipo: 'receita', id: r.id, data: r.data, valor: Number(r.valor || 0),
      titulo: cliente ? cliente.empresa : (r.categoria || 'Receita'),
      sub: [r.categoria, r.subcategoria, r.descricao].filter(Boolean).join(' · '),
      confirmado: r.recebido,
      parcela: r.parcela_total > 1 ? `${r.parcela_atual}/${r.parcela_total}` : null,
    };
  });
  const despesas = State.despesas.filter((d) => d.mes_projecao === mes).map((d) => ({
    tipo: 'despesa', id: d.id, data: d.data, valor: Number(d.valor || 0),
    titulo: d.categoria,
    sub: [d.subcategoria, d.descricao].filter(Boolean).join(' · '),
    confirmado: d.pago,
    parcela: d.parcela_total > 1 ? `${d.parcela_atual}/${d.parcela_total}` : null,
  }));
  return [...receitas, ...despesas].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
}

function fnSetFiltroTipo(tipo) {
  fnFiltroTipo = tipo;
  renderFiltroTipoFinanceiro();
  renderFluxoCaixa(State.periodo);
}

function renderFiltroTipoFinanceiro() {
  const el = document.getElementById('fn-filtro-tipo');
  if (!el) return;
  const opts = [['todos', 'Todos'], ['receita', 'Receitas'], ['despesa', 'Despesas']];
  el.innerHTML = opts.map(([v, l]) => `<span class="pill ${fnFiltroTipo === v ? 'on' : ''}" onclick="fnSetFiltroTipo('${v}')">${l}</span>`).join('');
}

function renderFluxoCaixa(mes) {
  const el = document.getElementById('fn-fluxo-list');
  if (!el) return;
  let itens = fluxoDoPeriodo(mes);
  if (fnFiltroTipo !== 'todos') itens = itens.filter((it) => it.tipo === fnFiltroTipo);
  if (!itens.length) { el.innerHTML = `<div class="empty-state">Nenhum lançamento com vencimento em ${nomeMesLongo(mes)}.</div>`; return; }

  const porDia = {};
  itens.forEach((it) => { if (!porDia[it.data]) porDia[it.data] = []; porDia[it.data].push(it); });
  const dias = Object.keys(porDia).sort((a, b) => b.localeCompare(a));

  el.innerHTML = dias.map((d) => {
    const linhas = porDia[d];
    const totalDia = linhas.reduce((s, it) => s + (it.tipo === 'receita' ? it.valor : -it.valor), 0);
    const header = `<div class="day-hdr"><div class="day-tit">${fmtD(d)}</div><div class="day-cnt">${linhas.length}</div><div class="day-hdr-total" style="color:${totalDia >= 0 ? 'var(--positivo)' : 'var(--negativo)'}">${totalDia >= 0 ? '+' : '−'}${fmtMoeda2(Math.abs(totalDia))}</div></div>`;
    const rows = linhas.map((it) => {
      const st = fnStatusConta(it.data, it.confirmado);
      const toggleFn = it.tipo === 'receita'
        ? (it.confirmado ? `fnDesmarcarRecebido('${it.id}')` : `abrirModalConfirmarData('receita','${it.id}','${it.data}')`)
        : (it.confirmado ? `fnDesmarcarPago('${it.id}')` : `abrirModalConfirmarData('despesa','${it.id}','${it.data}')`);
      const toggleTit = it.confirmado ? 'Clique para reabrir' : (it.tipo === 'receita' ? 'Marcar como recebido' : 'Marcar como pago');
      return `<div class="fluxo-row">
      <div class="fluxo-check ${it.confirmado ? 'on' : ''}" onclick="${toggleFn}" title="${toggleTit}">${it.confirmado ? '✅' : ''}</div>
      <div class="fluxo-desc">
        <div class="fluxo-desc-cat">${it.titulo}${it.parcela ? ` <span class="badge badge-gray">${it.parcela}</span>` : ''}</div>
        ${it.sub ? `<div class="fluxo-desc-sub">${it.sub}</div>` : ''}
        <span class="badge ${st.cls}" style="margin-top:4px;display:inline-block;">${st.label}</span>
      </div>
      <div class="fluxo-valor" style="color:${it.tipo === 'receita' ? 'var(--positivo)' : 'var(--negativo)'}">${it.tipo === 'receita' ? '+' : '−'}${fmtMoeda2(it.valor)}</div>
      <div class="fluxo-acts">
        <button class="btn btn-xs" onclick="${it.tipo === 'receita' ? 'abrirModalReceita' : 'abrirModalDespesa'}('${it.id}')">editar</button>
        <button class="btn btn-xs btn-danger" onclick="${it.tipo === 'receita' ? 'excluirReceita' : 'excluirDespesa'}('${it.id}')">×</button>
      </div>
    </div>`;
    }).join('');
    return `<div class="day-group">${header}<div class="item-card">${rows}</div></div>`;
  }).join('');
}

let cdTipo = null;
let cdId = null;

function abrirModalConfirmarData(tipo, id, dataSugerida) {
  cdTipo = tipo;
  cdId = id;
  document.getElementById('cd-tit').textContent = tipo === 'receita' ? 'Confirmar recebimento' : 'Confirmar pagamento';
  document.getElementById('cd-lbl').textContent = tipo === 'receita' ? 'Data em que recebeu' : 'Data em que pagou';
  document.getElementById('cd-data').value = dataSugerida || hj();
  abrirOv('ov-confirmar-data');
}

function cdConfirmar() {
  const data = document.getElementById('cd-data').value;
  if (!data) { alert('Informe a data.'); return; }
  fecharOv('ov-confirmar-data');
  if (cdTipo === 'receita') fnMarcarRecebido(cdId, data);
  else fnMarcarPago(cdId, data);
}

async function fnMarcarPago(id, dataVencimento) {
  const { error } = await db.from('despesas').update({ pago: true, data_pagamento: dataVencimento || hj() }).eq('id', id);
  if (error) { alert('Erro: ' + error.message); return; }
  showSaving();
  const r = await db.from('despesas').select('*').order('data', { ascending: true });
  State.despesas = r.data || [];
  renderFinanceiro();
}

async function fnDesmarcarPago(id) {
  const { error } = await db.from('despesas').update({ pago: false, data_pagamento: null }).eq('id', id);
  if (error) { alert('Erro: ' + error.message); return; }
  showSaving();
  const r = await db.from('despesas').select('*').order('data', { ascending: true });
  State.despesas = r.data || [];
  renderFinanceiro();
}

async function fnMarcarRecebido(id, dataVencimento) {
  const { error } = await db.from('receitas').update({ recebido: true, data_recebimento: dataVencimento || hj() }).eq('id', id);
  if (error) { alert('Erro: ' + error.message); return; }
  showSaving();
  const r = await db.from('receitas').select('*').order('data', { ascending: true });
  State.receitas = r.data || [];
  renderFinanceiro();
}

async function fnDesmarcarRecebido(id) {
  const { error } = await db.from('receitas').update({ recebido: false, data_recebimento: null }).eq('id', id);
  if (error) { alert('Erro: ' + error.message); return; }
  showSaving();
  const r = await db.from('receitas').select('*').order('data', { ascending: true });
  State.receitas = r.data || [];
  renderFinanceiro();
}

function renderFinanceiro() {
  if (!State.periodo) State.periodo = mesAtual();
  const mes = State.periodo;
  const pendentes = mes === mesAtual() ? clientesSemRecorrenciaNoMes(mes) : [];
  const resumo = calcularResumoContas(mes);

  const el = document.getElementById('page-financeiro');
  el.innerHTML = `
    ${htmlSeletorPeriodo()}

    <div class="section">
      <div class="section-title">Resumo do mês (por vencimento)</div>
      <div class="card-grid-2" style="margin-bottom:4px;">
        <div class="stat-card"><div class="stat-lbl">A receber</div><div class="stat-val" style="color:var(--blue)">${fmtMoeda(resumo.totalReceber)}</div></div>
        <div class="stat-card"><div class="stat-lbl">Recebido</div><div class="stat-val" style="color:var(--positivo)">${fmtMoeda(resumo.totalRecebido)}</div></div>
        <div class="stat-card"><div class="stat-lbl">A pagar</div><div class="stat-val" style="color:var(--amber)">${fmtMoeda(resumo.totalPagar)}</div></div>
        <div class="stat-card"><div class="stat-lbl">Pago</div><div class="stat-val" style="color:var(--negativo)">${fmtMoeda(resumo.totalPago)}</div></div>
      </div>
    </div>

    ${pendentes.length ? `
    <div class="section">
      <div class="panel" style="border-left:4px solid var(--amber);background:rgba(217,119,6,0.12);">
        <div class="panel-title">${pendentes.length} cliente${pendentes.length === 1 ? '' : 's'} recorrente${pendentes.length === 1 ? '' : 's'} sem receita lançada em ${nomeMesLongo(mes)}</div>
        <div class="panel-sub">${pendentes.map((c) => c.empresa).join(', ')}</div>
        <button class="btn btn-primary btn-sm" onclick="fnGerarRecorrencias()">Gerar receitas do mês</button>
      </div>
    </div>` : ''}

    <div class="section">
      <div class="section-title">Contas a pagar e receber</div>
      <div class="panel-sub" style="margin-top:-4px;">Organizado por vencimento. Retiradas de lucro e pró-labore entram como despesa, categoria "Pessoal". O DRE e os gráficos (regime de caixa) estão no Dashboard Financeiro.</div>
      <div style="display:flex;gap:8px;margin-bottom:10px;">
        <button class="btn btn-primary btn-sm" style="flex:1;" onclick="abrirModalReceita()">+ Receita</button>
        <button class="btn btn-sm" style="flex:1;border-color:rgba(255,107,129,0.4);color:var(--negativo);" onclick="abrirModalDespesa()">+ Despesa</button>
      </div>
      <div class="frow" id="fn-filtro-tipo" style="margin-bottom:10px;"></div>
      <div class="list" id="fn-fluxo-list" style="padding:0;"></div>
    </div>
  `;
  renderFiltroTipoFinanceiro();
  renderFluxoCaixa(mes);
}

async function fnGerarRecorrencias() {
  const mes = mesAtual();
  const pendentes = clientesSemRecorrenciaNoMes(mes);
  if (!pendentes.length) return;
  const payload = pendentes.flatMap((c) => {
    const produto = c.produto_id ? State.produtos.find((p) => p.id === c.produto_id) : null;
    const grupoId = crypto.randomUUID ? crypto.randomUUID() : (Date.now() + '-' + Math.random());
    return fnGerarDatasRecorrencia(hj(), 'mensal').map((d) => ({
      cliente_id: c.id,
      produto_id: c.produto_id || null,
      valor: c.ticket_mensal,
      data: d,
      mes_projecao: d.slice(0, 7),
      categoria: 'Receita de Serviços',
      subcategoria: produto ? produto.nome : null,
      e_recorrente: true,
      recorrencia_frequencia: 'mensal',
      grupo_recorrencia: grupoId,
      origem: 'cliente_crm',
      descricao: `${c.empresa} — recorrência mensal`,
      recebido: false,
    }));
  });
  const { error } = await db.from('receitas').insert(payload);
  if (error) { alert('Erro: ' + error.message); return; }
  showSaving();
  const r = await db.from('receitas').select('*').order('data', { ascending: true });
  State.receitas = r.data || [];
  renderFinanceiro();
}

// ===================== SELECTS AGRUPADOS POR GRUPO DRE =====================
function fnOpcoesCategoriaDespesa() {
  return ['deducao', ...GRUPO_DRE_ORDEM].map((g) => {
    const cats = State.categoriasDespesa.filter((c) => (c.grupo_dre || 'administrativas') === g);
    if (!cats.length) return '';
    return `<optgroup label="${GRUPO_DRE_LABELS[g]}">${cats.map((c) => `<option>${c.nome_principal}</option>`).join('')}</optgroup>`;
  }).join('');
}

function fnOpcoesCategoriaReceita() {
  return ['operacional', 'nao_operacional'].map((g) => {
    const cats = State.categoriasReceita.filter((c) => (c.grupo_dre || 'operacional') === g);
    if (!cats.length) return '';
    return `<optgroup label="${GRUPO_RECEITA_LABELS[g]}">${cats.map((c) => `<option>${c.nome_principal}</option>`).join('')}</optgroup>`;
  }).join('');
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
  selCat.innerHTML = fnOpcoesCategoriaReceita();
  document.getElementById('rc-frequencia').value = 'mensal';
  document.getElementById('rc-intervalo-dias').value = 30;
  if (id) {
    const r = State.receitas.find((x) => x.id === id);
    selCat.value = r.categoria || (State.categoriasReceita[0] && State.categoriasReceita[0].nome_principal) || '';
    fnAtualizarSubcategoriasReceita();
    document.getElementById('rc-subcategoria').value = r.subcategoria || '';
    document.getElementById('rc-valor').value = r.valor;
    document.getElementById('rc-data').value = r.data;
    selProd.value = r.produto_id || '';
    document.getElementById('rc-descricao').value = r.descricao || '';
    document.getElementById('rc-recebido').checked = r.recebido;
    document.getElementById('row-rc-recorrente').style.display = 'none';
    document.getElementById('row-rc-frequencia').style.display = 'none';
  } else {
    selCat.value = State.categoriasReceita[0] ? State.categoriasReceita[0].nome_principal : '';
    fnAtualizarSubcategoriasReceita();
    document.getElementById('rc-valor').value = '';
    document.getElementById('rc-data').value = dataPadraoPeriodo();
    selProd.value = '';
    document.getElementById('rc-descricao').value = '';
    document.getElementById('rc-recorrente').checked = false;
    document.getElementById('row-rc-recorrente').style.display = '';
    fnToggleRecorrenciaReceita();
    fnSyncRecebidoCheckbox();
  }
  abrirOv('ov-receita');
}

async function salvarReceita() {
  const valor = parseFloat(document.getElementById('rc-valor').value);
  if (!valor) { alert('Informe o valor.'); return; }
  const data = document.getElementById('rc-data').value;
  const recebido = document.getElementById('rc-recebido').checked;
  const categoria = document.getElementById('rc-categoria').value;
  const subcategoria = document.getElementById('rc-subcategoria').value || null;
  const produto_id = document.getElementById('rc-produto').value || null;
  const descricao = document.getElementById('rc-descricao').value.trim();
  const recorrente = !fnReceitaEditId && document.getElementById('rc-recorrente').checked;

  let error;
  if (fnReceitaEditId) {
    const payload = {
      valor, data, mes_projecao: data.slice(0, 7), categoria, subcategoria, produto_id, descricao,
      recebido, data_recebimento: recebido ? hj() : null,
    };
    ({ error } = await db.from('receitas').update(payload).eq('id', fnReceitaEditId));
  } else if (recorrente) {
    const frequencia = document.getElementById('rc-frequencia').value;
    const intervaloDias = document.getElementById('rc-intervalo-dias').value;
    const datas = fnGerarDatasRecorrencia(data, frequencia, intervaloDias);
    const grupoId = crypto.randomUUID ? crypto.randomUUID() : (Date.now() + '-' + Math.random());
    const linhas = datas.map((d, i) => ({
      valor, data: d, mes_projecao: d.slice(0, 7), categoria, subcategoria, produto_id, descricao,
      e_recorrente: true, origem: 'manual',
      recorrencia_frequencia: frequencia, recorrencia_intervalo_dias: frequencia === 'personalizado' ? parseInt(intervaloDias) || 30 : null,
      grupo_recorrencia: grupoId,
      recebido: i === 0 ? recebido : false,
      data_recebimento: i === 0 && recebido ? hj() : null,
    }));
    ({ error } = await db.from('receitas').insert(linhas));
  } else {
    const payload = {
      valor, data, mes_projecao: data.slice(0, 7), categoria, subcategoria, produto_id, descricao,
      e_recorrente: false, origem: 'manual',
      recebido, data_recebimento: recebido ? hj() : null,
    };
    ({ error } = await db.from('receitas').insert([payload]));
  }
  if (error) { alert('Erro: ' + error.message); return; }
  showSaving();
  fecharOv('ov-receita');
  const r = await db.from('receitas').select('*').order('data', { ascending: true });
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
  const ativo = document.getElementById('ds-recorrente').checked;
  document.getElementById('row-recorrente-ate').style.display = ativo ? 'block' : 'none';
  document.getElementById('row-ds-frequencia').style.display = ativo ? 'flex' : 'none';
  document.getElementById('row-ds-intervalo').style.display = ativo && document.getElementById('ds-frequencia').value === 'personalizado' ? 'block' : 'none';
  if (ativo) {
    document.getElementById('ds-parcelar').checked = false;
    document.getElementById('row-qtd-parcelas').style.display = 'none';
  }
}

function abrirModalDespesa(id) {
  fnDespesaEditId = id || null;
  document.getElementById('ds-tit').textContent = id ? 'Editar despesa' : 'Nova despesa';
  const selCat = document.getElementById('ds-categoria');
  selCat.innerHTML = fnOpcoesCategoriaDespesa();
  document.getElementById('ds-parcelar').checked = false;
  document.getElementById('row-qtd-parcelas').style.display = 'none';
  document.getElementById('ds-valor-lbl').textContent = '(R$)';
  document.getElementById('ds-data-lbl').textContent = '';
  document.getElementById('ds-frequencia').value = 'mensal';
  document.getElementById('ds-intervalo-dias').value = 30;
  if (id) {
    const d = State.despesas.find((x) => x.id === id);
    selCat.value = d.categoria;
    fnAtualizarSubcategorias();
    document.getElementById('ds-subcategoria').value = d.subcategoria || '';
    document.getElementById('ds-valor').value = d.valor;
    document.getElementById('ds-data').value = d.data;
    document.getElementById('ds-descricao').value = d.descricao || '';
    document.getElementById('ds-recorrente').checked = false;
    document.getElementById('ds-recorrente-ate').value = d.recorrente_ate || '';
    document.getElementById('ds-pago').checked = d.pago;
    document.getElementById('row-parcelar').style.display = 'none';
    document.getElementById('row-recorrente-row').style.display = 'none';
    document.getElementById('ds-pago-lbl').textContent = 'Já paguei essa despesa';
  } else {
    selCat.value = State.categoriasDespesa[0] ? State.categoriasDespesa[0].nome_principal : '';
    fnAtualizarSubcategorias();
    document.getElementById('ds-valor').value = '';
    document.getElementById('ds-data').value = dataPadraoPeriodo();
    document.getElementById('ds-descricao').value = '';
    document.getElementById('ds-recorrente').checked = false;
    document.getElementById('ds-recorrente-ate').value = '';
    document.getElementById('row-parcelar').style.display = '';
    document.getElementById('row-recorrente-row').style.display = '';
    document.getElementById('ds-pago-lbl').textContent = 'Já paguei essa despesa';
    fnSyncPagoCheckbox();
  }
  fnToggleRecorrenteAte();
  abrirOv('ov-despesa');
}

async function salvarDespesa() {
  const valor = parseFloat(document.getElementById('ds-valor').value);
  if (!valor) { alert('Informe o valor.'); return; }
  const data = document.getElementById('ds-data').value;
  const pago = document.getElementById('ds-pago').checked;
  const categoria = document.getElementById('ds-categoria').value;
  const subcategoria = document.getElementById('ds-subcategoria').value || null;
  const descricaoBase = document.getElementById('ds-descricao').value.trim();
  const parcelando = !fnDespesaEditId && document.getElementById('ds-parcelar').checked;
  const qtdParcelas = parcelando ? Math.max(2, parseInt(document.getElementById('ds-qtd-parcelas').value) || 2) : 1;
  const recorrente = !fnDespesaEditId && !parcelando && document.getElementById('ds-recorrente').checked;

  let error;
  if (fnDespesaEditId) {
    const payload = {
      categoria, subcategoria, valor, data,
      mes_projecao: data.slice(0, 7),
      descricao: descricaoBase,
      pago,
      data_pagamento: pago ? hj() : null,
    };
    ({ error } = await db.from('despesas').update(payload).eq('id', fnDespesaEditId));
  } else if (recorrente) {
    const frequencia = document.getElementById('ds-frequencia').value;
    const intervaloDias = document.getElementById('ds-intervalo-dias').value;
    const dataLimite = document.getElementById('ds-recorrente-ate').value || null;
    const datas = fnGerarDatasRecorrencia(data, frequencia, intervaloDias, dataLimite);
    const grupoId = crypto.randomUUID ? crypto.randomUUID() : (Date.now() + '-' + Math.random());
    const linhas = datas.map((d, i) => ({
      categoria, subcategoria, valor, data: d,
      mes_projecao: d.slice(0, 7),
      descricao: descricaoBase,
      e_recorrente: true,
      recorrente_ate: dataLimite,
      recorrencia_frequencia: frequencia, recorrencia_intervalo_dias: frequencia === 'personalizado' ? parseInt(intervaloDias) || 30 : null,
      grupo_recorrencia: grupoId,
      pago: i === 0 ? pago : false,
      data_pagamento: i === 0 && pago ? hj() : null,
    }));
    ({ error } = await db.from('despesas').insert(linhas));
  } else if (qtdParcelas > 1) {
    const grupoId = crypto.randomUUID ? crypto.randomUUID() : (Date.now() + '-' + Math.random());
    const parcelas = [];
    for (let i = 0; i < qtdParcelas; i++) {
      const dataParcela = somarMesData(data, i);
      parcelas.push({
        categoria, subcategoria, valor, data: dataParcela,
        mes_projecao: dataParcela.slice(0, 7),
        descricao: `${descricaoBase ? descricaoBase + ' — ' : ''}parcela ${i + 1}/${qtdParcelas}`,
        e_recorrente: false,
        parcela_atual: i + 1,
        parcela_total: qtdParcelas,
        grupo_parcelamento: grupoId,
        pago: i === 0 ? pago : false,
        data_pagamento: i === 0 && pago ? hj() : null,
      });
    }
    ({ error } = await db.from('despesas').insert(parcelas));
  } else {
    const payload = {
      categoria, subcategoria, valor, data,
      mes_projecao: data.slice(0, 7),
      descricao: descricaoBase,
      e_recorrente: false,
      pago,
      data_pagamento: pago ? hj() : null,
    };
    ({ error } = await db.from('despesas').insert([payload]));
  }
  if (error) { alert('Erro: ' + error.message); return; }
  showSaving();
  fecharOv('ov-despesa');
  const r = await db.from('despesas').select('*').order('data', { ascending: true });
  State.despesas = r.data || [];
  renderFinanceiro();
}

function somarMesData(dataISO, nMeses) {
  const [y, m, d] = dataISO.split('-').map(Number);
  const nova = new Date(y, m - 1 + nMeses, d);
  return nova.getFullYear() + '-' + String(nova.getMonth() + 1).padStart(2, '0') + '-' + String(nova.getDate()).padStart(2, '0');
}

async function excluirDespesa(id) {
  if (!confirm('Excluir esta despesa?')) return;
  await db.from('despesas').delete().eq('id', id);
  showSaving();
  State.despesas = State.despesas.filter((d) => d.id !== id);
  renderFinanceiro();
}
