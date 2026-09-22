const TABS = ['dashboard', 'comercial', 'financeiro', 'historico', 'metas', 'config'];
const RENDERERS = {
  dashboard: renderDashboard,
  comercial: renderComercial,
  financeiro: renderFinanceiro,
  historico: renderHistorico,
  metas: renderMetasInteligentes,
  config: renderConfig,
};

let tabAtual = 'dashboard';

function trocarTab(tab) {
  tabAtual = tab;
  TABS.forEach((t) => {
    document.getElementById('page-' + t).classList.toggle('active', t === tab);
    document.getElementById('tab-' + t).classList.toggle('active', t === tab);
  });
  RENDERERS[tab]();
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
  document.getElementById('app').style.display = 'block';
  trocarTab('dashboard');
}

db.auth.getSession().then(({ data: { session } }) => {
  if (session) mostrarApp();
});
