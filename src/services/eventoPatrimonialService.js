import { supabase } from './supabaseClient'
import {
  registerPatrimonialAudit
} from './auditoriaService'

export const TIPOS_EVENTO_PATRIMONIAL = Object.freeze({
  CADASTRO: 'CADASTRO',
  EDICAO: 'EDIÇÃO',
  STATUS: 'STATUS',
  LOCAL: 'LOCAL',
  FOTO_ADICIONADA: 'FOTO_ADICIONADA',
  FOTO_REMOVIDA: 'FOTO_REMOVIDA',
  FOTO_PRINCIPAL: 'FOTO_PRINCIPAL',
  FOTO_BAIXADA: 'FOTO_BAIXADA',
  QRCODE_GERADO: 'QRCODE_GERADO',
  ETIQUETA_IMPRESSA: 'ETIQUETA_IMPRESSA',
  MOVIMENTACAO: 'MOVIMENTAÇÃO',
  CAUTELA: 'CAUTELA',
  DEVOLUCAO: 'DEVOLUÇÃO',
  TRANSFERENCIA: 'TRANSFERÊNCIA',
  BAIXA: 'BAIXA',
  EXCLUSAO: 'EXCLUSÃO'
})

export function obterNomeUsuario(user) {
  return (
    user?.nome ||
    user?.nome_guerra ||
    user?.nome_completo ||
    user?.name ||
    user?.email ||
    'SIGMO'
  )
}

function normalizarTipoEvento(tipo) {
  return String(
    tipo || TIPOS_EVENTO_PATRIMONIAL.MOVIMENTACAO
  )
    .trim()
    .toUpperCase()
}

function criarDescricaoPadrao({
  tipo,
  usuario
}) {
  const nomeUsuario = obterNomeUsuario(usuario)

  const descricoes = {
    CADASTRO:
      `${nomeUsuario} cadastrou o patrimônio.`,

    'EDIÇÃO':
      `${nomeUsuario} atualizou o patrimônio.`,

    STATUS:
      `${nomeUsuario} alterou o status.`,

    LOCAL:
      `${nomeUsuario} alterou o local.`,

    FOTO_ADICIONADA:
      `${nomeUsuario} adicionou uma foto.`,

    FOTO_REMOVIDA:
      `${nomeUsuario} removeu uma foto.`,

    FOTO_PRINCIPAL:
      `${nomeUsuario} definiu a foto principal.`,

    FOTO_BAIXADA:
      `${nomeUsuario} baixou uma foto.`,

    QRCODE_GERADO:
      `${nomeUsuario} gerou o QR Code.`,

    ETIQUETA_IMPRESSA:
      `${nomeUsuario} imprimiu uma etiqueta.`,

    'MOVIMENTAÇÃO':
      `${nomeUsuario} registrou uma movimentação.`,

    CAUTELA:
      `${nomeUsuario} realizou uma cautela.`,

    'DEVOLUÇÃO':
      `${nomeUsuario} registrou uma devolução.`,

    'TRANSFERÊNCIA':
      `${nomeUsuario} realizou uma transferência.`,

    BAIXA:
      `${nomeUsuario} realizou a baixa do patrimônio.`,

    'EXCLUSÃO':
      `${nomeUsuario} excluiu o patrimônio.`
  }

  return (
    descricoes[tipo] ||
    `${nomeUsuario} registrou um evento patrimonial.`
  )
}

function obterSeveridadeEvento(tipo) {
  if (
    tipo === TIPOS_EVENTO_PATRIMONIAL.EXCLUSAO ||
    tipo === TIPOS_EVENTO_PATRIMONIAL.BAIXA
  ) {
    return 'Atenção'
  }

  return 'Informativo'
}

export async function registrarEventoPatrimonial({
  tipo,
  patrimonioId,
  usuario = null,
  descricao = null,
  movimentacaoId = null,
  metadata = null
}) {
  if (!patrimonioId) {
    console.warn(
      'Evento patrimonial não registrado: patrimônio não informado.'
    )

    return null
  }

  const tipoNormalizado =
    normalizarTipoEvento(tipo)

  const descricaoEvento =
    descricao?.trim() ||
    criarDescricaoPadrao({
      tipo: tipoNormalizado,
      usuario
    })

  const registro = {
    patrimonio_id: patrimonioId,
    movimentacao_id: movimentacaoId,
    tipo_evento: tipoNormalizado,
    descricao: descricaoEvento,
    created_by: usuario?.id || null,
    created_by_nome: obterNomeUsuario(usuario)
  }

  const { data, error } = await supabase
    .from('sigmo_patrimonio_historico')
    .insert([registro])
    .select()
    .single()

  if (error) {
    console.warn(
      'Erro ao registrar evento patrimonial:',
      {
        error,
        tipo: tipoNormalizado,
        patrimonioId,
        movimentacaoId,
        metadata
      }
    )

    return null
  }

  try {
    await registerPatrimonialAudit({
      tipo: tipoNormalizado,
      descricao: descricaoEvento,
      usuario,
      modulo: 'Patrimônio',
      severidade:
        obterSeveridadeEvento(tipoNormalizado)
    })
  } catch (auditError) {
    console.warn(
      'Evento registrado no histórico, mas houve erro na auditoria:',
      auditError
    )
  }

  return data
}

export async function registrarHistoricoPatrimonio({
  patrimonio_id,
  tipo_evento,
  descricao,
  user = null,
  movimentacao_id = null
}) {
  return registrarEventoPatrimonial({
    tipo: tipo_evento,
    patrimonioId: patrimonio_id,
    usuario: user,
    descricao,
    movimentacaoId: movimentacao_id
  })
}