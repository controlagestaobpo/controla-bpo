// ===== estado local de filtros do funil de prospects =====
let cmFiltroStatus = 'todos';
let cmFiltroPeriodo = 'todos';
let cmDataEspecifica = '';
let cmEditId = null; // prospect sendo editado
let cmClienteEditId = null; // cliente ativo sendo editado
let cmEncerrarId = null; // cliente ativo a encerrar
let cmModoAtendimento = false; // modal aberto pra registrar um novo atendimento num prospect existente

const STATUS_COR = { indicado: '#A9B8CF', visita: '#4DB8F2', conversa: '#F5A623', proposta: '#9B7BF0', fechado: '#3DD68C', descartado: '#FF6B81' };
const STATUS_LBL = { indicado: 'A contatar', visita: 'Visita', conversa: 'Conversa/Reunião', proposta: 'Proposta enviada', fechado: 'Fechado', descartado: 'Descartado' };
const STATUS_CLS = { indicado: 'badge-gray', visita: 'badge-blue', conversa: 'badge-amber', proposta: 'badge-purple', fechado: 'badge-green', descartado: 'badge-red' };
const ORIGEM_LBL = { indicacao: 'Indicação', prospeccao: 'Prospecção', inbound: 'Inbound', outro: 'Outro' };

// Indicações ainda não contatadas ficam guardadas como prospect com status "indicado",
// mas não contam como prospect (funil, pipeline, iniciados) até o 1º contato.
const PREFIXO_INDICACAO = 'Indicação de ';

function prospectsAtendidos() {
  return State.prospects.filter((p) => p.status !== 'indicado');
}

function indicacoesAContatar() {
  return State.prospects.filter((p) => p.status === 'indicado');
}

function prospectsPipeline() {
  return prospectsAtendidos().filter((p) => p.status !== 'fechado' && p.status !== 'descartado');
}

// Quem indicou esse prospect (gravado no 1º registro do histórico), ou null.
function quemIndicouProspect(prospectId) {
  const origem = atendimentosDoProspect(prospectId).find((a) => a.status === 'indicado' && (a.obs || '').startsWith(PREFIXO_INDICACAO));
  return origem ? origem.obs.slice(PREFIXO_INDICACAO.length) : null;
}

// Histórico de atendimentos do prospect, do mais recente pro mais antigo.
// Cada prospect é UMA empresa (contagens de prospects não mudam); os atendimentos
// são só os contatos feitos com ela ao longo do tempo.
function atendimentosDoProspect(prospectId) {
  return State.prospectAtendimentos
    .filter((a) => a.prospect_id === prospectId)
    .sort((a, b) => (b.data || '').localeCompare(a.data || '') || (b.created_at || '').localeCompare(a.created_at || ''));
}

// Data do último contato — usada pra ordenar a lista e pros filtros "Hoje/Semana/Mês".
function ultimoContato(p) {
  const ultimo = atendimentosDoProspect(p.id)[0];
  return ultimo && ultimo.data > (p.data_visita || '') ? ultimo.data : p.data_visita;
}

function renderComercial() {
  const el = document.getElementById('page-comercial');
  el.innerHTML = `
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
      <div class="section-title">Clientes ativos</div>
      <div class="panel-sub" style="margin-top:-4px;">Todo cliente nasce de um prospect fechado — não existe cadastro avulso.</div>
      <div class="simple-list" id="cm-clientes-list" style="margin-bottom:6px;"></div>
    </div>

    <div class="section">
      <div class="section-title">Motivos de cancelamento</div>
      <div class="simple-list" id="cm-cancelados-list"></div>
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
  const novoTicket = parseFloat(document.getElementById('cl-ticket').value) || 0;
  const clienteAntes = cmClienteEditId ? State.clientesAtivos.find((c) => c.id === cmClienteEditId) : null;
  const payload = {
    empresa,
    data_fechamento: document.getElementById('cl-data').value,
    contato: document.getElementById('cl-contato').value.trim(),
    whatsapp: document.getElementById('cl-whatsapp').value.trim(),
    ticket_mensal: novoTicket,
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

  let avisoTicket = '';
  if (cmClienteEditId && clienteAntes && novoTicket !== Number(clienteAntes.ticket_mensal || 0)) {
    const { data: pendentes } = await db.from('receitas').select('id').eq('cliente_id', cmClienteEditId).eq('recebido', false);
    if (pendentes && pendentes.length) {
      await db.from('receitas').update({ valor: novoTicket }).eq('cliente_id', cmClienteEditId).eq('recebido', false);
      avisoTicket = `\n\nTambém ajustei o valor de ${pendentes.length} receita${pendentes.length === 1 ? '' : 's'} futura${pendentes.length === 1 ? '' : 's'} ainda não recebida${pendentes.length === 1 ? '' : 's'} pra ${fmtMoeda(novoTicket)}.`;
    }
  }

  showSaving();
  fecharOv('ov-cliente');
  const [rc, rr] = await Promise.all([
    db.from('clientes_ativos').select('*').order('data_fechamento', { ascending: false }),
    db.from('receitas').select('*').order('data', { ascending: true }),
  ]);
  State.clientesAtivos = rc.data || [];
  State.receitas = rr.data || [];
  renderComercial();
  if (avisoTicket) alert('Cliente atualizado!' + avisoTicket);
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
  const statusOpts = [['todos', 'Todos'], ['indicado', `A contatar (${indicacoesAContatar().length})`], ['visita', 'Visita'], ['conversa', 'Conversa/Reunião'], ['proposta', 'Proposta'], ['fechado', 'Fechado'], ['descartado', 'Descartado']];
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
  if (cmFiltroPeriodo === 'esp' && cmDataEspecifica) l = l.filter((p) => ultimoContato(p) === cmDataEspecifica);
  else if (cmFiltroPeriodo === 'hoje') l = l.filter((p) => ultimoContato(p) === hj());
  else if (cmFiltroPeriodo === 'ontem') l = l.filter((p) => ultimoContato(p) === ont());
  else if (cmFiltroPeriodo === 'semana') l = l.filter((p) => ultimoContato(p) >= iSem());
  else if (cmFiltroPeriodo === 'mes') l = l.filter((p) => ultimoContato(p) >= iMes());
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
  l.sort((a, b) => (ultimoContato(b) || '').localeCompare(ultimoContato(a) || ''));
  if (!l.length) { el.innerHTML = '<div class="empty-state">Nenhum prospect aqui.<br>Toque em + Novo prospect para registrar.</div>'; return; }

  const grupos = {};
  l.forEach((p) => { const d = ultimoContato(p) || 'sem-data'; if (!grupos[d]) grupos[d] = []; grupos[d].push(p); });
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
        <div class="ic-accent" style="background:${STATUS_COR[p.status] || '#A9B8CF'};width:${fechou ? '6px' : '4px'};"></div>
        <div class="ic-body">
          <div class="ic-top">
            <div class="ic-nome">${fechou ? '<span style="color:var(--positivo);">✓</span> ' : ''}${p.empresa}</div>
            <div class="ic-acts">
              <button class="btn btn-xs btn-primary" onclick="abrirModalProspect('${p.id}', true)">${p.status === 'indicado' ? 'registrar 1º contato' : '+ atendimento'}</button>
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
          ${htmlHistoricoAtendimentos(p)}
        </div>
      </div></div>`;
    }).join('');
    return `<div class="day-group">${header}${cards}</div>`;
  }).join('');
}

function htmlHistoricoAtendimentos(p) {
  const hist = atendimentosDoProspect(p.id);
  if (!hist.length) return '';
  return `<details class="ic-hist">
    <summary>${hist.length} ${hist.length === 1 ? 'atendimento' : 'atendimentos'} · primeiro contato ${fmtD(p.data_visita)}</summary>
    ${hist.map((a) => `<div class="ic-hist-item">
      <div class="ic-hist-top"><span>${fmtD(a.data)}</span><span class="badge ${STATUS_CLS[a.status] || 'badge-blue'}">${STATUS_LBL[a.status] || a.status}</span>
        <button class="btn btn-xs btn-danger" style="margin-left:auto;" onclick="excluirAtendimentoProspect('${a.id}')">×</button></div>
      ${a.obs ? `<div class="ic-obs" style="margin-top:3px;">${a.obs}</div>` : ''}
      ${a.proximo ? `<div class="ic-ct">&rarr; ${a.proximo}</div>` : ''}
    </div>`).join('')}
  </details>`;
}

async function excluirAtendimentoProspect(id) {
  if (!confirm('Excluir este atendimento do histórico?')) return;
  const { error } = await db.from('prospect_atendimentos').delete().eq('id', id);
  if (error) { alert('Erro: ' + error.message); return; }
  showSaving();
  State.prospectAtendimentos = State.prospectAtendimentos.filter((a) => a.id !== id);
  renderProspectsLista();
}

// modoAtendimento = true: registra um NOVO atendimento num prospect que já existe
// (não cria outro prospect e não sobrescreve o histórico).
function abrirModalProspect(id, modoAtendimento) {
  cmEditId = id || null;
  cmModoAtendimento = !!(id && modoAtendimento);
  document.getElementById('pr-indicacoes').innerHTML = '';
  document.getElementById('pr-tit').textContent = cmModoAtendimento ? 'Novo atendimento' : (id ? 'Editar prospect' : 'Novo prospect');
  document.getElementById('pr-data-lbl').textContent = cmModoAtendimento ? 'Data do atendimento' : (id ? 'Data do 1º contato' : 'Data do atendimento');
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
    if (cmModoAtendimento) {
      // Mantém os dados da empresa; o que é do atendimento começa em branco.
      document.getElementById('pr-data').value = hj();
      document.getElementById('pr-obs').value = '';
      document.getElementById('pr-proximo').value = '';
      document.getElementById('pr-deadline').value = '';
      // 1º contato com uma indicação: já sai do "a contatar"
      if (p.status === 'indicado') document.getElementById('pr-status').value = 'visita';
    }
    const indicou = quemIndicouProspect(id);
    if (indicou) {
      document.getElementById('pr-fc-origem').value = 'indicacao';
      document.getElementById('pr-fc-indicou').value = indicou;
    }
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

// ===================== INDICAÇÕES =====================
function cmAdicionarIndicacao() {
  const wrap = document.getElementById('pr-indicacoes');
  const row = document.createElement('div');
  row.className = 'ind-row';
  row.innerHTML = `
    <input type="text" class="ind-nome" placeholder="Empresa / nome *">
    <input type="text" class="ind-contato" placeholder="Contato">
    <input type="text" class="ind-whatsapp" placeholder="WhatsApp">
    <button class="btn btn-xs btn-danger" type="button" onclick="this.parentElement.remove()">×</button>`;
  wrap.appendChild(row);
  row.querySelector('.ind-nome').focus();
}

function cmLerIndicacoes() {
  return [...document.querySelectorAll('#pr-indicacoes .ind-row')]
    .map((r) => ({
      empresa: r.querySelector('.ind-nome').value.trim(),
      contato: r.querySelector('.ind-contato').value.trim(),
      whatsapp: r.querySelector('.ind-whatsapp').value.trim(),
    }))
    .filter((i) => i.empresa);
}

// Cria cada indicação como prospect "a contatar", já com quem indicou no histórico.
async function salvarIndicacoes(empresaQueIndicou, contatoQueIndicou, data) {
  const indicacoes = cmLerIndicacoes();
  if (!indicacoes.length) return null;
  const quem = empresaQueIndicou + (contatoQueIndicou ? ` (${contatoQueIndicou})` : '');
  const obs = PREFIXO_INDICACAO + quem;
  const r = await db.from('prospects').insert(indicacoes.map((i) => ({
    empresa: i.empresa, contato: i.contato, whatsapp: i.whatsapp,
    data_visita: data, status: 'indicado', nicho: '', ticket: 1000,
    obs, proximo: 'Ligar',
  }))).select();
  if (r.error) return r.error.message;
  const rh = await db.from('prospect_atendimentos').insert((r.data || []).map((p) => ({
    prospect_id: p.id, data, status: 'indicado', obs, proximo: 'Ligar',
  })));
  return rh.error ? rh.error.message : null;
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
  const dataInformada = document.getElementById('pr-data').value || hj();
  const prospectAtual = cmEditId ? State.prospects.find((x) => x.id === cmEditId) : null;
  const payload = {
    empresa,
    // No modo atendimento a data digitada é a do novo contato; a do 1º contato não muda —
    // exceto quando é uma indicação sendo contatada pela 1ª vez: aí ela vira a data do 1º contato.
    data_visita: cmModoAtendimento && prospectAtual.status !== 'indicado' ? prospectAtual.data_visita : dataInformada,
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

  // Novo prospect ou novo atendimento: entra uma linha no histórico.
  if (prospectId && (!cmEditId || cmModoAtendimento)) {
    const rHist = await db.from('prospect_atendimentos').insert([{
      prospect_id: prospectId, data: dataInformada, status, obs: payload.obs || null, proximo: payload.proximo || null,
    }]);
    if (rHist.error) alert('O prospect foi salvo, mas o atendimento não entrou no histórico: ' + rHist.error.message);
  }

  const erroIndicacoes = await salvarIndicacoes(empresa, contato, dataInformada);
  if (erroIndicacoes) alert('O atendimento foi salvo, mas as indicações não: ' + erroIndicacoes);

  if (status === 'fechado' && prospectId) {
    const jaTemCliente = State.clientesAtivos.some((c) => c.prospect_id === prospectId);
    if (!jaTemCliente) {
      const origem = document.getElementById('pr-fc-origem').value;
      const frequencia = document.getElementById('pr-fc-frequencia').value;
      const dataFechamento = dataInformada;
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

      // Alimenta o Financeiro automaticamente: já gera as receitas dos próximos meses do contrato.
      if (novoClienteId && ticketMensal > 0) {
        const produtoId = document.getElementById('pr-fc-produto').value || null;
        const produto = produtoId ? State.produtos.find((p) => p.id === produtoId) : null;
        const datas = frequencia === 'outra' ? [dataFechamento] : fnGerarDatasRecorrencia(dataFechamento, frequencia);
        const grupoId = crypto.randomUUID ? crypto.randomUUID() : (Date.now() + '-' + Math.random());
        await db.from('receitas').insert(datas.map((d) => ({
          cliente_id: novoClienteId,
          produto_id: produtoId,
          valor: ticketMensal,
          data: d,
          mes_projecao: d.slice(0, 7),
          categoria: 'Receita de Serviços',
          subcategoria: produto ? produto.nome : null,
          e_recorrente: frequencia !== 'outra',
          recorrencia_frequencia: frequencia !== 'outra' ? frequencia : null,
          grupo_recorrencia: frequencia !== 'outra' ? grupoId : null,
          origem: 'cliente_crm',
          descricao: `${empresa} — fechamento via Comercial`,
          recebido: false,
        })));
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
  const [r, rh] = await Promise.all([
    db.from('prospects').select('*').order('data_visita', { ascending: false }),
    db.from('prospect_atendimentos').select('*').order('data', { ascending: false }),
  ]);
  State.prospects = r.data || [];
  State.prospectAtendimentos = rh.data || [];
  cmModoAtendimento = false;
  renderComercial();
}

async function excluirProspect(id) {
  if (!confirm('Excluir este prospect?')) return;
  await db.from('prospects').delete().eq('id', id);
  showSaving();
  State.prospects = State.prospects.filter((p) => p.id !== id);
  State.prospectAtendimentos = State.prospectAtendimentos.filter((a) => a.prospect_id !== id);
  renderComercial();
}
