// ===== estado local de filtros do funil de prospects =====
let cmFiltroStatus = 'todos';
let cmFiltroPeriodo = 'todos';
let cmDataEspecifica = '';
let cmEditId = null; // prospect sendo editado
let cmClienteEditId = null; // cliente ativo sendo editado
let cmEncerrarId = null; // cliente ativo a encerrar

const STATUS_COR = { visita: '#2563EB', conversa: '#D97706', proposta: '#7C3AED', fechado: '#059669', descartado: '#DC2626' };
const STATUS_LBL = { visita: 'Visita', conversa: 'Conversa', proposta: 'Proposta enviada', fechado: 'Fechado', descartado: 'Descartado' };
const STATUS_CLS = { visita: 'badge-blue', conversa: 'badge-amber', proposta: 'badge-purple', fechado: 'badge-green', descartado: 'badge-red' };

function prospectsPipeline() {
  return State.prospects.filter((p) => p.status !== 'fechado' && p.status !== 'descartado');
}

function renderComercial() {
  const clientesAtivos = State.clientesAtivos.filter((c) => c.status === 'ativo');
  const pipeline = prospectsPipeline();
  const totalContatos = pipeline.length + clientesAtivos.length + State.clientesAtivos.filter(c => c.status === 'encerrado').length;
  const taxaConversao = totalContatos > 0 ? Math.round((clientesAtivos.length + State.clientesAtivos.filter(c => c.status === 'encerrado').length) / totalContatos * 100) : 0;
  const valorFunil = pipeline.reduce((s, p) => s + (p.ticket || 0), 0);
  const ticketMedio = clientesAtivos.length > 0 ? Math.round(clientesAtivos.reduce((s, c) => s + (c.ticket_mensal || 0), 0) / clientesAtivos.length) : 0;

  const indicacoes = State.clientesAtivos.filter((c) => c.origem === 'indicacao');
  const taxaIndicacoes = State.clientesAtivos.length > 0 ? Math.round(indicacoes.length / State.clientesAtivos.length * 100) : 0;

  const el = document.getElementById('page-comercial');
  el.innerHTML = `
    <div class="section">
      <div class="section-title">Resumo rápido</div>
      <div class="card-grid-2" style="margin-bottom:14px;">
        <div class="stat-card"><div class="stat-lbl">Clientes</div><div class="stat-val" style="color:var(--green2)">${clientesAtivos.length}</div><div class="stat-sub">ativos</div></div>
        <div class="stat-card"><div class="stat-lbl">Prospects</div><div class="stat-val" style="color:var(--blue)">${pipeline.length}</div><div class="stat-sub">em funil</div></div>
        <div class="stat-card"><div class="stat-lbl">Conversão</div><div class="stat-val">${taxaConversao}%</div><div class="stat-sub">taxa geral</div></div>
        <div class="stat-card"><div class="stat-lbl">Ticket médio</div><div class="stat-val">${fmtMoeda(ticketMedio)}</div><div class="stat-sub">por cliente/mês</div></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Clientes ativos</div>
      <div class="panel-sub" style="margin-top:-4px;">Todo cliente nasce de um prospect fechado — não existe cadastro avulso.</div>
      <div class="simple-list" id="cm-clientes-list" style="margin-bottom:6px;"></div>
    </div>

    <div class="section">
      <div class="section-title">Prospects</div>
      <div style="margin-bottom:10px;"><button class="btn btn-primary btn-sm" onclick="abrirModalProspect()">+ Novo prospect</button></div>
    </div>
    <div class="filter-section">
      <div class="flbl"><span>Status</span></div>
      <div class="frow" id="cm-fs"></div>
      <div class="flbl"><span>Período</span><span class="clr-btn" onclick="cmLimparData()">limpar</span></div>
      <div class="frow" id="cm-fd"></div>
    </div>
    <input type="text" id="cm-busca" class="search-inp" placeholder="Buscar empresa..." oninput="renderProspectsLista()">
    <div class="list" id="cm-prospects-list"></div>

    <div class="section">
      <div class="section-title">Motivos de cancelamento</div>
      <div class="simple-list" id="cm-cancelados-list"></div>
    </div>

    <div class="section">
      <div class="section-title">Indicações</div>
      <div class="card-grid-2">
        <div class="stat-card"><div class="stat-lbl">Total indicações</div><div class="stat-val">${indicacoes.length}</div></div>
        <div class="stat-card"><div class="stat-lbl">Taxa de indicações</div><div class="stat-val">${taxaIndicacoes}%</div><div class="stat-sub">dos clientes</div></div>
      </div>
    </div>
  `;

  renderClientesAtivosLista();
  renderCanceladosLista();
  renderFiltrosProspect();
  renderProspectsLista();
}

// ===================== CLIENTES ATIVOS =====================
function renderClientesAtivosLista() {
  const el = document.getElementById('cm-clientes-list');
  if (!el) return;
  const lista = State.clientesAtivos.filter((c) => c.status === 'ativo');
  if (!lista.length) { el.innerHTML = '<div class="empty-state">Nenhum cliente ativo ainda.<br>Marque um prospect como "Fechado" pra criar o primeiro.</div>'; return; }
  el.innerHTML = lista.map((c) => {
    const produto = State.produtos.find((p) => p.id === c.produto_id);
    return `<div class="simple-row">
      <div class="simple-row-main">
        <div class="simple-row-title">${c.empresa}</div>
        <div class="simple-row-sub">${fmtD(c.data_fechamento)} · ${c.contato || 'sem contato'} · ${fmtMoeda(c.ticket_mensal)}/mês${produto ? ' · ' + produto.nome : ''}</div>
      </div>
      <div class="simple-row-acts">
        <span class="badge badge-green">ativo</span>
        <button class="btn btn-xs" onclick="abrirModalCliente('${c.id}')">editar</button>
        <button class="btn btn-xs btn-danger" onclick="abrirModalEncerrar('${c.id}')">encerrar</button>
      </div>
    </div>`;
  }).join('');
}

function abrirModalCliente(id) {
  cmClienteEditId = id;
  document.getElementById('cl-tit').textContent = 'Editar cliente';
  const selProd = document.getElementById('cl-produto');
  selProd.innerHTML = '<option value="">Nenhum</option>' + State.produtos.filter(p => p.ativo).map((p) => `<option value="${p.id}">${p.nome}</option>`).join('');
  const c = State.clientesAtivos.find((x) => x.id === id);
  document.getElementById('cl-empresa').value = c.empresa;
  document.getElementById('cl-data').value = c.data_fechamento;
  document.getElementById('cl-contato').value = c.contato || '';
  document.getElementById('cl-whatsapp').value = c.whatsapp || '';
  document.getElementById('cl-ticket').value = c.ticket_mensal;
  document.getElementById('cl-frequencia').value = c.frequencia;
  selProd.value = c.produto_id || '';
  document.getElementById('cl-origem').value = c.origem || '';
  document.getElementById('cl-indicou').value = c.quem_indicou || '';
  document.getElementById('cl-obs').value = c.obs || '';
  cmToggleIndicou();
  abrirOv('ov-cliente');
}

function cmToggleIndicou() {
  const show = document.getElementById('cl-origem').value === 'indicacao';
  document.getElementById('row-indicou').style.display = show ? 'block' : 'none';
}

async function salvarCliente() {
  const empresa = document.getElementById('cl-empresa').value.trim();
  if (!empresa) { alert('Informe o nome da empresa.'); return; }
  const payload = {
    empresa,
    data_fechamento: document.getElementById('cl-data').value,
    contato: document.getElementById('cl-contato').value.trim(),
    whatsapp: document.getElementById('cl-whatsapp').value.trim(),
    ticket_mensal: parseFloat(document.getElementById('cl-ticket').value) || 0,
    frequencia: document.getElementById('cl-frequencia').value,
    produto_id: document.getElementById('cl-produto').value || null,
    origem: document.getElementById('cl-origem').value || null,
    quem_indicou: document.getElementById('cl-origem').value === 'indicacao' ? document.getElementById('cl-indicou').value.trim() : null,
    obs: document.getElementById('cl-obs').value.trim(),
  };
  let error;
  if (cmClienteEditId) ({ error } = await db.from('clientes_ativos').update(payload).eq('id', cmClienteEditId));
  else ({ error } = await db.from('clientes_ativos').insert([payload]));
  if (error) { alert('Erro: ' + error.message); return; }
  showSaving();
  fecharOv('ov-cliente');
  const r = await db.from('clientes_ativos').select('*').order('data_fechamento', { ascending: false });
  State.clientesAtivos = r.data || [];
  renderComercial();
}

function abrirModalEncerrar(id) {
  cmEncerrarId = id;
  document.getElementById('enc-data').value = hj();
  document.getElementById('enc-motivo').innerHTML = '<option value="">Selecione</option>' + MOTIVOS_CANCELAMENTO.map((m) => `<option>${m}</option>`).join('');
  document.getElementById('enc-quem').value = 'cliente';
  document.getElementById('enc-obs').value = '';
  abrirOv('ov-encerrar');
}

async function salvarEncerramento() {
  const motivo = document.getElementById('enc-motivo').value;
  if (!motivo) { alert('Selecione o motivo.'); return; }
  const payload = {
    status: 'encerrado',
    data_encerramento: document.getElementById('enc-data').value,
    motivo_cancelamento: motivo,
    quem_cancelou: document.getElementById('enc-quem').value,
    obs: document.getElementById('enc-obs').value.trim(),
  };
  const { error } = await db.from('clientes_ativos').update(payload).eq('id', cmEncerrarId);
  if (error) { alert('Erro: ' + error.message); return; }
  showSaving();
  fecharOv('ov-encerrar');
  const r = await db.from('clientes_ativos').select('*').order('data_fechamento', { ascending: false });
  State.clientesAtivos = r.data || [];
  renderComercial();
}

function renderCanceladosLista() {
  const el = document.getElementById('cm-cancelados-list');
  if (!el) return;
  const lista = State.clientesAtivos.filter((c) => c.status === 'encerrado');
  if (!lista.length) { el.innerHTML = '<div class="empty-state">Nenhum cancelamento registrado.</div>'; return; }
  el.innerHTML = lista.map((c) => `<div class="simple-row">
    <div class="simple-row-main">
      <div class="simple-row-title">${c.empresa}</div>
      <div class="simple-row-sub">${fmtD(c.data_encerramento)} · ${c.motivo_cancelamento || '-'} · cancelado por ${c.quem_cancelou === 'empresa' ? 'nós' : 'cliente'}</div>
    </div>
    <span class="badge badge-red">encerrado</span>
  </div>`).join('');
}

// ===================== PROSPECTS =====================
function renderFiltrosProspect() {
  const fs = document.getElementById('cm-fs');
  const statusOpts = [['todos', 'Todos'], ['visita', 'Visita'], ['conversa', 'Conversa'], ['proposta', 'Proposta'], ['fechado', 'Fechado'], ['descartado', 'Descartado']];
  fs.innerHTML = statusOpts.map(([v, l]) => `<span class="pill ${cmFiltroStatus === v ? 'on' : ''}" onclick="cmSetStatus('${v}')">${l}</span>`).join('');

  const fd = document.getElementById('cm-fd');
  const perOpts = [['todos', 'Todos'], ['hoje', 'Hoje'], ['ontem', 'Ontem'], ['semana', 'Esta semana'], ['mes', 'Este mês']];
  fd.innerHTML = perOpts.map(([v, l]) => `<span class="pill ${cmFiltroPeriodo === v ? 'on' : ''}" onclick="cmSetPeriodo('${v}')">${l}</span>`).join('')
    + `<input type="date" id="cm-dp" class="pill" style="padding:3px 10px;" value="${cmDataEspecifica}" onchange="cmSetDataEspecifica(this.value)">`;
}

function cmSetStatus(s) { cmFiltroStatus = s; renderFiltrosProspect(); renderProspectsLista(); }
function cmSetPeriodo(p) { cmFiltroPeriodo = p; cmDataEspecifica = ''; renderFiltrosProspect(); renderProspectsLista(); }
function cmSetDataEspecifica(v) { cmDataEspecifica = v; cmFiltroPeriodo = v ? 'esp' : 'todos'; renderFiltrosProspect(); renderProspectsLista(); }
function cmLimparData() { cmDataEspecifica = ''; cmFiltroPeriodo = 'todos'; renderFiltrosProspect(); renderProspectsLista(); }

function cmAplicarFiltros(lista) {
  let l = [...lista];
  if (cmFiltroStatus !== 'todos') l = l.filter((p) => p.status === cmFiltroStatus);
  if (cmFiltroPeriodo === 'esp' && cmDataEspecifica) l = l.filter((p) => p.data_visita === cmDataEspecifica);
  else if (cmFiltroPeriodo === 'hoje') l = l.filter((p) => p.data_visita === hj());
  else if (cmFiltroPeriodo === 'ontem') l = l.filter((p) => p.data_visita === ont());
  else if (cmFiltroPeriodo === 'semana') l = l.filter((p) => p.data_visita >= iSem());
  else if (cmFiltroPeriodo === 'mes') l = l.filter((p) => p.data_visita >= iMes());
  const busca = document.getElementById('cm-busca');
  if (busca && busca.value.trim()) {
    const q = busca.value.trim().toLowerCase();
    l = l.filter((p) => (p.empresa || '').toLowerCase().includes(q) || (p.contato || '').toLowerCase().includes(q) || (p.nicho || '').toLowerCase().includes(q));
  }
  return l;
}

function renderProspectsLista() {
  const el = document.getElementById('cm-prospects-list');
  if (!el) return;
  let l = cmAplicarFiltros(State.prospects);
  l.sort((a, b) => (b.data_visita || '').localeCompare(a.data_visita || ''));
  if (!l.length) { el.innerHTML = '<div class="empty-state">Nenhum prospect aqui.<br>Toque em + Novo prospect para registrar.</div>'; return; }

  const grupos = {};
  l.forEach((p) => { const d = p.data_visita || 'sem-data'; if (!grupos[d]) grupos[d] = []; grupos[d].push(p); });
  const datas = Object.keys(grupos).sort((a, b) => b.localeCompare(a));

  el.innerHTML = datas.map((d) => {
    const header = `<div class="day-hdr"><div class="day-tit">${d === 'sem-data' ? 'Sem data' : fmtD(d)}</div><div class="day-cnt">${grupos[d].length}</div></div>`;
    const cards = grupos[d].map((p) => {
      const h = hj();
      let deadlineBadge = '';
      if (p.deadline) {
        if (p.deadline < h && p.status !== 'fechado' && p.status !== 'descartado') deadlineBadge = `<span class="badge badge-red">vencido ${fmtD(p.deadline)}</span>`;
        else if (p.deadline === h) deadlineBadge = `<span class="badge badge-red">deadline hoje</span>`;
        else deadlineBadge = `<span class="badge badge-green">prazo ${fmtD(p.deadline)}</span>`;
      }
      const fechou = p.status === 'fechado';
      return `<div class="item-card"><div class="ic-inner">
        <div class="ic-accent" style="background:${STATUS_COR[p.status] || '#9CA3AF'};width:${fechou ? '6px' : '4px'};"></div>
        <div class="ic-body">
          <div class="ic-top">
            <div class="ic-nome">${fechou ? '<span style="color:var(--green2);">✓</span> ' : ''}${p.empresa}</div>
            <div class="ic-acts">
              <button class="btn btn-xs" onclick="abrirModalProspect('${p.id}')">editar</button>
              <button class="btn btn-xs btn-danger" onclick="excluirProspect('${p.id}')">×</button>
            </div>
          </div>
          <div class="ic-badges">
            <span class="badge ${STATUS_CLS[p.status] || 'badge-blue'}" style="${fechou ? 'font-weight:800;' : ''}">${fechou ? '✓ Fechou' : STATUS_LBL[p.status] || p.status}</span>
            ${p.nicho ? `<span class="badge badge-gray">${p.nicho}</span>` : ''}
            ${deadlineBadge}
            ${p.motivo_perda ? `<span class="badge badge-red">${p.motivo_perda}</span>` : ''}
          </div>
          ${(p.contato || p.whatsapp) ? `<div class="ic-ct">${[p.contato, p.whatsapp].filter(Boolean).join(' · ')}</div>` : ''}
          ${p.obs ? `<div class="ic-obs">${p.obs}</div>` : ''}
          ${p.proximo ? `<div class="ic-next">&rarr; ${p.proximo}</div>` : ''}
        </div>
      </div></div>`;
    }).join('');
    return `<div class="day-group">${header}${cards}</div>`;
  }).join('');
}

function abrirModalProspect(id) {
  cmEditId = id || null;
  document.getElementById('pr-tit').textContent = id ? 'Editar prospect' : 'Novo prospect';
  document.getElementById('pr-perda-req').classList.remove('show');
  const selNicho = document.getElementById('pr-nicho');
  selNicho.innerHTML = '<option value="">Selecione</option>' + State.segmentos.map((s) => `<option>${s.nome}</option>`).join('') + '<option>Outro</option>';
  document.getElementById('pr-motivo').innerHTML = '<option value="">Selecione o motivo</option>' + MOTIVOS_PERDA.map((m) => `<option>${m}</option>`).join('');
  const selProd = document.getElementById('pr-fc-produto');
  selProd.innerHTML = '<option value="">Nenhum</option>' + State.produtos.filter((p) => p.ativo).map((p) => `<option value="${p.id}">${p.nome}</option>`).join('');
  if (id) {
    const p = State.prospects.find((x) => x.id === id);
    document.getElementById('pr-empresa').value = p.empresa;
    document.getElementById('pr-data').value = p.data_visita;
    selNicho.value = p.nicho || '';
    document.getElementById('pr-status').value = p.status;
    document.getElementById('pr-contato').value = p.contato || '';
    document.getElementById('pr-whatsapp').value = p.whatsapp || '';
    document.getElementById('pr-ticket').value = p.ticket || 1000;
    document.getElementById('pr-obs').value = p.obs || '';
    document.getElementById('pr-proximo').value = p.proximo || '';
    document.getElementById('pr-deadline').value = p.deadline || '';
    document.getElementById('pr-motivo').value = p.motivo_perda || '';
    document.getElementById('pr-fc-ticket').value = p.ticket || '';
    document.getElementById('pr-fc-frequencia').value = 'mensal';
    document.getElementById('pr-fc-origem').value = 'prospeccao';
    document.getElementById('pr-fc-indicou').value = '';
  } else {
    ['pr-empresa', 'pr-contato', 'pr-whatsapp', 'pr-obs', 'pr-proximo', 'pr-deadline', 'pr-motivo', 'pr-fc-indicou'].forEach((i) => document.getElementById(i).value = '');
    document.getElementById('pr-data').value = hj();
    selNicho.value = '';
    document.getElementById('pr-status').value = 'visita';
    document.getElementById('pr-ticket').value = '1000';
    document.getElementById('pr-fc-ticket').value = '1000';
    document.getElementById('pr-fc-frequencia').value = 'mensal';
    document.getElementById('pr-fc-origem').value = 'prospeccao';
  }
  cmToggleIndicouProspect();
  cmStatusChange();
  abrirOv('ov-prospect');
}

function cmStatusChange() {
  const st = document.getElementById('pr-status').value;
  document.getElementById('row-perda').style.display = st === 'descartado' ? 'block' : 'none';
  document.getElementById('pr-perda-req').classList.remove('show');

  const jaTemCliente = cmEditId && State.clientesAtivos.some((c) => c.prospect_id === cmEditId);
  document.getElementById('row-fechado').style.display = st === 'fechado' ? 'block' : 'none';
  document.querySelectorAll('#row-fechado .fg, #row-fechado > .fr').forEach((el) => { el.style.display = jaTemCliente ? 'none' : ''; });
  document.getElementById('pr-fc-ja-cliente').style.display = (st === 'fechado' && jaTemCliente) ? 'block' : 'none';
}

function cmToggleIndicouProspect() {
  document.getElementById('row-fc-indicou').style.display = document.getElementById('pr-fc-origem').value === 'indicacao' ? 'block' : 'none';
}

async function salvarProspect() {
  const empresa = document.getElementById('pr-empresa').value.trim();
  if (!empresa) { alert('Informe o nome da empresa.'); return; }
  const status = document.getElementById('pr-status').value;
  if (status === 'descartado' && !document.getElementById('pr-motivo').value) {
    document.getElementById('pr-perda-req').classList.add('show');
    return;
  }
  const contato = document.getElementById('pr-contato').value.trim();
  const whatsapp = document.getElementById('pr-whatsapp').value.trim();
  const payload = {
    empresa,
    data_visita: document.getElementById('pr-data').value,
    nicho: document.getElementById('pr-nicho').value,
    status,
    contato,
    whatsapp,
    ticket: parseInt(document.getElementById('pr-ticket').value) || 1000,
    obs: document.getElementById('pr-obs').value.trim(),
    proximo: document.getElementById('pr-proximo').value,
    deadline: document.getElementById('pr-deadline').value || null,
    motivo_perda: status === 'descartado' ? document.getElementById('pr-motivo').value : null,
  };
  let error, prospectId = cmEditId;
  if (cmEditId) {
    ({ error } = await db.from('prospects').update(payload).eq('id', cmEditId));
  } else {
    const r = await db.from('prospects').insert([payload]).select().single();
    error = r.error;
    prospectId = r.data && r.data.id;
  }
  if (error) { alert('Erro: ' + error.message); return; }

  if (status === 'fechado' && prospectId) {
    const jaTemCliente = State.clientesAtivos.some((c) => c.prospect_id === prospectId);
    if (!jaTemCliente) {
      const origem = document.getElementById('pr-fc-origem').value;
      const frequencia = document.getElementById('pr-fc-frequencia').value;
      const dataFechamento = payload.data_visita || hj();
      const ticketMensal = parseFloat(document.getElementById('pr-fc-ticket').value) || payload.ticket;

      const rCliente = await db.from('clientes_ativos').insert([{
        prospect_id: prospectId,
        empresa,
        data_fechamento: dataFechamento,
        contato,
        whatsapp,
        ticket_mensal: ticketMensal,
        frequencia,
        produto_id: document.getElementById('pr-fc-produto').value || null,
        origem,
        quem_indicou: origem === 'indicacao' ? document.getElementById('pr-fc-indicou').value.trim() : null,
      }]).select().single();
      const novoClienteId = rCliente.data && rCliente.data.id;

      // Alimenta o Financeiro automaticamente: lança a receita do mês do fechamento.
      if (novoClienteId && ticketMensal > 0) {
        await db.from('receitas').insert([{
          cliente_id: novoClienteId,
          produto_id: document.getElementById('pr-fc-produto').value || null,
          valor: ticketMensal,
          data: dataFechamento,
          mes_projecao: dataFechamento.slice(0, 7),
          categoria: 'Serviços recorrentes',
          e_recorrente: frequencia === 'mensal',
          origem: 'cliente_crm',
          descricao: `${empresa} — fechamento via Comercial`,
        }]);
      }

      const [rc, rr] = await Promise.all([
        db.from('clientes_ativos').select('*').order('data_fechamento', { ascending: false }),
        db.from('receitas').select('*').order('data', { ascending: false }),
      ]);
      State.clientesAtivos = rc.data || [];
      State.receitas = rr.data || [];
    }
  }

  showSaving();
  fecharOv('ov-prospect');
  const r = await db.from('prospects').select('*').order('data_visita', { ascending: false });
  State.prospects = r.data || [];
  renderComercial();
}

async function excluirProspect(id) {
  if (!confirm('Excluir este prospect?')) return;
  await db.from('prospects').delete().eq('id', id);
  showSaving();
  State.prospects = State.prospects.filter((p) => p.id !== id);
  renderComercial();
}
