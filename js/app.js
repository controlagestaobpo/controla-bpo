if (window.Chart) {
  Chart.defaults.font.family = "'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif";
  Chart.defaults.color = '#A9B8CF';
  Chart.defaults.borderColor = 'rgba(255,255,255,0.08)';
}

const TABS = ['dashboard-comercial', 'dashboard-financeiro', 'comercial', 'financeiro', 'historico', 'metas', 'config'];
const RENDERERS = {
  'dashboard-comercial': renderDashboardComercial,
  'dashboard-financeiro': renderDashboardFinanceiro,
  comercial: renderComercial,
  financeiro: renderFinanceiro,
  historico: renderHistorico,
  metas: renderMetasInteligentes,
  config: renderConfig,
};

let tabAtual = 'dashboard-comercial';

function trocarTab(tab) {
  tabAtual = tab;
  TABS.forEach((t) => {
    document.getElementById('page-' + t).classList.toggle('active', t === tab);
    document.getElementById('tab-' + t).classList.toggle('active', t === tab);
  });
  fecharSidebarMobile();
  RENDERERS[tab]();
}

// ===== Menu lateral =====
function sidebarEhDesktop() {
  return window.matchMedia('(min-width: 860px)').matches;
}

function toggleSidebar() {
  const app = document.getElementById('app');
  if (sidebarEhDesktop()) {
    const collapsed = app.classList.toggle('sidebar-collapsed');
    try { localStorage.setItem('cgb_sidebar_collapsed', collapsed ? '1' : '0'); } catch (e) {}
  } else {
    app.classList.toggle('sidebar-mobile-open');
  }
}

function fecharSidebarMobile() {
  document.getElementById('app').classList.remove('sidebar-mobile-open');
}

function initSidebar() {
  try {
    if (localStorage.getItem('cgb_sidebar_collapsed') === '1') {
      document.getElementById('app').classList.add('sidebar-collapsed');
    }
  } catch (e) {}
}

async function login() {
  const email = document.getElementById('l-email').value.trim();
  const senha = document.getElementById('l-senha').value;
  document.getElementById('l-err').style.display = 'none';
  document.getElementById('l-load').style.display = 'block';
  const { error } = await db.auth.signInWithPassword({ email, password: senha });
  document.getElementById('l-load').style.display = 'none';
  if (error) {
    document.getElementById('l-err').style.display = 'block';
    return;
  }
  mostrarApp();
}

async function logout() {
  await db.auth.signOut();
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}

async function mostrarApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  initSidebar();
  document.getElementById('page-dashboard-comercial').innerHTML = '<div class="empty-state">Carregando...</div>';
  await carregarTudo();
  State.periodo = mesAtual();
  trocarTab('dashboard-comercial');
}

db.auth.getSession().then(({ data: { session } }) => {
  if (session) mostrarApp();
});
