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
function retiradasDoMes(mes) {
  return State.retiradas.filter((r) => r.mes_projecao === mes);
}

function montarDRE(mes) {
  const receitaBruta = receitasDoMes(mes).reduce((s, r) => s + Number(r.valor || 0), 0);
  const despesasMes = despesasDoMes(mes);
  const retiradasMes = retiradasDoMes(mes).reduce((s, r) => s + Number(r.valor || 0), 0);

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
  const receitaLiquida = receitaBruta - deducoes;
  const despPorGrupo = {};
  GRUPO_DRE_ORDEM.forEach((g) => { despPorGrupo[g] = totalGrupo(g); });
  const totalDespesasOperacionais = GRUPO_DRE_ORDEM.reduce((s, g) => s + despPorGrupo[g], 0);
  const lucroLiquido = receitaLiquida - totalDespesasOperacionais;
  const margem = receitaBruta > 0 ? Math.round(lucroLiquido / receitaBruta * 100) : 0;
  const lucroRetido = lucroLiquido - retiradasMes;

  return { mes, receitaBruta, deducoes, receitaLiquida, grupos, despPorGrupo, totalDespesasOperacionais, lucroLiquido, margem, retiradasMes, lucroRetido };
}
