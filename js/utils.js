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
