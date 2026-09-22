let cfProdutoEditId = null;

function renderConfig() {
  const el = document.getElementById('page-config');
  el.innerHTML = `
    <div class="section">
      <div class="section-title">Perfil da empresa</div>
      <div class="panel">
        <div class="fr"><label>Nome da empresa</label><input type="text" id="cf-nome-empresa" value="${State.perfil.nome_empresa || ''}"></div>
        <button class="btn btn-primary btn-sm" onclick="salvarPerfil()">Salvar perfil</button>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Produtos / Serviços</div>
      <div style="margin-bottom:10px;"><button class="btn btn-primary btn-sm" onclick="abrirModalProduto()">+ Novo produto</button></div>
      <div class="simple-list" id="cf-produtos-list" style="margin-bottom:6px;"></div>
    </div>

    <div class="section">
      <div class="section-title">Categorias de despesa</div>
      <div style="margin-bottom:10px;"><button class="btn btn-sm" onclick="abrirModalCategoria()">+ Adicionar categoria</button></div>
      <div class="simple-list" id="cf-categorias-list" style="margin-bottom:6px;"></div>
    </div>

    <div class="section">
      <div class="section-title">Segmentos (nichos)</div>
      <div style="margin-bottom:10px;"><button class="btn btn-sm" onclick="abrirModalSegmento()">+ Novo segmento</button></div>
      <div class="simple-list" id="cf-segmentos-list" style="margin-bottom:6px;"></div>
    </div>

    <div class="section">
      <div class="section-title">Metas</div>
      <div class="panel">
        <div id="cf-metas-resumo" style="margin-bottom:10px;"></div>
        <button class="btn btn-sm" onclick="abrirModalMetas()">⚙ Editar metas</button>
      </div>
    </div>
  `;
  renderProdutosLista();
  renderCategoriasLista();
  renderSegmentosLista();
  renderMetasResumo();
}

// ===================== PERFIL =====================
async function salvarPerfil() {
  const nome = document.getElementById('cf-nome-empresa').value.trim();
  const payload = { chave: 'perfil', valor: { nome_empresa: nome } };
  let error;
  if (State.perfil.id) ({ error } = await db.from('configuracoes').update({ valor: payload.valor }).eq('id', State.perfil.id));
  else {
    const r = await db.from('configuracoes').insert([payload]).select().single();
    error = r.error;
    if (!error) State.perfil.id = r.data.id;
  }
  if (error) { alert('Erro: ' + error.message); return; }
  State.perfil.nome_empresa = nome;
  showSaving();
}

// ===================== PRODUTOS =====================
function renderProdutosLista() {
  const el = document.getElementById('cf-produtos-list');
  if (!State.produtos.length) { el.innerHTML = '<div class="empty-state">Nenhum produto cadastrado.</div>'; return; }
  el.innerHTML = State.produtos.map((p) => `<div class="simple-row">
    <div class="simple-row-main">
      <div class="simple-row-title">${p.nome} ${p.ativo ? '' : '<span class="badge badge-gray">inativo</span>'}</div>
      <div class="simple-row-sub">${p.valor_padrao ? fmtMoeda(p.valor_padrao) + '/mês' : 'sem valor padrão'}${p.descricao ? ' · ' + p.descricao : ''}</div>
    </div>
    <div class="simple-row-acts">
      <button class="btn btn-xs" onclick="abrirModalProduto('${p.id}')">editar</button>
      <button class="btn btn-xs btn-danger" onclick="excluirProduto('${p.id}')">×</button>
    </div>
  </div>`).join('');
}

function abrirModalProduto(id) {
  cfProdutoEditId = id || null;
  document.getElementById('pd-tit').textContent = id ? 'Editar produto' : 'Novo produto';
  if (id) {
    const p = State.produtos.find((x) => x.id === id);
    document.getElementById('pd-nome').value = p.nome;
    document.getElementById('pd-descricao').value = p.descricao || '';
    document.getElementById('pd-valor').value = p.valor_padrao || '';
    document.getElementById('pd-ativo').checked = p.ativo;
  } else {
    document.getElementById('pd-nome').value = '';
    document.getElementById('pd-descricao').value = '';
    document.getElementById('pd-valor').value = '';
    document.getElementById('pd-ativo').checked = true;
  }
  abrirOv('ov-produto');
}

async function salvarProduto() {
  const nome = document.getElementById('pd-nome').value.trim();
  if (!nome) { alert('Informe o nome.'); return; }
  const payload = {
    nome,
    descricao: document.getElementById('pd-descricao').value.trim(),
    valor_padrao: parseFloat(document.getElementById('pd-valor').value) || null,
    ativo: document.getElementById('pd-ativo').checked,
  };
  let error;
  if (cfProdutoEditId) ({ error } = await db.from('produtos').update(payload).eq('id', cfProdutoEditId));
  else ({ error } = await db.from('produtos').insert([payload]));
  if (error) { alert('Erro: ' + error.message); return; }
  showSaving();
  fecharOv('ov-produto');
  const r = await db.from('produtos').select('*').order('nome');
  State.produtos = r.data || [];
  renderConfig();
}

async function excluirProduto(id) {
  if (!confirm('Excluir este produto?')) return;
  await db.from('produtos').delete().eq('id', id);
  showSaving();
  State.produtos = State.produtos.filter((p) => p.id !== id);
  renderConfig();
}

// ===================== CATEGORIAS DE DESPESA =====================
function renderCategoriasLista() {
  const el = document.getElementById('cf-categorias-list');
  if (!State.categoriasDespesa.length) { el.innerHTML = '<div class="empty-state">Nenhuma categoria.</div>'; return; }
  el.innerHTML = State.categoriasDespesa.map((c) => `<div class="simple-row">
    <div class="simple-row-main">
      <div class="simple-row-title">${c.nome_principal}</div>
      ${c.subcategorias && c.subcategorias.length ? `<div class="simple-row-sub">${c.subcategorias.join(' · ')}</div>` : ''}
    </div>
    <button class="btn btn-xs btn-danger" onclick="excluirCategoria('${c.id}')">×</button>
  </div>`).join('');
}

function abrirModalCategoria() {
  document.getElementById('ct-nome').value = '';
  document.getElementById('ct-subs').value = '';
  abrirOv('ov-categoria');
}

async function salvarCategoria() {
  const nome = document.getElementById('ct-nome').value.trim();
  if (!nome) { alert('Informe o nome da categoria.'); return; }
  const subs = document.getElementById('ct-subs').value.split(',').map((s) => s.trim()).filter(Boolean);
  const { error } = await db.from('categorias_despesa').insert([{ nome_principal: nome, subcategorias: subs }]);
  if (error) { alert('Erro: ' + error.message); return; }
  showSaving();
  fecharOv('ov-categoria');
  const r = await db.from('categorias_despesa').select('*').order('nome_principal');
  State.categoriasDespesa = r.data || [];
  renderConfig();
}

async function excluirCategoria(id) {
  if (!confirm('Excluir esta categoria?')) return;
  await db.from('categorias_despesa').delete().eq('id', id);
  showSaving();
  State.categoriasDespesa = State.categoriasDespesa.filter((c) => c.id !== id);
  renderConfig();
}

// ===================== SEGMENTOS =====================
function renderSegmentosLista() {
  const el = document.getElementById('cf-segmentos-list');
  if (!State.segmentos.length) { el.innerHTML = '<div class="empty-state">Nenhum segmento.</div>'; return; }
  el.innerHTML = State.segmentos.map((s) => `<div class="simple-row">
    <div class="simple-row-main"><div class="simple-row-title">${s.nome}</div></div>
    <button class="btn btn-xs btn-danger" onclick="excluirSegmento('${s.id}')">×</button>
  </div>`).join('');
}

function abrirModalSegmento() {
  document.getElementById('sg-nome').value = '';
  abrirOv('ov-segmento');
}

async function salvarSegmento() {
  const nome = document.getElementById('sg-nome').value.trim();
  if (!nome) { alert('Informe o nome do segmento.'); return; }
  const { error } = await db.from('segmentos').insert([{ nome }]);
  if (error) { alert('Erro: ' + error.message); return; }
  showSaving();
  fecharOv('ov-segmento');
  const r = await db.from('segmentos').select('*').order('nome');
  State.segmentos = r.data || [];
  renderConfig();
}

async function excluirSegmento(id) {
  if (!confirm('Excluir este segmento?')) return;
  await db.from('segmentos').delete().eq('id', id);
  showSaving();
  State.segmentos = State.segmentos.filter((s) => s.id !== id);
  renderConfig();
}

// ===================== METAS (supermeta + meta do mês) =====================
function renderMetasResumo() {
  const el = document.getElementById('cf-metas-resumo');
  const m = State.metas;
  el.innerHTML = `
    <div class="simple-row-sub">Supermeta: <strong>${m.sm_clientes} clientes</strong> · ${fmtMoeda(m.sm_fat)}/mês${m.sm_prazo ? ' · prazo ' + fmtD(m.sm_prazo) : ''}</div>
    <div class="simple-row-sub">Meta do mês: <strong>${m.mm_clientes} clientes novos</strong> · ${fmtMoeda(m.mm_fat)} adicional</div>
  `;
}

function abrirModalMetas() {
  const m = State.metas;
  document.getElementById('mt-sm-cl').value = m.sm_clientes;
  document.getElementById('mt-sm-fat').value = m.sm_fat;
  document.getElementById('mt-sm-prazo').value = m.sm_prazo || '';
  document.getElementById('mt-mm-cl').value = m.mm_clientes;
  document.getElementById('mt-mm-fat').value = m.mm_fat;
  abrirOv('ov-metas');
}

async function salvarMetas() {
  const payload = {
    sm_clientes: parseInt(document.getElementById('mt-sm-cl').value) || 20,
    sm_fat: parseInt(document.getElementById('mt-sm-fat').value) || 20000,
    sm_prazo: document.getElementById('mt-sm-prazo').value || null,
    mm_clientes: parseInt(document.getElementById('mt-mm-cl').value) || 5,
    mm_fat: parseInt(document.getElementById('mt-mm-fat').value) || 5000,
  };
  if (State.metas.id) {
    await db.from('metas').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', State.metas.id);
  } else {
    const r = await db.from('metas').insert([payload]).select().single();
    if (r.data) payload.id = r.data.id;
  }
  State.metas = { ...State.metas, ...payload };
  showSaving();
  fecharOv('ov-metas');
  renderMetasResumo();
}
