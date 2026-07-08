export const TIPOS_PATRIMONIO = {
  ARMAS: 'armas',
  MATERIAIS: 'materiais',
  MUNICOES: 'municoes',
  EQUIPAMENTOS: 'equipamentos',
  EPI: 'epi'
}

export const STATUS_PATRIMONIO = [
  'ATIVO',
  'RESERVA',
  'PAGO',
  'CAUTELADO',
  'RECOLHIDO',
  'APREENDIDO',
  'BAIXADO',
  'MANUTENCAO'
]

export const ESTADOS_CONSERVACAO = [
  'NOVO',
  'BOM',
  'REGULAR',
  'RUIM',
  'INSERVIVEL'
]

export const patrimonioBaseFields = {
  patrimonio: '',
  descricao: '',
  marca: '',
  modelo: '',
  numero_serie: '',
  quantidade: 1,
  status: 'ATIVO',
  estado_conservacao: 'BOM',
  local_id: '',
  observacoes: ''
}