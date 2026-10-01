if (window.Chart) {
  Chart.defaults.font.family = "'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif";
  Chart.defaults.color = '#A9B8CF';
  Chart.defaults.borderColor = 'rgba(255,255,255,0.08)';
  if (window.ChartDataLabels) {
    Chart.register(ChartDataLabels);
    Chart.defaults.set('plugins.datalabels', {
      color: '#FFFFFF',
      font: { weight: '700', size: 11 },
      anchor: 'end',
      align: 'end',
      offset: 2,
      clip: false,
    });
  }
}

const TABS = ['dashboard-comercial', 'dashboard-financeiro', 'anual', 'comercial', 'financeiro', 'metas', 'config'];
const RENDERERS = {
  'dashboard-comercial': renderDashboardComercial,
  'dashboard-financeiro': renderDashboardFinanceiro,
  comercial: renderComercial,
  financeiro: renderFinanceiro,
  anual: renderVisaoAnual,
  metas: renderMetasInteligentes,
  config: renderConfig,
};

let tabAtual = 'dashboard-comercial';

function trocarTab(tab, opts) {
  tabAtual = tab;
  // Pelo menu, os dashboards sempre abrem no mês vigente (clicar num card mantém o mês escolhido).
  if (tab.startsWith('dashboard') && !(opts && opts.manterPeriodo)) State.periodo = mesAtual();
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
  document.getElementById('forgot-screen').classList.remove('show');
  document.getElementById('reset-screen').classList.remove('show');
  document.getElementById('app').style.display = 'flex';
  initSidebar();
  document.getElementById('page-dashboard-comercial').innerHTML = '<div class="empty-state">Carregando...</div>';
  await carregarTudo();
  State.periodo = mesAtual();
  trocarTab('dashboard-comercial');
}

// ===== Esqueci minha senha =====
function mostrarEsqueciSenha() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('fp-email').value = document.getElementById('l-email').value.trim();
  document.getElementById('fp-err').style.display = 'none';
  document.getElementById('fp-ok').style.display = 'none';
  document.getElementById('forgot-screen').classList.add('show');
}

function voltarLogin() {
  document.getElementById('forgot-screen').classList.remove('show');
  document.getElementById('reset-screen').classList.remove('show');
  document.getElementById('login-screen').style.display = 'flex';
}

async function enviarRecuperacaoSenha() {
  const email = document.getElementById('fp-email').value.trim();
  const errEl = document.getElementById('fp-err');
  const okEl = document.getElementById('fp-ok');
  errEl.style.display = 'none';
  okEl.style.display = 'none';
  if (!email) { errEl.textContent = 'Informe seu e-mail.'; errEl.style.display = 'block'; return; }

  document.getElementById('fp-load').style.display = 'block';
  const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  document.getElementById('fp-load').style.display = 'none';

  if (error) {
    errEl.textContent = error.message.includes('rate limit')
      ? 'Muitos pedidos em pouco tempo. Espere alguns minutos e tente de novo.'
      : 'Não foi possível enviar o e-mail agora. Tente novamente em alguns minutos.';
    errEl.style.display = 'block';
    return;
  }
  okEl.textContent = 'Enviamos um link de recuperação pro seu e-mail. Confira também a caixa de spam.';
  okEl.style.display = 'block';
}

// ===== Definir nova senha (link de recuperação) =====
async function salvarNovaSenha() {
  const senha = document.getElementById('rp-senha').value;
  const senha2 = document.getElementById('rp-senha2').value;
  const errEl = document.getElementById('rp-err');
  errEl.style.display = 'none';
  if (!senha || senha.length < 6) { errEl.textContent = 'A senha precisa ter pelo menos 6 caracteres.'; errEl.style.display = 'block'; return; }
  if (senha !== senha2) { errEl.textContent = 'As senhas não são iguais.'; errEl.style.display = 'block'; return; }

  document.getElementById('rp-load').style.display = 'block';
  const { error } = await db.auth.updateUser({ password: senha });
  document.getElementById('rp-load').style.display = 'none';

  if (error) { errEl.textContent = 'Erro: ' + error.message; errEl.style.display = 'block'; return; }
  mostrarApp();
}

// ===== Boot: sessão normal ou link de recuperação de senha =====
if (window.location.hash.includes('type=recovery')) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('reset-screen').classList.add('show');
} else {
  db.auth.getSession().then(({ data: { session } }) => {
    if (session) mostrarApp();
  });
}

db.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('forgot-screen').classList.remove('show');
    document.getElementById('app').style.display = 'none';
    document.getElementById('reset-screen').classList.add('show');
  }
});
