export const TIPOS_TONFA = [
  {
    value: 'TONFA',
    label: 'Tonfa'
  },
  {
    value: 'CASSETETE',
    label: 'Cassetete'
  }
]

export const STATUS_TONFA = [
  {
    value: 'RESERVA',
    label: 'Reserva'
  },
  {
    value: 'CARGA',
    label: 'Carga'
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

export const TONFA_FORM_INICIAL = {
  tipo: 'TONFA',
  quantidade: 0,
  unidade: '27º BPM/M - 5ª CIA',
  status_operacional: 'RESERVA',
  local_atual: 'Carga da Companhia',
  observacoes: '',
  qr_code: '',
  foto_url: '',
  ativo: true
}