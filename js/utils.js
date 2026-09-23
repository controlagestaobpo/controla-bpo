// ===== Datas =====
const hj = () => new Date().toISOString().split('T')[0];
const ont = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]; };
const iSem = () => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().split('T')[0]; };
const iMes = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'; };
const fimMes = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]; };
const mesAtual = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const proximoMes = () => { const d = new Date(); const p = new Date(d.getFullYear(), d.getMonth() + 1, 1); return p.getFullYear() + '-' + String(p.getMonth() + 1).padStart(2, '0'); };

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

const CORES_CATEGORIA = ['#1A3A6B', '#00C896', '#D97706', '#7C3AED', '#2563EB', '#DC2626', '#EA580C', '#00A86B', '#8A97A8', '#0F1B3C'];

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
function receitasDoMes(mes) {
  return State.receitas.filter((r) => r.mes_projecao === mes && r.status === 'ativa');
}
function despesasDoMes(mes) {
  return State.despesas.filter((d) => d.mes_projecao === mes);
}

function montarDRE(mes) {
  const receitasMes = receitasDoMes(mes);
  const despesasMes = despesasDoMes(mes);

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
