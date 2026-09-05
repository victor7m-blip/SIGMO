export const CALIBRES_MUNICAO = [
  // Armas curtas / uso comum
  { value: '.22 LR', label: '.22 LR', grupo: 'Armas curtas / uso comum' },
  { value: '.22 WMR', label: '.22 WMR', grupo: 'Armas curtas / uso comum' },
  { value: '.25 ACP', label: '.25 ACP (6,35 mm)', grupo: 'Armas curtas / uso comum' },
  { value: '.32 ACP', label: '.32 ACP (7,65 mm)', grupo: 'Armas curtas / uso comum' },
  { value: '.32 S&W', label: '.32 S&W', grupo: 'Armas curtas / uso comum' },
  { value: '.32 S&W LONG', label: '.32 S&W Long', grupo: 'Armas curtas / uso comum' },
  { value: '.380 ACP', label: '.380 ACP', grupo: 'Armas curtas / uso comum' },
  { value: '9MM LUGER', label: '9 mm Luger / 9x19 mm', grupo: 'Armas curtas / uso comum' },
  { value: '9MM MAKAROV', label: '9 mm Makarov / 9x18 mm', grupo: 'Armas curtas / uso comum' },
  { value: '.38 SPECIAL', label: '.38 Special', grupo: 'Armas curtas / uso comum' },
  { value: '.357 SIG', label: '.357 SIG', grupo: 'Armas curtas / uso comum' },
  { value: '.357 MAGNUM', label: '.357 Magnum', grupo: 'Armas curtas / uso comum' },
  { value: '.40 S&W', label: '.40 S&W', grupo: 'Armas curtas / uso comum' },
  { value: '10MM AUTO', label: '10 mm Auto', grupo: 'Armas curtas / uso comum' },
  { value: '.41 MAGNUM', label: '.41 Magnum', grupo: 'Armas curtas / uso comum' },
  { value: '.44 SPECIAL', label: '.44 Special', grupo: 'Armas curtas / uso comum' },
  { value: '.44 MAGNUM', label: '.44 Magnum', grupo: 'Armas curtas / uso comum' },
  { value: '.45 ACP', label: '.45 ACP', grupo: 'Armas curtas / uso comum' },
  { value: '.45 COLT', label: '.45 Colt', grupo: 'Armas curtas / uso comum' },
  { value: '.50 AE', label: '.50 AE', grupo: 'Armas curtas / uso comum' },
  { value: '5.7X28MM', label: '5,7x28 mm', grupo: 'Armas curtas / uso comum' },
  { value: '4.6X30MM', label: '4,6x30 mm', grupo: 'Armas curtas / uso comum' },

  // Carabinas / fuzis
  { value: '.17 HMR', label: '.17 HMR', grupo: 'Carabinas / fuzis' },
  { value: '.22 HORNET', label: '.22 Hornet', grupo: 'Carabinas / fuzis' },
  { value: '.223 REMINGTON', label: '.223 Remington', grupo: 'Carabinas / fuzis' },
  { value: '5.56X45MM NATO', label: '5,56x45 mm NATO', grupo: 'Carabinas / fuzis' },
  { value: '.243 WINCHESTER', label: '.243 Winchester', grupo: 'Carabinas / fuzis' },
  { value: '6MM CREEDMOOR', label: '6 mm Creedmoor', grupo: 'Carabinas / fuzis' },
  { value: '6.5 CREEDMOOR', label: '6,5 Creedmoor', grupo: 'Carabinas / fuzis' },
  { value: '6.5X55MM', label: '6,5x55 mm', grupo: 'Carabinas / fuzis' },
  { value: '.270 WINCHESTER', label: '.270 Winchester', grupo: 'Carabinas / fuzis' },
  { value: '7X57MM MAUSER', label: '7x57 mm Mauser', grupo: 'Carabinas / fuzis' },
  { value: '7MM-08 REMINGTON', label: '7mm-08 Remington', grupo: 'Carabinas / fuzis' },
  { value: '7MM REMINGTON MAGNUM', label: '7 mm Remington Magnum', grupo: 'Carabinas / fuzis' },
  { value: '.30 CARBINE', label: '.30 Carbine', grupo: 'Carabinas / fuzis' },
  { value: '.30-30 WINCHESTER', label: '.30-30 Winchester', grupo: 'Carabinas / fuzis' },
  { value: '.300 BLACKOUT', label: '.300 Blackout / 7,62x35 mm', grupo: 'Carabinas / fuzis' },
  { value: '7.62X39MM', label: '7,62x39 mm', grupo: 'Carabinas / fuzis' },
  { value: '.308 WINCHESTER', label: '.308 Winchester', grupo: 'Carabinas / fuzis' },
  { value: '7.62X51MM NATO', label: '7,62x51 mm NATO', grupo: 'Carabinas / fuzis' },
  { value: '.30-06 SPRINGFIELD', label: '.30-06 Springfield', grupo: 'Carabinas / fuzis' },
  { value: '.300 WINCHESTER MAGNUM', label: '.300 Winchester Magnum', grupo: 'Carabinas / fuzis' },
  { value: '.338 LAPUA MAGNUM', label: '.338 Lapua Magnum', grupo: 'Carabinas / fuzis' },
  { value: '.50 BMG', label: '.50 BMG / 12,7x99 mm', grupo: 'Carabinas / fuzis' },

  // Espingardas
  { value: '.410 BORE', label: '.410 Bore', grupo: 'Espingardas' },
  { value: 'CALIBRE 28', label: 'Calibre 28', grupo: 'Espingardas' },
  { value: 'CALIBRE 24', label: 'Calibre 24', grupo: 'Espingardas' },
  { value: 'CALIBRE 20', label: 'Calibre 20', grupo: 'Espingardas' },
  { value: 'CALIBRE 16', label: 'Calibre 16', grupo: 'Espingardas' },
  { value: 'CALIBRE 12', label: 'Calibre 12', grupo: 'Espingardas' },
  { value: 'CALIBRE 10', label: 'Calibre 10', grupo: 'Espingardas' }
]

export const STATUS_MUNICAO = [
  {
    value: 'RESERVA',
    label: 'Reserva'
  },
  {
    value: 'EM_SERVICO',
    label: 'Em serviço'
  },
  {
    value: 'RECOLHIDO',
    label: 'Recolhido'
  },
  {
    value: 'BAIXADO',
    label: 'Baixado'
  }
]

export const MUNICAO_FORM_INICIAL = {
  calibre: '',
  descricao: '',
  unidade: '27º BPM/M - 5ª CIA',
  status_operacional: 'RESERVA',
  observacoes: '',
  ativo: true
}

export const MUNICAO_LOTE_FORM_INICIAL = {
  numero_lote: '',
  fabricante: '',
  tipo_municao: '',

  quantidade_inicial: 0,
  quantidade_p4: 0,
  quantidade_svdd: 0,

  data_fabricacao: '',
  validade: '',
  data_entrega: '',

  alerta_validade_ativo: false,
  alerta_validade_dias_antes: '',

  documento_entrada: '',
  observacoes: '',
  ativo: true
}

export const ALERTAS_VALIDADE_DIAS_PADRAO = [
  {
    value: 15,
    label: '15 dias antes'
  },
  {
    value: 30,
    label: '30 dias antes'
  },
  {
    value: 60,
    label: '60 dias antes'
  },
  {
    value: 90,
    label: '90 dias antes'
  },
  {
    value: 120,
    label: '120 dias antes'
  },
  {
    value: 180,
    label: '180 dias antes'
  },
  {
    value: 365,
    label: '1 ano antes'
  }
]

export const TIPOS_MOVIMENTACAO_MUNICAO = [
  {
    value: 'CARGA_INICIAL',
    label: 'Carga inicial'
  },
  {
    value: 'ENTRADA',
    label: 'Entrada'
  },
  {
    value: 'TRANSFERENCIA_P4_SVDD',
    label: 'Transferência P4 → SVDD'
  },
  {
    value: 'TRANSFERENCIA_SVDD_P4',
    label: 'Transferência SVDD → P4'
  },
  {
    value: 'CAUTELA',
    label: 'Cautela'
  },
  {
    value: 'DEVOLUCAO',
    label: 'Devolução'
  },
  {
    value: 'CONSUMO',
    label: 'Consumo'
  },
  {
    value: 'AJUSTE',
    label: 'Ajuste de estoque'
  },
  {
    value: 'BAIXA',
    label: 'Baixa'
  }
]
