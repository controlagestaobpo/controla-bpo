function renderHistorico() {
  const encerrados = State.clientesAtivos.filter((c) => c.status === 'encerrado');
  const ativos = State.clientesAtivos.filter((c) => c.status === 'ativo');
  const totalAllTime = State.clientesAtivos.length;
  const churnRate = totalAllTime > 0 ? Math.round(encerrados.length / totalAllTime * 100) : 0;

  const el = document.getElementById('page-historico');
  el.innerHTML = `
    <div class="section">
      <div class="section-title">Análise de churn</div>
      <div class="card-grid-2" style="margin-bottom:14px;">
        <div class="stat-card"><div class="stat-lbl">Total de clientes</div><div class="stat-val">${totalAllTime}</div><div class="stat-sub">all-time</div></div>
        <div class="stat-card"><div class="stat-lbl">Ativos</div><div class="stat-val" style="color:var(--green2)">${ativos.length}</div></div>
        <div class="stat-card"><div class="stat-lbl">Cancelados</div><div class="stat-val" style="color:var(--red)">${encerrados.length}</div></div>
        <div class="stat-card"><div class="stat-lbl">Churn rate</div><div class="stat-val">${churnRate}%</div></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Contratos encerrados</div>
      <div class="simple-list" id="hi-encerrados-list"></div>
    </div>
  `;

  const listEl = document.getElementById('hi-encerrados-list');
  if (!encerrados.length) {
    listEl.innerHTML = '<div class="empty-state">Nenhum contrato encerrado ainda.</div>';
    return;
  }
  const ordenados = [...encerrados].sort((a, b) => (b.data_encerramento || '').localeCompare(a.data_encerramento || ''));
  listEl.innerHTML = ordenados.map((c) => `<div class="item-card"><div class="ic-inner">
    <div class="ic-accent" style="background:var(--red);"></div>
    <div class="ic-body">
      <div class="ic-top"><div class="ic-nome">${c.empresa}</div><span class="badge badge-red">${fmtD(c.data_encerramento)}</span></div>
      <div class="ic-badges">
        <span class="badge badge-gray">${c.motivo_cancelamento || 'motivo não informado'}</span>
        <span class="badge badge-gray">cancelado por ${c.quem_cancelou === 'empresa' ? 'nós' : 'cliente'}</span>
      </div>
      ${c.obs ? `<div class="ic-obs">${c.obs}</div>` : ''}
    </div>
  </div></div>`).join('');
}
