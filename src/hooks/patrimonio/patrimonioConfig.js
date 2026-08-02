import { listarFotosArma } from '../../services/armasFotosService'

export const TIPOS_PATRIMONIO = {
  ARMAS: 'armas',
  MATERIAIS: 'materiais',
  MUNICOES: 'municoes',
  EQUIPAMENTOS: 'equipamentos',
  EPI: 'epi',
}

export const STATUS_PATRIMONIO = [
  'ATIVO',
  'RESERVA',
  'PAGO',
  'CAUTELADO',
  'RECOLHIDO',
  'APREENDIDO',
  'BAIXADO',
  'MANUTENCAO',
]

export const ESTADOS_CONSERVACAO = [
  'NOVO',
  'BOM',
  'REGULAR',
  'RUIM',
  'INSERVIVEL',
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
  observacoes: '',
}

export const armasConfig = {
  modulo: TIPOS_PATRIMONIO.ARMAS,
  tabela: 'sigmo_armas',
  titulo: 'Armas',
  subtitulo: 'Cadastro e controle patrimonial de armas.',
  nomeSingular: 'Arma',
  nomePlural: 'Armas',
  campoTitulo: 'patrimonio',

  fotos: {
    listar: listarFotosArma,
  },

  colunas: [
    { key: 'patrimonio', label: 'Patrimônio' },
    { key: 'numero_serie', label: 'Nº de série' },
    { key: 'especie', label: 'Espécie' },
    { key: 'marca', label: 'Marca' },
    { key: 'modelo', label: 'Modelo' },
    { key: 'status', label: 'Status' },
  ],

  campos: [
    {
      name: 'patrimonio',
      label: 'Patrimônio',
      type: 'text',
      required: true,
    },
    {
      name: 'numero_serie',
      label: 'Nº de série',
      type: 'text',
    },
    {
      name: 'especie',
      label: 'Espécie',
      type: 'text',
    },
    {
      name: 'marca',
      label: 'Marca',
      type: 'text',
    },
    {
      name: 'modelo',
      label: 'Modelo',
      type: 'text',
    },
    {
      name: 'calibre',
      label: 'Calibre',
      type: 'text',
    },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      required: true,
      options: [
  'ATIVO',
  'RESERVA',
  'PAGO',
  'CAUTELADO',
  'RECOLHIDO',
  'APREENDIDO',
  'BAIXADO',
  'MANUTENCAO',
],
    },
    {
      name: 'local_atual',
      label: 'Local atual',
      type: 'text',
    },
    {
      name: 'observacoes',
      label: 'Observações',
      type: 'textarea',
    },
  ],
}