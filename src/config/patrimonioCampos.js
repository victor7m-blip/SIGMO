export const camposBasePatrimonio = [
  {
    name: 'patrimonio',
    label: 'Patrimônio',
    required: true
  },
  {
     name: 'numero_lote',
  label: 'Nº do lote'
  },
  {
    name: 'tipo',
    label: 'Tipo'
  },
  {
    name: 'marca',
    label: 'Marca'
  },
  {
    name: 'modelo',
    label: 'Modelo'
  },
  {
    name: 'calibre',
    label: 'Calibre'
  },
  {
    name: 'estado',
    label: 'Estado',
    type: 'select',
    options: ['NOVO', 'BOM', 'REGULAR', 'RUIM', 'BAIXADO']
  },
  {
    name: 'situacao',
    label: 'Situação',
    type: 'select',
    options: ['RESERVA', 'PAGO', 'CAUTELADO', 'RECOLHIDO', 'APREENDIDO', 'BAIXADO']
  },
  {
    name: 'local',
    label: 'Local'
  },
  {
    name: 'observacoes',
    label: 'Observações',
    type: 'textarea'
  }
]