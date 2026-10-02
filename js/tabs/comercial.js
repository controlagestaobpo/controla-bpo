// ===== estado local de filtros do funil de prospects =====
let cmFiltroStatus = 'aberto'; // padrão: só o que ainda está em negociação
let cmFiltroPeriodo = 'todos';
let cmDataEspecifica = '';
let cmEditId = null; // prospect sendo editado
let cmClienteEditId = null; // cliente ativo sendo editado
let cmEncerrarId = null; // cliente ativo a encerrar
let cmModoAtendimento = false; // modal aberto pra registrar um novo atendimento num prospect existente

const STATUS_COR = { indicado: '#A9B8CF', retomar: '#34D3D3', visita: '#4DB8F2', conversa: '#F5A623', proposta: '#9B7BF0', fechado: '#3DD68C', descartado: '#FF6B81' };
const STATUS_LBL = { indicado: 'A contatar', retomar: 'Retomar depois', visita: 'Visita', conversa: 'Conversa/Reunião', proposta: 'Proposta enviada', fechado: 'Fechado', descartado: 'Descartado' };
const STATUS_CLS = { indicado: 'badge-gray', retomar: 'badge-gray', visita: 'badge-blue', conversa: 'badge-amber', proposta: 'badge-purple', fechado: 'badge-green', descartado: 'badge-red' };
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

// "Retomar depois": pausado até a data de retorno — não conta como em negociação até lá.
// Na data (ou depois), volta a contar e aparece em "Ações imediatas".
function prospectPausado(p) {
  return p.status === 'retomar' && !!p.retorno && p.retorno > hj();
}

function prospectsParaRetomar() {
  return State.prospects.filter(prospectPausado).sort((a, b) => a.retorno.localeCompare(b.retorno));
}

function prospectsPipeline() {
  return prospectsAtendidos().filter((p) => p.status !== 'fechado' && p.status !== 'descartado' && !prospectPausado(p));
}

// ===== Quem mais indica =====
const chaveNome = (n) => (n || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Agrupa todas as indicações por quem indicou: quantas indicou, quantas fecharam,
// quantas ainda estão em aberto e quantas não fecharam (descartadas).
function situacaoIndicado(p) {
  if (!p || p.status === 'fechado') return 'fechou';
  if (p.status === 'descartado') return 'perdido';
  return 'aberto';
}

function rankingIndicadores() {
  const grupos = {};
  const add = (quem, empresa, situacao) => {
    const nome = nomeCadastrado(quem);
    const k = chaveNome(nome);
    if (!k) return;
    if (!grupos[k]) grupos[k] = { nome, indicados: [], fechados: 0, abertos: 0, perdidos: 0 };
    if (grupos[k].indicados.some((e) => chaveNome(e.empresa) === chaveNome(empresa))) return;
    grupos[k].indicados.push({ empresa, situacao });
    if (situacao === 'fechou') grupos[k].fechados += 1;
    else if (situacao === 'perdido') grupos[k].perdidos += 1;
    else grupos[k].abertos += 1;
  };
  State.prospects.forEach((p) => add(p.quem_indicou, p.empresa, situacaoIndicado(p)));
  State.clientesAtivos.forEach((c) => add(c.quem_indicou, c.empresa, 'fechou'));
  return Object.values(grupos).sort((a, b) => b.indicados.length - a.indicados.length || b.fechados - a.fechados);
}

// Usa a grafia do nome já cadastrado (cliente ou prospect), pra não separar "andreya" de "Andreya Pessin".
function nomeCadastrado(digitado) {
  const nome = (digitado || '').trim();
  if (!nome) return null;
  const cadastrados = [...new Set([...State.clientesAtivos.map((c) => c.empresa), ...State.prospects.map((p) => p.empresa)].filter(Boolean))];
  const exato = cadastrados.find((n) => chaveNome(n) === chaveNome(nome));
  if (exato) return exato;
  // Nome incompleto ("Andreya" -> "Andreya Pessin"), quando só um cadastro começa assim.
  const comecaCom = cadastrados.filter((n) => (chaveNome(n) + ' ').startsWith(chaveNome(nome) + ' '));
  return comecaCom.length === 1 ? comecaCom[0] : nome;
}

function qtdIndicacoesDe(nome) {
  const g = rankingIndicadores().find((r) => chaveNome(r.nome) === chaveNome(nome));
  return g ? g.indicados.length : 0;
}

// Quem indicou esse prospect (gravado no 1º registro do histórico), ou null.
function quemIndicouProspect(prospectId) {
  const p = State.prospects.find((x) => x.id === prospectId);
  if (p && p.quem_indicou) return p.quem_indicou;
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

    <div class="section" id="cm-sec-clientes">
      <div class="section-title">Clientes ativos</div>
      <div class="panel-sub" style="margin-top:-4px;">Todo cliente nasce de um prospect fechado — não existe cadastro avulso.</div>
      <div class="simple-list" id="cm-clientes-list" style="margin-bottom:6px;"></div>
    </div>

    <div class="section" id="cm-sec-churn">
      <div class="section-title">Churn e cancelamentos</div>
      ${htmlResumoChurn()}
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
        <div class="simple-row-sub">${fmtD(c.data_fechamento)} · ${c.contato || 'sem contato'} · ${fmtMoeda(c.ticket_mensal)}/mês${produto ? ' · ' + produto.nome : ''}${qtdIndicacoesDe(c.empresa) ? ` · <span style="color:var(--purple);">indicou ${qtdIndicacoesDe(c.empresa)}</span>` : ''}</div>
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
    quem_indicou: document.getElementById('cl-origem').value === 'indicacao' ? nomeCadastrado(document.getElementById('cl-indicou').value) : null,
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

// ===================== CHURN (antiga aba Histórico) =====================
function gerarInsightChurn(churnRate, totalAllTime) {
  if (totalAllTime === 0) return 'Ainda não há clientes suficientes pra calcular o churn.';
  if (churnRate === 0) return 'Nenhum cancelamento registrado — ótima retenção.';
  if (churnRate <= 10) return `Seu churn de ${churnRate}% está baixo — continue assim.`;
  if (churnRate <= 25) return `Seu churn de ${churnRate}% é aceitável, mas dá pra melhorar — considere aumentar os pontos de contato com clientes ativos.`;
  return `Seu churn de ${churnRate}% está alto — vale investigar os motivos de cancelamento mais recorrentes abaixo.`;
}

function htmlResumoChurn() {
  const encerrados = State.clientesAtivos.filter((c) => c.status === 'encerrado');
  const ativos = State.clientesAtivos.filter((c) => c.status === 'ativo');
  const total = State.clientesAtivos.length;
  const churnRate = total > 0 ? Math.round(encerrados.length / total * 100) : 0;
  const porMotivo = {};
  encerrados.forEach((c) => { const k = c.motivo_cancelamento || 'não informado'; porMotivo[k] = (porMotivo[k] || 0) + 1; });
  const motivos = Object.entries(porMotivo).sort((a, b) => b[1] - a[1]);
  return `
    <div class="card-grid-2" style="margin-bottom:10px;">
      <div class="stat-card"><div class="stat-lbl">Total de clientes</div><div class="stat-val">${total}</div><div class="stat-sub">desde o início</div></div>
      <div class="stat-card"><div class="stat-lbl">Ativos</div><div class="stat-val" style="color:var(--positivo)">${ativos.length}</div></div>
      <div class="stat-card"><div class="stat-lbl">Cancelados</div><div class="stat-val" style="color:var(--negativo)">${encerrados.length}</div></div>
      <div class="stat-card"><div class="stat-lbl">Churn rate</div><div class="stat-val">${churnRate}%</div></div>
    </div>
    <div class="panel" style="border-left:4px solid var(--amber);margin-bottom:10px;">
      <div style="font-size:12px;color:var(--text2);line-height:1.6;">${gerarInsightChurn(churnRate, total)}</div>
      ${motivos.length ? `<div style="font-size:11px;color:var(--cinza-claro);margin-top:6px;">Motivos: ${motivos.map(([m, n]) => `${m} (${n})`).join(' · ')}</div>` : ''}
    </div>`;
}

function renderCanceladosLista() {
  const el = document.getElementById('cm-cancelados-list');
  if (!el) return;
  const lista = State.clientesAtivos.filter((c) => c.status === 'encerrado').sort((a, b) => (b.data_encerramento || '').localeCompare(a.data_encerramento || ''));
  if (!lista.length) { el.innerHTML = '<div class="empty-state">Nenhum cancelamento registrado.</div>'; return; }
  el.innerHTML = lista.map((c) => `<div class="simple-row">
    <div class="simple-row-main">
      <div class="simple-row-title">${c.empresa}</div>
      <div class="simple-row-sub">${fmtD(c.data_encerramento)} · ${c.motivo_cancelamento || '-'} · cancelado por ${c.quem_cancelou === 'empresa' ? 'nós' : 'cliente'}${c.obs ? ' · ' + c.obs : ''}</div>
    </div>
    <span class="badge badge-red">encerrado</span>
  </div>`).join('');
}

// ===================== PROSPECTS =====================
function renderFiltrosProspect() {
  const fs = document.getElementById('cm-fs');
  const statusOpts = [['aberto', 'Em aberto'], ['todos', 'Todos'], ['indicado', `A contatar (${indicacoesAContatar().length})`], ['retomar', `Retomar depois (${State.prospects.filter((p) => p.status === 'retomar').length})`], ['visita', 'Visita'], ['conversa', 'Conversa/Reunião'], ['proposta', 'Proposta'], ['fechado', 'Fechado'], ['descartado', 'Descartado']];
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
  // "Em aberto": descartados e fechados não estão mais em negociação.
  if (cmFiltroStatus === 'aberto') l = l.filter((p) => p.status !== 'fechado' && p.status !== 'descartado' && !prospectPausado(p));
  else if (cmFiltroStatus !== 'todos') l = l.filter((p) => p.status === cmFiltroStatus);
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
            ${p.status === 'retomar' && p.retorno ? `<span class="badge ${p.retorno <= h ? 'badge-red' : 'badge-gray'}">${p.retorno <= h ? 'retomar agora' : 'retomar em ' + fmtD(p.retorno)}</span>` : ''}
            ${p.quem_indicou ? `<span class="badge badge-purple">indicado por ${p.quem_indicou}</span>` : ''}
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
  // Registrar indicações que ESSE contato passou só faz sentido num atendimento com ele.
  document.getElementById('pr-sec-indicacoes').style.display = cmModoAtendimento ? '' : 'none';
  const nomes = [...new Set([...State.clientesAtivos.map((c) => c.empresa), ...State.prospects.map((x) => x.empresa)].filter(Boolean))].sort();
  document.getElementById('lista-indicadores').innerHTML = nomes.map((n) => `<option value="${n.replace(/"/g, '&quot;')}">`).join('');
  document.getElementById('pr-retorno').value = '';
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
    document.getElementById('pr-retorno').value = p.retorno || '';
    document.getElementById('pr-motivo').value = p.motivo_perda || '';
    document.getElementById('pr-fc-ticket').value = p.ticket || '';
    document.getElementById('pr-fc-frequencia').value = 'mensal';
    document.getElementById('pr-fc-origem').value = p.origem || 'prospeccao';
    document.getElementById('pr-fc-indicou').value = p.quem_indicou || '';
    if (cmModoAtendimento) {
      // Mantém os dados da empresa; o que é do atendimento começa em branco.
      document.getElementById('pr-data').value = hj();
      document.getElementById('pr-obs').value = '';
      document.getElementById('pr-proximo').value = '';
      document.getElementById('pr-deadline').value = '';
      // 1º contato com uma indicação: já sai do "a contatar"
      if (p.status === 'indicado') document.getElementById('pr-status').value = 'visita';
      if (p.status === 'retomar') { document.getElementById('pr-status').value = 'conversa'; document.getElementById('pr-retorno').value = ''; }
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
  // Guarda só o nome da empresa, pra juntar todas as indicações dela no ranking "Quem mais indica".
  const quem = empresaQueIndicou;
  const obs = PREFIXO_INDICACAO + quem;
  const r = await db.from('prospects').insert(indicacoes.map((i) => ({
    empresa: i.empresa, contato: i.contato, whatsapp: i.whatsapp,
    data_visita: data, status: 'indicado', nicho: '', ticket: 1000,
    obs, proximo: 'Ligar', origem: 'indicacao', quem_indicou: quem,
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
  document.getElementById('row-retorno').style.display = st === 'retomar' ? 'block' : 'none';
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
  if (status === 'retomar' && !document.getElementById('pr-retorno').value) {
    alert('Informe a data em que você vai retomar o contato.');
    return;
  }
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
    retorno: status === 'retomar' ? document.getElementById('pr-retorno').value : null,
    origem: document.getElementById('pr-fc-origem').value || null,
    quem_indicou: document.getElementById('pr-fc-origem').value === 'indicacao' ? nomeCadastrado(document.getElementById('pr-fc-indicou').value) : null,
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
        quem_indicou: origem === 'indicacao' ? nomeCadastrado(document.getElementById('pr-fc-indicou').value) : null,
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
  // Pode ter sido aberto pelo Dashboard: atualiza a tela que estiver aberta.
  (RENDERERS[tabAtual] || renderComercial)();
}

// ===================== NOVO ATENDIMENTO PELO DASHBOARD =====================
function abrirEscolherProspect() {
  document.getElementById('ep-busca').value = '';
  renderEscolherProspect();
  abrirOv('ov-escolher-prospect');
  setTimeout(() => document.getElementById('ep-busca').focus(), 50);
}

function renderEscolherProspect() {
  const q = document.getElementById('ep-busca').value.trim().toLowerCase();
  const ordem = { indicado: 0, visita: 1, conversa: 1, proposta: 1, fechado: 2, descartado: 3 };
  const lista = State.prospects
    .filter((p) => !q || (p.empresa || '').toLowerCase().includes(q) || (p.contato || '').toLowerCase().includes(q))
    .sort((a, b) => (ordem[a.status] ?? 1) - (ordem[b.status] ?? 1) || (a.empresa || '').localeCompare(b.empresa || ''));
  const el = document.getElementById('ep-lista');
  if (!lista.length) { el.innerHTML = '<div class="empty-state">Nenhum prospect encontrado — use "+ Novo prospect".</div>'; return; }
  el.innerHTML = lista.map((p) => `<div class="simple-row" style="cursor:pointer;" onclick="fecharOv('ov-escolher-prospect');abrirModalProspect('${p.id}', true)">
    <div class="simple-row-main">
      <div class="simple-row-title">${p.empresa}</div>
      <div class="simple-row-sub">${[p.contato, 'último contato ' + fmtD(ultimoContato(p))].filter(Boolean).join(' · ')}</div>
    </div>
    <span class="badge ${STATUS_CLS[p.status] || 'badge-blue'}">${STATUS_LBL[p.status] || p.status}</span>
  </div>`).join('');
}

async function excluirProspect(id) {
  if (!confirm('Excluir este prospect?')) return;
  await db.from('prospects').delete().eq('id', id);
  showSaving();
  State.prospects = State.prospects.filter((p) => p.id !== id);
  State.prospectAtendimentos = State.prospectAtendimentos.filter((a) => a.prospect_id !== id);
  renderComercial();
}
