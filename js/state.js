const State = {
  prospects: [],
  clientesAtivos: [],
  receitas: [],
  despesas: [],
  produtos: [],
  categoriasDespesa: [],
  segmentos: [],
  metasFinanceiras: [],
  metas: { sm_clientes: 20, sm_fat: 20000, sm_prazo: '', mm_clientes: 5, mm_fat: 5000 },
  perfil: { nome_empresa: '' },
};

const CATEGORIAS_DESPESA_PADRAO = [
  { nome_principal: 'Impostos', subcategorias: [] },
  { nome_principal: 'Administrativas', subcategorias: [] },
  { nome_principal: 'Tarifas bancárias', subcategorias: [] },
  { nome_principal: 'Apps e Softwares', subcategorias: [] },
  { nome_principal: 'Alimentação', subcategorias: [] },
  { nome_principal: 'Transporte', subcategorias: ['Combustível', 'Pedágio', 'Uber/Táxi', 'Manutenção'] },
  { nome_principal: 'Marketing', subcategorias: [] },
  { nome_principal: 'Outros', subcategorias: [] },
];

const SEGMENTOS_PADRAO = [
  'Clínica odontológica', 'Clínica médica', 'Clínica estética', 'Comércio varejista',
  'Advocacia', 'Nutrição / Esporte', 'Construção / Reforma', 'Academia / Fitness',
  'Ar condicionado / Refrigeração', 'Beleza / Salão', 'Automotivo / Oficina',
  'Contabilidade', 'Agência de marketing', 'Coaching / Mentoria',
  'Escola / Curso livre', 'Alimentação / Restaurante',
];

const MOTIVOS_PERDA = [
  'Já tem solução', 'Sem verba no momento', 'Não consegui contato',
  'Não viu necessidade', 'Momento ruim para a empresa',
];

const MOTIVOS_CANCELAMENTO = [
  'Já tem solução', 'Sem verba', 'Sem contato', 'Sem necessidade', 'Momento ruim',
];

async function semearPadroes() {
  if (State.categoriasDespesa.length === 0) {
    await db.from('categorias_despesa').insert(
      CATEGORIAS_DESPESA_PADRAO.map((c) => ({ nome_principal: c.nome_principal, subcategorias: c.subcategorias }))
    );
  }
  if (State.segmentos.length === 0) {
    await db.from('segmentos').insert(SEGMENTOS_PADRAO.map((nome) => ({ nome })));
  }
}

async function carregarTudo() {
  const [
    prospects, clientesAtivos, receitas, despesas, produtos,
    categoriasDespesa, segmentos, metasFinanceiras, metasRow, configRow,
  ] = await Promise.all([
    db.from('prospects').select('*').order('data_visita', { ascending: false }),
    db.from('clientes_ativos').select('*').order('data_fechamento', { ascending: false }),
    db.from('receitas').select('*').order('data', { ascending: false }),
    db.from('despesas').select('*').order('data', { ascending: false }),
    db.from('produtos').select('*').order('nome'),
    db.from('categorias_despesa').select('*').order('nome_principal'),
    db.from('segmentos').select('*').order('nome'),
    db.from('metas_financeiras').select('*'),
    db.from('metas').select('*').order('updated_at', { ascending: false }).limit(1),
    db.from('configuracoes').select('*').eq('chave', 'perfil').limit(1),
  ]);

  State.prospects = prospects.data || [];
  State.clientesAtivos = clientesAtivos.data || [];
  State.receitas = receitas.data || [];
  State.despesas = despesas.data || [];
  State.produtos = produtos.data || [];
  State.categoriasDespesa = categoriasDespesa.data || [];
  State.segmentos = segmentos.data || [];
  State.metasFinanceiras = metasFinanceiras.data || [];

  if (metasRow.data && metasRow.data.length > 0) {
    const m = metasRow.data[0];
    State.metas = {
      id: m.id, sm_clientes: m.sm_clientes || 20, sm_fat: m.sm_fat || 20000,
      sm_prazo: m.sm_prazo || '', mm_clientes: m.mm_clientes || 5, mm_fat: m.mm_fat || 5000,
    };
  }

  if (configRow.data && configRow.data.length > 0) {
    State.perfil = { id: configRow.data[0].id, ...configRow.data[0].valor };
  }

  await semearPadroes();
  if (State.categoriasDespesa.length === 0) {
    const r = await db.from('categorias_despesa').select('*').order('nome_principal');
    State.categoriasDespesa = r.data || [];
  }
  if (State.segmentos.length === 0) {
    const r = await db.from('segmentos').select('*').order('nome');
    State.segmentos = r.data || [];
  }
}
