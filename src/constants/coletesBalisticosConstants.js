export const COLETE_BALISTICO_FABRICANTE_PADRAO =
  'PROTECOP'

export const COLETE_BALISTICO_NIVEL_PADRAO =
  'III-A'

export const COLETE_BALISTICO_ALERTA_VALIDADE_MESES =
  3

// Compatibilidade temporária com o service atual.
// Será removida quando a regra passar a usar meses por colete.
export const COLETE_BALISTICO_ALERTA_VALIDADE_DIAS =
  90

export const COLETE_BALISTICO_SEXOS = [
  {
    value: 'MASCULINO',
    label: 'MASCULINO'
  },
  {
    value: 'FEMININO',
    label: 'FEMININO'
  },
  {
    value: 'UNISSEX',
    label: 'UNISSEX'
  }
]

export const COLETE_BALISTICO_TAMANHOS = [
  'EXP',
  'PP',
  'P',
  'M',
  'G',
  'GG',
  'EXG'
]

export const COLETE_BALISTICO_MODELAGENS = [
  {
    value: 'ESTREITO',
    label: 'ESTREITO'
  },
  {
    value: 'PADRAO',
    label: 'PADRÃO'
  },
  {
    value: 'LARGO',
    label: 'LARGO'
  }
]

export const COLETE_BALISTICO_STATUS = [
  'RESERVA',
  'AGUARDANDO_RECEBIMENTO',
  'CARGA_INDIVIDUAL',
  'MANUTENCAO',
  'TRANSFERIDO',
  'BAIXADO'
]

export const COLETE_BALISTICO_FORM_INICIAL = {
  patrimonio: '',
  numero_serie: '',
  numero_lote: '',
  fabricante:
    COLETE_BALISTICO_FABRICANTE_PADRAO,
  modelo: '',
  nivel_protecao:
    COLETE_BALISTICO_NIVEL_PADRAO,
  sexo: '',
  tamanho: '',
  modelagem: 'PADRAO',
  data_fabricacao: '',
  validade: '',
  alerta_validade_meses:
    COLETE_BALISTICO_ALERTA_VALIDADE_MESES,
  data_entrada_carga: '',
  contrato_fornecimento: '',
  observacoes: '',
  foto_url: ''
}
