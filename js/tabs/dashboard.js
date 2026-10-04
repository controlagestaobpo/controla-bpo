// ===== Funções e helpers compartilhados entre Dashboard Comercial e Dashboard Financeiro =====

function fnBarChartOrdenado(canvas, itens, corBase, printMode) {
  const ordenado = [...itens].sort((a, b) => b.total - a.total);
  const corTexto = printMode ? '#5B6B82' : '#A9B8CF';
  const corLabel = printMode ? '#001438' : '#FFFFFF';
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ordenado.map((c) => c.nome),
      datasets: [{ data: ordenado.map((c) => c.total), backgroundColor: corBase, borderRadius: 4 }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: 46 } },
      plugins: {
        legend: { display: false },
        datalabels: { formatter: (v) => fmtMoeda(v), color: corLabel },
      },
      scales: {
        x: { display: false, beginAtZero: true, grid: { display: false } },
        y: { ticks: { font: { size: 10 }, color: corTexto }, grid: { display: false } },
      },
    },
  });
}

function fnBarChartOrdem(canvas, itens, cores, sufixo, printMode) {
  const corTexto = printMode ? '#5B6B82' : '#A9B8CF';
  const corLabel = printMode ? '#001438' : '#FFFFFF';
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: itens.map((c) => c.nome),
      datasets: [{ data: itens.map((c) => c.valor), backgroundColor: itens.every((c) => c.cor) ? itens.map((c) => c.cor) : cores, borderRadius: 4 }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: 40 } },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ctx.parsed.x + (sufixo || '') } },
        datalabels: { formatter: (v) => v + (sufixo || ''), color: corLabel },
      },
      scales: {
        x: { display: false, beginAtZero: true, grid: { display: false } },
        y: { ticks: { font: { size: 10 }, color: corTexto }, grid: { display: false } },
      },
    },
  });
}

function calcularFunil() {
  const todos = prospectsAtendidos();
  const nC = todos.filter((p) => p.status === 'conversa').length;
  const nP = todos.filter((p) => p.status === 'proposta').length;
  const nF = todos.filter((p) => p.status === 'fechado').length;
  return [
    { nome: 'Visitas totais', valor: todos.length, cor: '#6C8EF5' },
    { nome: 'Chegaram em conversa', valor: nC + nP + nF, cor: '#F5A623' },
    { nome: 'Propostas enviadas', valor: nP + nF, cor: '#9B7BF0' },
    { nome: 'Clientes fechados', valor: nF, cor: '#3DD68C' },
  ];
}

function calcularTopSegmentos() {
  const porNicho = {};
  prospectsAtendidos().forEach((p) => {
    if (!p.nicho) return;
    if (!porNicho[p.nicho]) porNicho[p.nicho] = { v: 0, f: 0 };
    porNicho[p.nicho].v += 1;
    if (p.status === 'fechado') porNicho[p.nicho].f += 1;
  });
  return Object.entries(porNicho)
    .map(([nome, d]) => ({ nome, valor: d.v > 0 ? Math.round(d.f / d.v * 100) : 0, v: d.v, f: d.f }))
    .sort((a, b) => b.valor - a.valor || b.f - a.f)
    .slice(0, 6);
}

function calcularCrescimento(nMeses) {
  const meses = [];
  for (let i = nMeses - 1; i >= 0; i--) meses.push(mesesAtras(i));
  return meses.map((m) => ({ mes: m, receita: montarDRE(m).receitaTotal }));
}
