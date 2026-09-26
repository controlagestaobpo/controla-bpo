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

// ===== Projeção de ritmo (pace) até o fim do mês =====
function diasNoMes(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
function projecaoFimDeMes(valorAcumulado, mes) {
  const total = diasNoMes(mes);
  const hoje = new Date();
  const ehMesAtual = mes === mesAtual();
  const diaAtual = ehMesAtual ? hoje.getDate() : total;
  return diaAtual > 0 ? Math.round(valorAcumulado / diaAtual * total) : 0;
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
