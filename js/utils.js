// ===== Datas =====
const hj = () => new Date().toISOString().split('T')[0];
const ont = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]; };
const iSem = () => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().split('T')[0]; };
const iMes = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'; };
const fimMes = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]; };
const mesAtual = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const proximoMes = () => { const d = new Date(); const p = new Date(d.getFullYear(), d.getMonth() + 1, 1); return p.getFullYear() + '-' + String(p.getMonth() + 1).padStart(2, '0'); };
const mesesAtras = (n) => { const d = new Date(); const p = new Date(d.getFullYear(), d.getMonth() - n, 1); return p.getFullYear() + '-' + String(p.getMonth() + 1).padStart(2, '0'); };
const mesesAdiante = (n) => { const d = new Date(); const p = new Date(d.getFullYear(), d.getMonth() + n, 1); return p.getFullYear() + '-' + String(p.getMonth() + 1).padStart(2, '0'); };

function fmtD(d) {
  if (!d) return '';
  if (d === hj()) return 'Hoje';
  if (d === ont()) return 'Ontem';
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
}

function nomeMesShort(ym) {
  const [y, m] = ym.split('-');
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

function nomeMesLongo(ym) {
  const [y, m] = ym.split('-');
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

// ===== Formatação =====
const fmtMoeda = (v) => 'R$' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtMoeda2 = (v) => 'R$' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (v) => Math.round(v || 0) + '%';

// ===== UI =====
function showSaving() {
  const el = document.getElementById('saving');
  if (!el) return;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1500);
}

function abrirOv(id) { document.getElementById(id).classList.add('open'); }
function fecharOv(id) { document.getElementById(id).classList.remove('open'); }

const CORES_CATEGORIA = ['#4DB8F2', '#3DD68C', '#F5A623', '#9B7BF0', '#FF6B81', '#34D3D3', '#EA580C', '#A9B8CF', '#6C8EF5', '#E8749A'];

// ===== Navegador de período (mês/ano) — Dashboard e Financeiro =====
function somarMes(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function mudarPeriodoTab(delta) {
  State.periodo = delta === 0 ? mesAtual() : somarMes(State.periodo, delta);
  RENDERERS[tabAtual]();
}

function htmlSeletorPeriodo() {
  return `<div class="periodo-nav">
    <button class="periodo-btn" onclick="mudarPeriodoTab(-1)">‹</button>
    <div class="periodo-label">${nomeMesLongo(State.periodo)}</div>
    <button class="periodo-btn" onclick="mudarPeriodoTab(1)">›</button>
    ${State.periodo !== mesAtual() ? `<button class="btn btn-xs" onclick="mudarPeriodoTab(0)">Hoje</button>` : ''}
  </div>`;
}

// ===== Meta efetiva do mês =====
// A meta de tudo no app parte de "quanto lucro líquido eu quero" (aba Metas).
// Se o mês não tem meta salva, usa a meta salva mais recente como referência (carry-forward).
function metaEfetivaDoMes(mes) {
  if (!State.metasFinanceiras || !State.metasFinanceiras.length) return null;
  const exata = State.metasFinanceiras.find((m) => m.mes === mes);
  if (exata) return exata;
  const anteriores = State.metasFinanceiras.filter((m) => m.mes <= mes).sort((a, b) => b.mes.localeCompare(a.mes));
  return anteriores[0] || null;
}

// ===== DRE enxuto, com detalhamento por categoria =====
// Regime de caixa: só entra no DRE o que já foi de fato pago/recebido,
// contado no mês em que o dinheiro realmente entrou/saiu (não o vencimento).
function receitasDoMes(mes) {
  return State.receitas.filter((r) => r.status === 'ativa' && r.recebido && (r.data_recebimento || '').slice(0, 7) === mes);
}
function despesasDoMes(mes) {
  return State.despesas.filter((d) => d.pago && (d.data_pagamento || '').slice(0, 7) === mes);
}
function dataDesde(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().split('T')[0];
}
function receitasUltimosDias(dias) {
  const desde = dataDesde(dias);
  return State.receitas.filter((r) => r.status === 'ativa' && r.recebido && r.data_recebimento >= desde);
}
function despesasUltimosDias(dias) {
  const desde = dataDesde(dias);
  return State.despesas.filter((d) => d.pago && d.data_pagamento >= desde);
}

function montarDRE(mes) {
  return montarDREdeListas(receitasDoMes(mes), despesasDoMes(mes), mes);
}
function montarDREUltimosDias(dias) {
  return montarDREdeListas(receitasUltimosDias(dias), despesasUltimosDias(dias), null);
}

function montarDREdeListas(receitasMes, despesasMes, mes) {
  // ---- Receita, agrupada por categoria (operacional x não operacional) ----
  const receitaPorCategoria = {};
  receitasMes.forEach((r) => { const k = r.categoria || 'Sem categoria'; receitaPorCategoria[k] = (receitaPorCategoria[k] || 0) + Number(r.valor || 0); });
  const receitaOperacionalDetalhe = [];
  const receitaNaoOperacionalDetalhe = [];
  Object.entries(receitaPorCategoria).forEach(([nome, total]) => {
    const catDef = State.categoriasReceita.find((c) => c.nome_principal === nome);
    const grupo = (catDef && catDef.grupo_dre) || 'operacional';
    (grupo === 'operacional' ? receitaOperacionalDetalhe : receitaNaoOperacionalDetalhe).push({ nome, total });
  });
  [receitaOperacionalDetalhe, receitaNaoOperacionalDetalhe].forEach((l) => l.sort((a, b) => b.total - a.total));
  const receitaOperacional = receitaOperacionalDetalhe.reduce((s, c) => s + c.total, 0);
  const receitaNaoOperacional = receitaNaoOperacionalDetalhe.reduce((s, c) => s + c.total, 0);
  const receitaTotal = receitaOperacional + receitaNaoOperacional;

  // ---- Despesas, agrupadas por categoria dentro de cada grupo DRE ----
  const porCategoria = {};
  despesasMes.forEach((d) => { porCategoria[d.categoria] = (porCategoria[d.categoria] || 0) + Number(d.valor || 0); });

  const grupos = { deducao: [], administrativas: [], comerciais: [], pessoal: [], financeiras: [] };
  Object.entries(porCategoria).forEach(([nome, total]) => {
    const catDef = State.categoriasDespesa.find((c) => c.nome_principal === nome);
    const grupo = (catDef && catDef.grupo_dre) || 'administrativas';
    (grupos[grupo] || grupos.administrativas).push({ nome, total });
  });
  Object.values(grupos).forEach((lista) => lista.sort((a, b) => b.total - a.total));

  const totalGrupo = (g) => grupos[g].reduce((s, c) => s + c.total, 0);
  const deducoes = totalGrupo('deducao');
  const receitaLiquidaOperacional = receitaOperacional - deducoes;
  const despPorGrupo = {};
  GRUPO_DRE_ORDEM.forEach((g) => { despPorGrupo[g] = totalGrupo(g); });
  const totalDespesasOperacionais = GRUPO_DRE_ORDEM.reduce((s, g) => s + despPorGrupo[g], 0);
  const resultadoOperacional = receitaLiquidaOperacional - totalDespesasOperacionais;
  const lucroLiquido = resultadoOperacional + receitaNaoOperacional;
  const margem = receitaTotal > 0 ? Math.round(lucroLiquido / receitaTotal * 100) : 0;

  return {
    mes, receitaOperacional, receitaOperacionalDetalhe, deducoes, receitaLiquidaOperacional,
    grupos, despPorGrupo, totalDespesasOperacionais, resultadoOperacional,
    receitaNaoOperacional, receitaNaoOperacionalDetalhe, receitaTotal,
    lucroLiquido, margem,
  };
}

// ===== Intervalos de datas (Visão anual, Metas, exportação pra IA) =====
function ultimoDiaDoMes(ym) {
  const [y, m] = ym.split('-').map(Number);
  return ym + '-' + String(new Date(y, m, 0).getDate()).padStart(2, '0');
}

// Lista de meses 'YYYY-MM' entre dois meses (inclusive).
function mesesEntre(de, ate) {
  const lista = [];
  if (!de || !ate || de > ate) return lista;
  let m = de;
  while (m <= ate && lista.length < 240) { lista.push(m); m = somarMes(m, 1); }
  return lista;
}

// DRE (regime de caixa) entre duas datas 'YYYY-MM-DD', inclusive.
function montarDREIntervalo(de, ate) {
  const receitas = State.receitas.filter((r) => r.status === 'ativa' && r.recebido && r.data_recebimento >= de && r.data_recebimento <= ate);
  const despesas = State.despesas.filter((d) => d.pago && d.data_pagamento >= de && d.data_pagamento <= ate);
  return montarDREdeListas(receitas, despesas, null);
}

// Data em que o prospect foi dado como perdido: o atendimento em que virou "descartado"
// (cai no data_visita pra prospects antigos, sem histórico).
function dataPerdaProspect(p) {
  if (p.status !== 'descartado') return null;
  const hist = (State.prospectAtendimentos || []).filter((a) => a.prospect_id === p.id && a.status === 'descartado').sort((a, b) => (a.data || '').localeCompare(b.data || ''));
  return hist.length ? hist[0].data : p.data_visita;
}

// Clientes ativos num determinado dia (fechados até ali e ainda não encerrados).
function clientesAtivosEm(dataISO) {
  return State.clientesAtivos.filter((c) => (c.data_fechamento || '') <= dataISO && (c.status === 'ativo' || !c.data_encerramento || c.data_encerramento > dataISO));
}

// Indicadores comerciais e financeiros de um mês — base da Visão anual e da exportação pra IA.
function metricasDoMes(mes) {
  const dre = montarDRE(mes);
  const fim = ultimoDiaDoMes(mes);
  const noMes = (d) => (d || '').slice(0, 7) === mes;
  const atendidos = State.prospects.filter((p) => p.status !== 'indicado');
  const hist = State.prospectAtendimentos || [];
  const ativosFim = clientesAtivosEm(fim);
  const ganhos = State.clientesAtivos.filter((c) => noMes(c.data_fechamento));
  const encerrados = State.clientesAtivos.filter((c) => c.status === 'encerrado' && noMes(c.data_encerramento));
  const ativosInicio = clientesAtivosEm(ultimoDiaDoMes(somarMes(mes, -1))).length;
  const perdidos = State.prospects.filter((p) => noMes(dataPerdaProspect(p)));
  return {
    mes, dre,
    receita: dre.receitaTotal,
    despesas: dre.deducoes + dre.totalDespesasOperacionais,
    impostos: dre.deducoes,
    lucro: dre.lucroLiquido,
    margem: dre.margem,
    iniciados: atendidos.filter((p) => noMes(p.data_visita)).length,
    atendimentos: hist.filter((a) => a.status !== 'indicado' && noMes(a.data)).length,
    indicacoesRecebidas: hist.filter((a) => a.status === 'indicado' && noMes(a.data)).length,
    ganhos: ganhos.length,
    valorGanho: ganhos.reduce((s, c) => s + Number(c.ticket_mensal || 0), 0),
    perdidos: perdidos.length,
    valorPerdido: perdidos.reduce((s, p) => s + Number(p.ticket || 0), 0),
    encerrados: encerrados.length,
    churn: ativosInicio > 0 ? Math.round(encerrados.length / ativosInicio * 100) : 0,
    clientesAtivos: ativosFim.length,
    mrr: ativosFim.reduce((s, c) => s + Number(c.ticket_mensal || 0), 0),
  };
}

// ===== Navegação pelos cards dos dashboards =====
// opts: { mes, tipo ('receita'|'despesa'), status (filtro de prospects), ancora (id do elemento) }
function irPara(tab, opts) {
  opts = opts || {};
  if (opts.mes) State.periodo = opts.mes;
  if (tab === 'financeiro' && typeof fnFiltroTipo !== 'undefined') fnFiltroTipo = opts.tipo || 'todos';
  if (tab === 'comercial' && typeof cmFiltroStatus !== 'undefined') { cmFiltroStatus = opts.status || 'todos'; cmFiltroPeriodo = 'todos'; cmDataEspecifica = ''; }
  trocarTab(tab, { manterPeriodo: true });
  if (opts.ancora) {
    const alvo = document.getElementById(opts.ancora);
    if (alvo) alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    window.scrollTo(0, 0);
  }
}
