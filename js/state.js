const State = {
  prospects: [],
  prospectAtendimentos: [], // histórico: cada contato/ação com um prospect
  clientesAtivos: [],
  receitas: [],
  despesas: [],
  produtos: [],
  categoriasDespesa: [],
  categoriasReceita: [],
  segmentos: [],
  metasFinanceiras: [],
  membrosEmpresa: [],
  metas: { sm_clientes: 20, sm_fat: 20000, sm_prazo: '', mm_clientes: 5, mm_fat: 5000 },
  perfil: { nome_empresa: '' },
  periodo: null, // 'YYYY-MM' selecionado no navegador de período (Dashboard/Financeiro)
};

const GRUPO_RECEITA_LABELS = {
  operacional: 'Receita operacional',
  nao_operacional: 'Outras receitas (não operacionais)',
};

const CATEGORIAS_RECEITA_PADRAO = [
  { nome_principal: 'Receita de Serviços', grupo_dre: 'operacional', subcategorias: [
    'BPO Financeiro', 'Consultoria Empresarial', 'Análise Financeira', 'Consultoria Gestão', 'Serviços Customizados',
  ] },
  { nome_principal: 'Receitas Complementares', grupo_dre: 'operacional', subcategorias: [
    'Reembolso de Despesas', 'Venda de Materiais', 'Serviço Extra/Ad-Hoc', 'Treinamentos/Workshops',
  ] },
  { nome_principal: 'Receitas Financeiras', grupo_dre: 'nao_operacional', subcategorias: [
    'Juros Ativos', 'Desconto Recebido', 'Rendimentos de Aplicações Financeiras', 'Devolução de Fornecedor',
  ] },
  { nome_principal: 'Outras Receitas', grupo_dre: 'nao_operacional', subcategorias: [
    'Venda de Ativos', 'Aluguel de Equipamentos', 'Diversos',
  ] },
];

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

// Plano de contas completo (grupo DRE -> categoria -> subcategorias).
const CATEGORIAS_DESPESA_PADRAO = [
  // ===== PESSOAL =====
  { nome_principal: 'Pró-Labore / Salários', grupo_dre: 'pessoal', subcategorias: [
    'Pró-Labore Sócio(s)', 'Salários Funcionários', 'Comissões', 'Bônus Desempenho', 'Retirada de Lucro',
  ] },
  { nome_principal: 'Encargos e Benefícios', grupo_dre: 'pessoal', subcategorias: [
    'INSS Patronal', 'FGTS', 'Plano de Saúde', 'Seguro de Vida',
  ] },

  // ===== ADMINISTRATIVAS =====
  { nome_principal: 'Infraestrutura', grupo_dre: 'administrativas', subcategorias: [
    'Aluguel Escritório', 'IPTU', 'Manutenção/Reforma Escritório', 'Decoração/Ambientação',
  ] },
  { nome_principal: 'Utilidades', grupo_dre: 'administrativas', subcategorias: [
    'Energia Elétrica', 'Água', 'Internet', 'Telefone Celular Corporativo',
  ] },
  { nome_principal: 'Limpeza e Manutenção', grupo_dre: 'administrativas', subcategorias: [
    'Limpeza Escritório', 'Manutenção Equipamentos', 'Toner/Tinta Impressora', 'Papel/Material de Escritório', 'Higiene e Limpeza',
  ] },
  { nome_principal: 'Alimentação', grupo_dre: 'administrativas', subcategorias: [
    'Café/Almoço/Janta', 'Refeição Reuniões', 'Lanches/Café Escritório',
  ] },
  { nome_principal: 'Vestuário', grupo_dre: 'administrativas', subcategorias: [
    'Uniforme', 'Vestuário Corporativo',
  ] },

  // ===== TECNOLOGIA =====
  { nome_principal: 'Software e Aplicações', grupo_dre: 'administrativas', subcategorias: [
    'Supabase (Backend)', 'IA / Claude (APIs)', 'Ferramentas Gestão (ERP, CRM)', 'Contabilidade (E-Ged, etc)',
    'Chat/Comunicação', 'Nuvem (Drive, OneDrive)', 'Analytics', 'Outros Softwares',
  ] },
  { nome_principal: 'Hardware e Equipamentos', grupo_dre: 'administrativas', subcategorias: [
    'Computador/Notebook', 'Monitor', 'Impressora', 'Telefone IP', 'Modem/Roteador', 'Webcam', 'Outros Periféricos',
  ] },
  { nome_principal: 'Suporte Técnico', grupo_dre: 'administrativas', subcategorias: [
    'Help Desk / Assistência Técnica', 'Backup e Armazenamento', 'Segurança (antivírus, firewall)', 'Manutenção IT',
  ] },

  // ===== TRANSPORTE =====
  { nome_principal: 'Combustível', grupo_dre: 'comerciais', subcategorias: ['Gasolina', 'Diesel', 'Etanol'] },
  { nome_principal: 'Manutenção Veículo', grupo_dre: 'comerciais', subcategorias: [
    'Óleo e Filtro', 'Revisão Preventiva', 'Pneus', 'Bateria', 'Conserto/Reparo', 'Peças',
  ] },
  { nome_principal: 'Deslocamento/Mobilidade', grupo_dre: 'comerciais', subcategorias: [
    'Uber/Táxi', 'Passagem Aérea', 'Hospedagem', 'Pedágio', 'Estacionamento',
  ] },
  { nome_principal: 'Documentação Veículo', grupo_dre: 'comerciais', subcategorias: [
    'IPVA', 'Seguro Veículo', 'Licenciamento', 'Multa de Trânsito',
  ] },

  // ===== MARKETING =====
  { nome_principal: 'Marketing Digital', grupo_dre: 'comerciais', subcategorias: [
    'Google Ads', 'Facebook/Instagram Ads', 'Criação de Conteúdo', 'Domínio Website', 'Hospedagem Website',
    'Desenvolvimento Website', 'Email Marketing', 'Ferramentas Social Media',
  ] },
  { nome_principal: 'Marketing Tradicional', grupo_dre: 'comerciais', subcategorias: [
    'Cartão de Visita', 'Papel Timbrado', 'Impressão Panfleto', 'Outdoor / Mídia Externa', 'Publicidade Geral',
  ] },
  { nome_principal: 'Relacionamento e Eventos', grupo_dre: 'comerciais', subcategorias: [
    'Patrocínio Eventos', 'Evento Próprio', 'Brindes/Presentes Clientes', 'Almoço Relacionamento', 'Viagem Relacionamento',
  ] },

  // ===== FINANCEIRAS =====
  { nome_principal: 'Tarifas Bancárias', grupo_dre: 'financeiras', subcategorias: [
    'Tarifa Mensal Conta', 'Tarifa Transferência', 'Tarifa Boleto', 'Cheque', 'Extrato', 'Tarifa PIX', 'Outras Tarifas Banco',
  ] },
  { nome_principal: 'Juros e Encargos', grupo_dre: 'financeiras', subcategorias: [
    'Juros Pessoa Jurídica', 'Juros Financiamento', 'Juros Empréstimo', 'Multa Pagamento Atrasado', 'Juros de Mora',
  ] },
  { nome_principal: 'Câmbio e Conversão', grupo_dre: 'financeiras', subcategorias: [
    'Taxa Câmbio', 'Transferência Internacional', 'Conversão Moeda',
  ] },

  // ===== TRIBUTÁRIAS (dedução) =====
  { nome_principal: 'Impostos Federais', grupo_dre: 'deducao', subcategorias: [
    'DAS (Simples Nacional)', 'IRPJ', 'CSLL', 'PIS/PASEP', 'COFINS', 'INSS Empresa', 'ISS Estimado',
  ] },
  { nome_principal: 'Impostos Estaduais', grupo_dre: 'deducao', subcategorias: [
    'ICMS', 'ITBI', 'Outras Taxas Estaduais',
  ] },
  { nome_principal: 'Impostos Municipais', grupo_dre: 'deducao', subcategorias: [
    'ISS', 'IPTU', 'Alvará', 'Licença Municipal',
  ] },

  // ===== PROFISSIONAIS =====
  { nome_principal: 'Consultoria e Serviços', grupo_dre: 'administrativas', subcategorias: [
    'Advogado / Assessoria Jurídica', 'Consultor de Negócios', 'Consultor Financeiro', 'Designer', 'Redator', 'Freelancer / Pessoa Física',
  ] },
  { nome_principal: 'Terceirização', grupo_dre: 'administrativas', subcategorias: [
    'Serviço de Limpeza', 'Segurança', 'Manutenção Predial', 'Serviços Diversos',
  ] },

  // ===== GERAIS =====
  { nome_principal: 'Seguros', grupo_dre: 'administrativas', subcategorias: [
    'Seguro Responsabilidade Civil', 'Seguro Profissional', 'Seguro Patrimônio', 'Seguro Veículo', 'Outros Seguros',
  ] },
  { nome_principal: 'Assinaturas e Filiações', grupo_dre: 'administrativas', subcategorias: [
    'Assinatura Revistas/Publicações', 'Associação Classe', 'Filiação Sindicato', 'Membros de Plataformas',
  ] },
  { nome_principal: 'Diversas', grupo_dre: 'administrativas', subcategorias: [
    'Presente Funcionário', 'Licença/Permissão', 'Multa/Processo Judicial', 'Doação/Caridade', 'Outros Diversos',
  ] },
];

const SEGMENTOS_PADRAO = [
  'Clínica odontológica', 'Clínica médica', 'Clínica estética', 'Comércio varejista',
  'Loja de Roupas', 'Advocacia', 'Nutrição / Esporte', 'Construção / Reforma', 'Academia / Fitness',
  'Empresa de Serviços', 'Beleza / Salão', 'Automotivo / Oficina',
  'Contabilidade', 'Agência de marketing', 'Coaching / Mentoria',
  'Escola / Curso livre', 'Alimentação / Restaurante',
];

const MOTIVOS_PERDA = [
  'Já tem solução', 'Sem verba no momento', 'Não consegui contato',
  'Não viu necessidade', 'Momento ruim para a empresa', 'Marcou reunião e não apareceu',
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
  if (State.categoriasReceita.length === 0) {
    await db.from('categorias_receita').insert(
      CATEGORIAS_RECEITA_PADRAO.map((c) => ({ nome_principal: c.nome_principal, subcategorias: c.subcategorias, grupo_dre: c.grupo_dre }))
    );
  }
  if (State.segmentos.length === 0) {
    await db.from('segmentos').insert(SEGMENTOS_PADRAO.map((nome) => ({ nome })));
  }
}

async function carregarTudo() {
  const [
    prospects, prospectAtendimentos, clientesAtivos, receitas, despesas, produtos,
    categoriasDespesa, categoriasReceita, segmentos, metasFinanceiras, membrosEmpresa, metasRow, configRow,
  ] = await Promise.all([
    db.from('prospects').select('*').order('data_visita', { ascending: false }),
    db.from('prospect_atendimentos').select('*').order('data', { ascending: false }).order('created_at', { ascending: false }),
    db.from('clientes_ativos').select('*').order('data_fechamento', { ascending: false }),
    db.from('receitas').select('*').order('data', { ascending: false }),
    db.from('despesas').select('*').order('data', { ascending: false }),
    db.from('produtos').select('*').order('nome'),
    db.from('categorias_despesa').select('*').order('nome_principal'),
    db.from('categorias_receita').select('*').order('nome_principal'),
    db.from('segmentos').select('*').order('nome'),
    db.from('metas_financeiras').select('*'),
    db.from('membros_empresa').select('*').order('created_at'),
    db.from('metas').select('*').order('updated_at', { ascending: false }).limit(1),
    db.from('configuracoes').select('*').eq('chave', 'perfil').limit(1),
  ]);

  State.prospects = prospects.data || [];
  State.prospectAtendimentos = prospectAtendimentos.data || [];
  State.clientesAtivos = clientesAtivos.data || [];
  State.receitas = receitas.data || [];
  State.despesas = despesas.data || [];
  State.produtos = produtos.data || [];
  State.categoriasDespesa = categoriasDespesa.data || [];
  State.categoriasReceita = categoriasReceita.data || [];
  State.segmentos = segmentos.data || [];
  State.metasFinanceiras = metasFinanceiras.data || [];
  State.membrosEmpresa = membrosEmpresa.data || [];

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
  if (State.categoriasReceita.length === 0) {
    const r = await db.from('categorias_receita').select('*').order('nome_principal');
    State.categoriasReceita = r.data || [];
  }
  if (State.segmentos.length === 0) {
    const r = await db.from('segmentos').select('*').order('nome');
    State.segmentos = r.data || [];
  }
}
