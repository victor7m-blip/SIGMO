import {
  listarFotosMaterial,
  uploadFotoMaterial,
  excluirFotoMaterial,
  definirFotoPrincipalMaterial,
  baixarFotoMaterial
} from '../../services/materiaisFotosService'

const materiaisConfig = {
  modulo: 'materiais',
  tipoPatrimonio: 'material',
  tabela: 'sigmo_materiais',

  titulo: 'Materiais',
  subtitulo:
    'Cadastro e controle patrimonial de materiais permanentes e cauteláveis.',

  nomeSingular: 'Material',
  nomePlural: 'Materiais',

  campoTitulo: 'patrimonio',
  campoSubtitulo: 'descricao',

  colunas: [
    {
      key: 'patrimonio',
      label: 'Patrimônio'
    },
    {
      key: 'descricao',
      label: 'Descrição'
    },
    {
      key: 'categoria',
      label: 'Categoria'
    },
    {
      key: 'marca',
      label: 'Marca'
    },
    {
      key: 'modelo',
      label: 'Modelo'
    },
    {
      key: 'status',
      label: 'Status'
    },
    {
      key: 'local_atual',
      label: 'Local atual'
    }
  ],

  campos: [
    {
      name: 'patrimonio',
      label: 'Patrimônio',
      type: 'text',
      required: true
    },
    {
      name: 'descricao',
      label: 'Descrição',
      type: 'text',
      required: true
    },
    {
      name: 'categoria',
      label: 'Categoria',
      type: 'text'
    },
    {
      name: 'marca',
      label: 'Marca',
      type: 'text'
    },
    {
      name: 'modelo',
      label: 'Modelo',
      type: 'text'
    },
    {
      name: 'numero_serie',
      label: 'Nº de série',
      type: 'text'
    },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      required: true,
      defaultValue: 'ATIVO',
      options: [
        'ATIVO',
        'CAUTELADO',
        'MANUTENÇÃO',
        'BAIXADO',
        'EXTRAVIADO'
      ]
    },
    {
      name: 'unidade',
      label: 'Unidade',
      type: 'text'
    },
    {
      name: 'local_atual',
      label: 'Local atual',
      type: 'text'
    },
    {
      name: 'observacoes',
      label: 'Observações',
      type: 'textarea'
    }
  ],

  fotos: {
    listar: listarFotosMaterial,

    upload: uploadFotoMaterial,

    excluir: excluirFotoMaterial,

    definirPrincipal: definirFotoPrincipalMaterial,

    baixar: baixarFotoMaterial
  }
}

export default materiaisConfig