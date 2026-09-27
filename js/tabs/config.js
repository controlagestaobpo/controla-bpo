let cfProdutoEditId = null;
let cfCategoriaEditId = null;
let cfCategoriaReceitaEditId = null;
let cfSegmentoEditId = null;

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
      <div class="section-title">Relatórios</div>
      <div class="panel">
        <div class="panel-sub" style="margin-top:-4px;">Gera um PDF (via impressão do navegador) ou exporta os dados brutos.</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button class="btn" onclick="gerarRelatorioComercial()">📄 Relatório Comercial</button>
          <button class="btn" onclick="gerarRelatorioFinanceiro()">📄 Relatório Financeiro</button>
          <button class="btn" onclick="gerarRelatorioIntegrado()">📄 Relatório Integrado (Visão 360°)</button>
          <button class="btn" onclick="rlExportarJSON()">⬇ Exportar dados brutos (JSON)</button>
          <button class="btn" onclick="rlCopiarResumoIA()">📋 Copiar resumo para IA</button>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Produtos / Serviços</div>
      <div style="margin-bottom:10px;"><button class="btn btn-primary btn-sm" onclick="abrirModalProduto()">+ Novo produto</button></div>
      <div class="simple-list" id="cf-produtos-list" style="margin-bottom:6px;"></div>
    </div>

    <div class="section">
      <div class="section-title">Categorias de receita</div>
      <div style="margin-bottom:10px;"><button class="btn btn-sm" onclick="abrirModalCategoriaReceita()">+ Adicionar categoria</button></div>
      <div class="simple-list" id="cf-categorias-receita-list" style="margin-bottom:6px;"></div>
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

    <div class="section">
      <div class="section-title">Equipe</div>
      <div class="panel">
        <div class="panel-sub" style="margin-top:-4px;">Quem acessa os dados desta empresa. Para adicionar alguém, crie o login pelo Supabase (Authentication → Add user) e depois peça pra eu vincular o e-mail aqui.</div>
        <div class="simple-list" id="cf-equipe-list" style="margin-top:8px;"></div>
      </div>
    </div>
  `;
  renderProdutosLista();
  renderCategoriasReceitaLista();
  renderCategoriasLista();
  renderSegmentosLista();
  renderMetasResumo();
  renderEquipeLista();
}

// ===================== EQUIPE =====================
function renderEquipeLista() {
  const el = document.getElementById('cf-equipe-list');
  if (!el) return;
  if (!State.membrosEmpresa.length) { el.innerHTML = '<div class="empty-state">Nenhum membro cadastrado.</div>'; return; }
  el.innerHTML = State.membrosEmpresa.map((m) => `<div class="simple-row">
    <div class="simple-row-main">
      <div class="simple-row-title">${m.email} ${m.papel === 'dono' ? '<span class="badge badge-gray">dono</span>' : '<span class="badge badge-gray">membro</span>'}</div>
    </div>
  </div>`).join('');
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
  const grupos = ['deducao', ...GRUPO_DRE_ORDEM];
  el.innerHTML = grupos.map((g) => {
    const cats = State.categoriasDespesa.filter((c) => (c.grupo_dre || 'administrativas') === g);
    if (!cats.length) return '';
    return `<div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;font-weight:700;margin:10px 0 4px;">${GRUPO_DRE_LABELS[g]}</div>` +
      cats.map((c) => `<div class="simple-row">
        <div class="simple-row-main">
          <div class="simple-row-title">${c.nome_principal}</div>
          ${c.subcategorias && c.subcategorias.length ? `<div class="simple-row-sub">${c.subcategorias.join(' · ')}</div>` : ''}
        </div>
        <div class="simple-row-acts">
          <button class="btn btn-xs" onclick="abrirModalCategoria('${c.id}')">editar</button>
          <button class="btn btn-xs btn-danger" onclick="excluirCategoria('${c.id}')">×</button>
        </div>
      </div>`).join('');
  }).join('');
}

function abrirModalCategoria(id) {
  cfCategoriaEditId = id || null;
  document.getElementById('ct-tit').textContent = id ? 'Editar categoria de despesa' : 'Nova categoria de despesa';
  if (id) {
    const c = State.categoriasDespesa.find((x) => x.id === id);
    document.getElementById('ct-nome').value = c.nome_principal;
    document.getElementById('ct-subs').value = (c.subcategorias || []).join(', ');
    document.getElementById('ct-grupo').value = c.grupo_dre || 'administrativas';
  } else {
    document.getElementById('ct-nome').value = '';
    document.getElementById('ct-subs').value = '';
    document.getElementById('ct-grupo').value = 'administrativas';
  }
  abrirOv('ov-categoria');
}

async function salvarCategoria() {
  const nome = document.getElementById('ct-nome').value.trim();
  if (!nome) { alert('Informe o nome da categoria.'); return; }
  const subs = document.getElementById('ct-subs').value.split(',').map((s) => s.trim()).filter(Boolean);
  const grupo_dre = document.getElementById('ct-grupo').value;
  let error;
  if (cfCategoriaEditId) ({ error } = await db.from('categorias_despesa').update({ nome_principal: nome, subcategorias: subs, grupo_dre }).eq('id', cfCategoriaEditId));
  else ({ error } = await db.from('categorias_despesa').insert([{ nome_principal: nome, subcategorias: subs, grupo_dre }]));
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

// ===================== CATEGORIAS DE RECEITA =====================
function renderCategoriasReceitaLista() {
  const el = document.getElementById('cf-categorias-receita-list');
  if (!State.categoriasReceita.length) { el.innerHTML = '<div class="empty-state">Nenhuma categoria.</div>'; return; }
  const grupos = ['operacional', 'nao_operacional'];
  el.innerHTML = grupos.map((g) => {
    const cats = State.categoriasReceita.filter((c) => (c.grupo_dre || 'operacional') === g);
    if (!cats.length) return '';
    return `<div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;font-weight:700;margin:10px 0 4px;">${GRUPO_RECEITA_LABELS[g]}</div>` +
      cats.map((c) => `<div class="simple-row">
        <div class="simple-row-main">
          <div class="simple-row-title">${c.nome_principal}</div>
          ${c.subcategorias && c.subcategorias.length ? `<div class="simple-row-sub">${c.subcategorias.join(' · ')}</div>` : ''}
        </div>
        <div class="simple-row-acts">
          <button class="btn btn-xs" onclick="abrirModalCategoriaReceita('${c.id}')">editar</button>
          <button class="btn btn-xs btn-danger" onclick="excluirCategoriaReceita('${c.id}')">×</button>
        </div>
      </div>`).join('');
  }).join('');
}

function abrirModalCategoriaReceita(id) {
  cfCategoriaReceitaEditId = id || null;
  document.getElementById('cr-tit').textContent = id ? 'Editar categoria de receita' : 'Nova categoria de receita';
  if (id) {
    const c = State.categoriasReceita.find((x) => x.id === id);
    document.getElementById('cr-nome').value = c.nome_principal;
    document.getElementById('cr-subs').value = (c.subcategorias || []).join(', ');
    document.getElementById('cr-grupo').value = c.grupo_dre || 'operacional';
  } else {
    document.getElementById('cr-nome').value = '';
    document.getElementById('cr-subs').value = '';
    document.getElementById('cr-grupo').value = 'operacional';
  }
  abrirOv('ov-categoria-receita');
}

async function salvarCategoriaReceita() {
  const nome = document.getElementById('cr-nome').value.trim();
  if (!nome) { alert('Informe o nome da categoria.'); return; }
  const subs = document.getElementById('cr-subs').value.split(',').map((s) => s.trim()).filter(Boolean);
  const grupo_dre = document.getElementById('cr-grupo').value;
  let error;
  if (cfCategoriaReceitaEditId) ({ error } = await db.from('categorias_receita').update({ nome_principal: nome, subcategorias: subs, grupo_dre }).eq('id', cfCategoriaReceitaEditId));
  else ({ error } = await db.from('categorias_receita').insert([{ nome_principal: nome, subcategorias: subs, grupo_dre }]));
  if (error) { alert('Erro: ' + error.message); return; }
  showSaving();
  fecharOv('ov-categoria-receita');
  const r = await db.from('categorias_receita').select('*').order('nome_principal');
  State.categoriasReceita = r.data || [];
  renderConfig();
}

async function excluirCategoriaReceita(id) {
  if (!confirm('Excluir esta categoria?')) return;
  await db.from('categorias_receita').delete().eq('id', id);
  showSaving();
  State.categoriasReceita = State.categoriasReceita.filter((c) => c.id !== id);
  renderConfig();
}

// ===================== SEGMENTOS =====================
function renderSegmentosLista() {
  const el = document.getElementById('cf-segmentos-list');
  if (!State.segmentos.length) { el.innerHTML = '<div class="empty-state">Nenhum segmento.</div>'; return; }
  el.innerHTML = State.segmentos.map((s) => `<div class="simple-row">
    <div class="simple-row-main"><div class="simple-row-title">${s.nome}</div></div>
    <div class="simple-row-acts">
      <button class="btn btn-xs" onclick="abrirModalSegmento('${s.id}')">editar</button>
      <button class="btn btn-xs btn-danger" onclick="excluirSegmento('${s.id}')">×</button>
    </div>
  </div>`).join('');
}

function abrirModalSegmento(id) {
  cfSegmentoEditId = id || null;
  document.getElementById('sg-tit').textContent = id ? 'Editar segmento' : 'Novo segmento';
  document.getElementById('sg-nome').value = id ? State.segmentos.find((x) => x.id === id).nome : '';
  abrirOv('ov-segmento');
}

async function salvarSegmento() {
  const nome = document.getElementById('sg-nome').value.trim();
  if (!nome) { alert('Informe o nome do segmento.'); return; }
  let error;
  if (cfSegmentoEditId) ({ error } = await db.from('segmentos').update({ nome }).eq('id', cfSegmentoEditId));
  else ({ error } = await db.from('segmentos').insert([{ nome }]));
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
