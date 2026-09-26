function gerarInsightHistorico(churnRate, totalAllTime) {
  if (totalAllTime === 0) return 'Ainda não há clientes suficientes pra calcular o churn.';
  if (churnRate === 0) return 'Nenhum cancelamento registrado — ótima retenção.';
  if (churnRate <= 10) return `Seu churn de ${churnRate}% está baixo — continue assim.`;
  if (churnRate <= 25) return `Seu churn de ${churnRate}% é aceitável, mas dá pra melhorar — considere aumentar os pontos de contato com clientes ativos.`;
  return `Seu churn de ${churnRate}% está alto — vale investigar os motivos de cancelamento mais recorrentes abaixo.`;
}

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
        <div class="stat-card"><div class="stat-lbl">Ativos</div><div class="stat-val" style="color:var(--positivo)">${ativos.length}</div></div>
        <div class="stat-card"><div class="stat-lbl">Cancelados</div><div class="stat-val" style="color:var(--negativo)">${encerrados.length}</div></div>
        <div class="stat-card"><div class="stat-lbl">Churn rate</div><div class="stat-val">${churnRate}%</div></div>
      </div>
      <div class="panel" style="border-left:4px solid var(--amber);">
        <div style="font-size:12px;color:var(--text2);line-height:1.6;">${gerarInsightHistorico(churnRate, totalAllTime)}</div>
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
    <div class="ic-accent" style="background:var(--negativo);"></div>
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
