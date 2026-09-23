const State = {
  prospects: [],
  clientesAtivos: [],
  receitas: [],
  despesas: [],
  retiradas: [],
  produtos: [],
  categoriasDespesa: [],
  segmentos: [],
  metasFinanceiras: [],
  metas: { sm_clientes: 20, sm_fat: 20000, sm_prazo: '', mm_clientes: 5, mm_fat: 5000 },
  perfil: { nome_empresa: '' },
};

// Grupos do DRE enxuto: deducao (sai da receita antes da receita liquida),
// depois as 4 famílias de despesa operacional.
const GRUPO_DRE_LABELS = {
  deducao: 'Dedução (impostos sobre serviço)',
  administrativas: 'Despesas administrativas',
  comerciais: 'Despesas comerciais',
  pessoal: 'Despesas com pessoal',
  financeiras: 'Despesas financeiras',
};
const GRUPO_DRE_ORDEM = ['administrativas', 'comerciais', 'pessoal', 'financeiras'];

const CATEGORIAS_DESPESA_PADRAO = [
  { nome_principal: 'Impostos', subcategorias: [], grupo_dre: 'deducao' },
  { nome_principal: 'Administrativas', subcategorias: [], grupo_dre: 'administrativas' },
  { nome_principal: 'Apps e Softwares', subcategorias: [], grupo_dre: 'administrativas' },
  { nome_principal: 'Alimentação', subcategorias: [], grupo_dre: 'administrativas' },
  { nome_principal: 'Outros', subcategorias: [], grupo_dre: 'administrativas' },
  { nome_principal: 'Transporte', subcategorias: ['Combustível', 'Pedágio', 'Uber/Táxi', 'Manutenção'], grupo_dre: 'comerciais' },
  { nome_principal: 'Marketing', subcategorias: [], grupo_dre: 'comerciais' },
  { nome_principal: 'Pessoal', subcategorias: ['Salários', 'Pró-labore', 'Encargos/INSS', 'Benefícios'], grupo_dre: 'pessoal' },
  { nome_principal: 'Tarifas bancárias', subcategorias: [], grupo_dre: 'financeiras' },
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
      CATEGORIAS_DESPESA_PADRAO.map((c) => ({ nome_principal: c.nome_principal, subcategorias: c.subcategorias, grupo_dre: c.grupo_dre }))
    );
  }
  if (State.segmentos.length === 0) {
    await db.from('segmentos').insert(SEGMENTOS_PADRAO.map((nome) => ({ nome })));
  }
}

async function carregarTudo() {
  const [
    prospects, clientesAtivos, receitas, despesas, retiradas, produtos,
    categoriasDespesa, segmentos, metasFinanceiras, metasRow, configRow,
  ] = await Promise.all([
    db.from('prospects').select('*').order('data_visita', { ascending: false }),
    db.from('clientes_ativos').select('*').order('data_fechamento', { ascending: false }),
    db.from('receitas').select('*').order('data', { ascending: false }),
    db.from('despesas').select('*').order('data', { ascending: false }),
    db.from('retiradas').select('*').order('data', { ascending: false }),
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
  State.retiradas = retiradas.data || [];
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
