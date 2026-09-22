let fnReceitaEditId = null;
let fnDespesaEditId = null;

function receitasDoMes(mes) {
  return State.receitas.filter((r) => r.mes_projecao === mes && r.status === 'ativa');
}
function despesasDoMes(mes) {
  return State.despesas.filter((d) => d.mes_projecao === mes);
}

function renderFinanceiro() {
  const mes = mesAtual();
  const receitasMes = receitasDoMes(mes);
  const despesasMes = despesasDoMes(mes);
  const totalReceita = receitasMes.reduce((s, r) => s + Number(r.valor || 0), 0);
  const totalDespesa = despesasMes.reduce((s, d) => s + Number(d.valor || 0), 0);
  const lucro = totalReceita - totalDespesa;
  const margem = totalReceita > 0 ? Math.round(lucro / totalReceita * 100) : 0;

  const el = document.getElementById('page-financeiro');
  el.innerHTML = `
    <div class="section">
      <div class="section-title">Resumo financeiro · ${nomeMesLongo(mes)}</div>
      <div class="card-grid-2" style="margin-bottom:8px;">
        <div class="stat-card"><div class="stat-lbl">Receita</div><div class="stat-val" style="color:var(--green2)">${fmtMoeda(totalReceita)}</div></div>
        <div class="stat-card"><div class="stat-lbl">Despesas</div><div class="stat-val" style="color:var(--red)">${fmtMoeda(totalDespesa)}</div></div>
      </div>
      <div class="stat-card" style="margin-bottom:14px;">
        <div class="stat-lbl">Lucro líquido</div>
        <div class="stat-val" style="font-size:26px;color:${lucro >= 0 ? 'var(--green2)' : 'var(--red)'}">${fmtMoeda(lucro)}</div>
        <div class="stat-sub">margem de ${margem}%</div>
      </div>
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
  renderReceitasLista();
  renderDespesasLista();
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
        <div class="simple-row-title">${fmtMoeda2(r.valor)} ${r.e_recorrente ? '<span class="badge badge-green">recorrente</span>' : '<span class="badge badge-gray">pontual</span>'}</div>
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

// ===================== RECEITA =====================
function abrirModalReceita(id) {
  fnReceitaEditId = id || null;
  document.getElementById('rc-tit').textContent = id ? 'Editar receita' : 'Nova receita';
  const selProd = document.getElementById('rc-produto');
  selProd.innerHTML = '<option value="">Nenhum</option>' + State.produtos.filter(p => p.ativo).map((p) => `<option value="${p.id}">${p.nome}</option>`).join('');
  if (id) {
    const r = State.receitas.find((x) => x.id === id);
    document.getElementById('rc-valor').value = r.valor;
    document.getElementById('rc-data').value = r.data;
    selProd.value = r.produto_id || '';
    document.getElementById('rc-descricao').value = r.descricao || '';
    document.getElementById('rc-recorrente').checked = r.e_recorrente;
  } else {
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
  const eRecorrente = document.getElementById('rc-recorrente').checked;
  const payload = {
    valor,
    data,
    mes_projecao: data.slice(0, 7),
    produto_id: document.getElementById('rc-produto').value || null,
    descricao: document.getElementById('rc-descricao').value.trim(),
    e_recorrente: eRecorrente,
    categoria: eRecorrente ? 'recorrente' : 'pontual',
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
