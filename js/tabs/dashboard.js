function renderDashboard() {
  const clientesAtivos = State.clientesAtivos.filter((c) => c.status === 'ativo');
  const pipeline = prospectsPipeline ? prospectsPipeline() : State.prospects.filter((p) => p.status !== 'fechado' && p.status !== 'descartado');
  const totalFechadosAllTime = State.clientesAtivos.length;
  const totalContatos = pipeline.length + totalFechadosAllTime;
  const taxaConversao = totalContatos > 0 ? Math.round(totalFechadosAllTime / totalContatos * 100) : 0;
  const valorFunil = pipeline.reduce((s, p) => s + (p.ticket || 0), 0);

  const mes = mesAtual();
  const receitaMes = receitasDoMes ? receitasDoMes(mes).reduce((s, r) => s + Number(r.valor || 0), 0) : 0;
  const despesaMes = despesasDoMes ? despesasDoMes(mes).reduce((s, d) => s + Number(d.valor || 0), 0) : 0;
  const lucroMes = receitaMes - despesaMes;
  const margemMes = receitaMes > 0 ? Math.round(lucroMes / receitaMes * 100) : 0;
  const projecaoAno = Math.round(receitaMes * 12);

  const h = hj();
  const acoes = [];
  State.prospects.forEach((p) => {
    if (p.deadline && p.deadline <= h && p.status !== 'fechado' && p.status !== 'descartado') {
      const atrasado = p.deadline < h;
      acoes.push({ texto: `${p.empresa} — ${p.proximo || 'próximo passo'}`, tag: atrasado ? `atrasado ${fmtD(p.deadline)}` : 'hoje' });
    }
  });

  const el = document.getElementById('page-dashboard');
  el.innerHTML = `
    <div class="section">
      <div class="section-title">Resumo comercial</div>
      <div class="card-grid-2" style="margin-bottom:14px;">
        <div class="stat-card"><div class="stat-lbl">Clientes ativos</div><div class="stat-val" style="color:var(--green2)">${clientesAtivos.length}</div><div class="stat-sub">meta: ${State.metas.sm_clientes}</div></div>
        <div class="stat-card"><div class="stat-lbl">Prospects</div><div class="stat-val" style="color:var(--blue)">${pipeline.length}</div><div class="stat-sub">em funil</div></div>
        <div class="stat-card"><div class="stat-lbl">Taxa conversão</div><div class="stat-val">${taxaConversao}%</div></div>
        <div class="stat-card"><div class="stat-lbl">Valor em funil</div><div class="stat-val">${fmtMoeda(valorFunil)}</div></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Resumo financeiro · ${nomeMesLongo(mes)}</div>
      <div class="card-grid-2" style="margin-bottom:14px;">
        <div class="stat-card"><div class="stat-lbl">Receita</div><div class="stat-val" style="color:var(--green2)">${fmtMoeda(receitaMes)}</div><div class="stat-sub">meta: ${fmtMoeda(State.metas.mm_fat)}</div></div>
        <div class="stat-card"><div class="stat-lbl">Despesas</div><div class="stat-val" style="color:var(--red)">${fmtMoeda(despesaMes)}</div></div>
        <div class="stat-card"><div class="stat-lbl">Lucro líquido</div><div class="stat-val">${fmtMoeda(lucroMes)}</div><div class="stat-sub">margem ${margemMes}%</div></div>
        <div class="stat-card"><div class="stat-lbl">Projeção (ano)</div><div class="stat-val">${fmtMoeda(projecaoAno)}</div><div class="stat-sub">no ritmo atual</div></div>
      </div>
    </div>

    ${acoes.length ? `
    <div class="section">
      <div class="section-title" style="color:var(--red);">Ações imediatas</div>
      <div class="panel" style="border-left:4px solid var(--red);">
        ${acoes.map((a) => `<div style="display:flex;justify-content:space-between;gap:8px;padding:5px 0;font-size:12px;"><span>${a.texto}</span><span class="badge badge-red">${a.tag}</span></div>`).join('')}
      </div>
    </div>` : ''}

    <div class="placeholder-box">
      <strong>Gráficos chegam na Fase 3</strong>
      Funil de conversão, top segmentos e crescimento dos últimos meses.
    </div>
  `;
}
