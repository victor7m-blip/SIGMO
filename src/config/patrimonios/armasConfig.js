const armasConfig = {
  modulo: 'armas',
  tabela: 'armas',
  titulo: 'Armas',
  subtitulo: 'Cadastro e controle patrimonial de armas.',
  nomeSingular: 'Arma',
  nomePlural: 'Armas',
  campoTitulo: 'patrimonio',

  colunas: [
    { key: 'patrimonio', label: 'Patrimônio' },
    { key: 'numero_serie', label: 'Nº de série' },
    { key: 'especie', label: 'Espécie' },
    { key: 'marca', label: 'Marca' },
    { key: 'modelo', label: 'Modelo' },
    { key: 'status', label: 'Status' }
  ],

  campos: [
    {
      name: 'patrimonio',
      label: 'Patrimônio',
      type: 'text',
      required: true
    },
    {
      name: 'numero_serie',
      label: 'Nº de série',
      type: 'text'
    },
    {
      name: 'especie',
      label: 'Espécie',
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
      name: 'calibre',
      label: 'Calibre',
      type: 'text'
    },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      required: true,
      options: [
        'DISPONÍVEL',
        'CAUTELADA',
        'MANUTENÇÃO',
        'BAIXADA'
      ]
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
  ]
}

export default armasConfig