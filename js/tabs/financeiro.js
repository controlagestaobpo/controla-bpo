let fnReceitaEditId = null;
let fnDespesaEditId = null;
let fnRetiradaEditId = null;
let fnCharts = {};

const CORES_CATEGORIA = ['#1A3A6B', '#00C896', '#D97706', '#7C3AED', '#2563EB', '#DC2626', '#EA580C', '#00A86B', '#8A97A8'];

function renderFinanceiro() {
  const mes = mesAtual();
  const dre = montarDRE(mes);

  const el = document.getElementById('page-financeiro');
  el.innerHTML = `
    <div class="section">
      <div class="section-title">Resumo financeiro · ${nomeMesLongo(mes)}</div>
      <div class="card-grid-2" style="margin-bottom:14px;">
        <div class="stat-card"><div class="stat-lbl">Receita</div><div class="stat-val" style="color:var(--green2)">${fmtMoeda(dre.receitaTotal)}</div></div>
        <div class="stat-card"><div class="stat-lbl">Despesas</div><div class="stat-val" style="color:var(--red)">${fmtMoeda(dre.deducoes + dre.totalDespesasOperacionais)}</div></div>
        <div class="stat-card"><div class="stat-lbl">Lucro líquido</div><div class="stat-val" style="color:${dre.lucroLiquido >= 0 ? 'var(--green2)' : 'var(--red)'}">${fmtMoeda(dre.lucroLiquido)}</div></div>
        <div class="stat-card"><div class="stat-lbl">Margem</div><div class="stat-val">${dre.margem}%</div></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">DRE do mês</div>
      <div class="panel" id="fn-dre"></div>
    </div>

    <div class="section">
      <div class="section-title">Gráficos</div>
      <div class="chart-box panel">
        <div class="panel-title">Saídas por categoria</div>
        <div class="panel-sub">Despesas de ${nomeMesLongo(mes)}</div>
        <div style="position:relative;height:220px;"><canvas id="fn-chart-despesas"></canvas></div>
      </div>
      <div class="chart-box panel">
        <div class="panel-title">Entradas por categoria</div>
        <div class="panel-sub">Receitas de ${nomeMesLongo(mes)}</div>
        <div style="position:relative;height:220px;"><canvas id="fn-chart-receitas"></canvas></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Retiradas de lucro</div>
      <div style="margin-bottom:10px;"><button class="btn btn-sm" onclick="abrirModalRetirada()">+ Nova retirada</button></div>
      <div class="simple-list" id="fn-retiradas-list" style="margin-bottom:6px;"></div>
    </div>

    <div class="section">
      <div class="section-title">Receitas</div>
      <div style="margin-bottom:10px;"><button class="btn btn-primary btn-sm" onclick="abrirModalReceita()">+ Nova receita</button></div>
      <div class="simple-list" id="fn-receitas-list" style="margin-bottom:6px;"></div>
    </div>

    <div class="section">
      <div class="section-title">Despesas</div>
      <div style="margin-bottom:10px;"><button class="btn btn-primary btn-sm" onclick="abrirModalDespesa()">+ Nova despesa</button></div>
      <div class="simple-list" id="fn-despesas-list"></div>
    </div>
  `;
  renderDreTabela(dre);
  renderGraficosFinanceiro(mes, dre);
  renderRetiradasLista();
  renderReceitasLista();
  renderDespesasLista();
}

function renderDreTabela(dre) {
  const el = document.getElementById('fn-dre');
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
    <tr style="border-top:1.5px solid var(--border);"><td><strong>Lucro líquido</strong></td><td style="text-align:right;"><strong style="color:${dre.lucroLiquido >= 0 ? 'var(--green2)' : 'var(--red)'}">${fmtMoeda2(dre.lucroLiquido)}</strong></td></tr>
    <tr><td style="color:var(--text3);font-size:11px;">margem de ${dre.margem}%</td><td></td></tr>
    <tr><td>(−) Retiradas</td><td style="text-align:right;">${fmtMoeda2(dre.retiradasMes)}</td></tr>
    <tr style="border-top:1.5px solid var(--border);"><td><strong>Lucro retido</strong></td><td style="text-align:right;"><strong>${fmtMoeda2(dre.lucroRetido)}</strong></td></tr>
  </table></div>`;
}

function renderGraficosFinanceiro(mes, dre) {
  Object.values(fnCharts).forEach((c) => { try { c.destroy(); } catch (e) {} });
  fnCharts = {};

  const todasDespesas = [...dre.grupos.deducao, ...GRUPO_DRE_ORDEM.flatMap((g) => dre.grupos[g])];
  const canvasDespesas = document.getElementById('fn-chart-despesas');
  if (todasDespesas.length) {
    fnCharts.despesas = new Chart(canvasDespesas, {
      type: 'doughnut',
      data: {
        labels: todasDespesas.map((c) => c.nome),
        datasets: [{ data: todasDespesas.map((c) => c.total), backgroundColor: CORES_CATEGORIA }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 10 } } } },
    });
  } else {
    canvasDespesas.parentElement.innerHTML = '<div class="empty-state">Nenhuma despesa lançada em ' + nomeMesLongo(mes) + '.</div>';
  }

  const todasReceitas = [...dre.receitaOperacionalDetalhe, ...dre.receitaNaoOperacionalDetalhe];
  const canvasReceitas = document.getElementById('fn-chart-receitas');
  if (todasReceitas.length) {
    fnCharts.receitas = new Chart(canvasReceitas, {
      type: 'doughnut',
      data: {
        labels: todasReceitas.map((c) => c.nome),
        datasets: [{ data: todasReceitas.map((c) => c.total), backgroundColor: CORES_CATEGORIA }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 10 } } } },
    });
  } else {
    canvasReceitas.parentElement.innerHTML = '<div class="empty-state">Nenhuma receita lançada em ' + nomeMesLongo(mes) + '.</div>';
  }
}

function renderReceitasLista() {
  const el = document.getElementById('fn-receitas-list');
  if (!el) return;
  const lista = [...State.receitas].sort((a, b) => (b.data || '').localeCompare(a.data || '')).slice(0, 30);
  if (!lista.length) { el.innerHTML = '<div class="empty-state">Nenhuma receita lançada ainda.</div>'; return; }
  el.innerHTML = lista.map((r) => {
    const cliente = State.clientesAtivos.find((c) => c.id === r.cliente_id);
    return `<div class="simple-row">
      <div class="simple-row-main">
        <div class="simple-row-title">${fmtMoeda2(r.valor)} <span class="badge badge-gray">${r.categoria || 'sem categoria'}${r.subcategoria ? ' · ' + r.subcategoria : ''}</span>${r.e_recorrente ? ' <span class="badge badge-green">recorrente</span>' : ''}</div>
        <div class="simple-row-sub">${fmtD(r.data)} · ${cliente ? cliente.empresa : (r.descricao || 'sem descrição')}${r.origem === 'cliente_crm' ? ' · via Comercial' : ''}</div>
      </div>
      <div class="simple-row-acts">
        <button class="btn btn-xs" onclick="abrirModalReceita('${r.id}')">editar</button>
        <button class="btn btn-xs btn-danger" onclick="excluirReceita('${r.id}')">×</button>
      </div>
    </div>`;
  }).join('');
}

function renderDespesasLista() {
  const el = document.getElementById('fn-despesas-list');
  if (!el) return;
  const lista = [...State.despesas].sort((a, b) => (b.data || '').localeCompare(a.data || '')).slice(0, 30);
  if (!lista.length) { el.innerHTML = '<div class="empty-state">Nenhuma despesa lançada ainda.</div>'; return; }
  el.innerHTML = lista.map((d) => `<div class="simple-row">
    <div class="simple-row-main">
      <div class="simple-row-title">${fmtMoeda2(d.valor)} <span class="badge badge-gray">${d.categoria}${d.subcategoria ? ' · ' + d.subcategoria : ''}</span></div>
      <div class="simple-row-sub">${fmtD(d.data)}${d.descricao ? ' · ' + d.descricao : ''}${d.e_recorrente ? ' · recorrente' : ''}</div>
    </div>
    <div class="simple-row-acts">
      <button class="btn btn-xs" onclick="abrirModalDespesa('${d.id}')">editar</button>
      <button class="btn btn-xs btn-danger" onclick="excluirDespesa('${d.id}')">×</button>
    </div>
  </div>`).join('');
}

function renderRetiradasLista() {
  const el = document.getElementById('fn-retiradas-list');
  if (!el) return;
  const lista = [...State.retiradas].sort((a, b) => (b.data || '').localeCompare(a.data || '')).slice(0, 20);
  if (!lista.length) { el.innerHTML = '<div class="empty-state">Nenhuma retirada registrada ainda.</div>'; return; }
  el.innerHTML = lista.map((r) => `<div class="simple-row">
    <div class="simple-row-main">
      <div class="simple-row-title">${fmtMoeda2(r.valor)}</div>
      <div class="simple-row-sub">${fmtD(r.data)}${r.descricao ? ' · ' + r.descricao : ''}</div>
    </div>
    <div class="simple-row-acts">
      <button class="btn btn-xs" onclick="abrirModalRetirada('${r.id}')">editar</button>
      <button class="btn btn-xs btn-danger" onclick="excluirRetirada('${r.id}')">×</button>
    </div>
  </div>`).join('');
}

// ===================== RECEITA =====================
function fnAtualizarSubcategoriasReceita() {
  const catNome = document.getElementById('rc-categoria').value;
  const cat = State.categoriasReceita.find((c) => c.nome_principal === catNome);
  const selSub = document.getElementById('rc-subcategoria');
  const subs = (cat && cat.subcategorias) || [];
  selSub.innerHTML = '<option value="">Nenhuma</option>' + subs.map((s) => `<option>${s}</option>`).join('');
  document.getElementById('row-subcategoria-receita').style.display = subs.length ? 'block' : 'none';
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
    document.getElementById('rc-data').value = hj();
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
  document.getElementById('row-subcategoria').style.display = subs.length ? 'block' : 'none';
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
    document.getElementById('ds-data').value = hj();
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

// ===================== RETIRADAS =====================
function abrirModalRetirada(id) {
  fnRetiradaEditId = id || null;
  document.getElementById('rt-tit').textContent = id ? 'Editar retirada' : 'Nova retirada';
  if (id) {
    const r = State.retiradas.find((x) => x.id === id);
    document.getElementById('rt-valor').value = r.valor;
    document.getElementById('rt-data').value = r.data;
    document.getElementById('rt-descricao').value = r.descricao || '';
  } else {
    document.getElementById('rt-valor').value = '';
    document.getElementById('rt-data').value = hj();
    document.getElementById('rt-descricao').value = '';
  }
  abrirOv('ov-retirada');
}

async function salvarRetirada() {
  const valor = parseFloat(document.getElementById('rt-valor').value);
  if (!valor) { alert('Informe o valor.'); return; }
  const data = document.getElementById('rt-data').value;
  const payload = {
    valor,
    data,
    mes_projecao: data.slice(0, 7),
    descricao: document.getElementById('rt-descricao').value.trim(),
  };
  let error;
  if (fnRetiradaEditId) ({ error } = await db.from('retiradas').update(payload).eq('id', fnRetiradaEditId));
  else ({ error } = await db.from('retiradas').insert([payload]));
  if (error) { alert('Erro: ' + error.message); return; }
  showSaving();
  fecharOv('ov-retirada');
  const r = await db.from('retiradas').select('*').order('data', { ascending: false });
  State.retiradas = r.data || [];
  renderFinanceiro();
}

async function excluirRetirada(id) {
  if (!confirm('Excluir esta retirada?')) return;
  await db.from('retiradas').delete().eq('id', id);
  showSaving();
  State.retiradas = State.retiradas.filter((r) => r.id !== id);
  renderFinanceiro();
}
