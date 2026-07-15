import { supabase } from '../../../services/supabaseClient'

const TABLE = 'sigmo_perfis_temporarios'
const VIEW_VALIDOS = 'sigmo_perfis_temporarios_validos'

export const PERFIS_TEMPORARIOS = {
  AUXILIAR_SVDD_TEMPORARIO: 'AUXILIAR_SVDD_TEMPORARIO',
  AUXILIAR_P4_TEMPORARIO: 'AUXILIAR_P4_TEMPORARIO',
  CONFERENTE_TEMPORARIO: 'CONFERENTE_TEMPORARIO',
  OUTRO_TEMPORARIO: 'OUTRO_TEMPORARIO'
}

export const DURACAO_PADRAO_AUXILIAR_HORAS = 15

function texto(valor) {
  if (valor === null || valor === undefined) return ''
  return String(valor).trim()
}

function normalizarRE(re) {
  return texto(re).replace(/\D/g, '')
}

function dataIso(valor) {
  if (!valor) return null

  const data = valor instanceof Date ? valor : new Date(valor)

  if (Number.isNaN(data.getTime())) return null

  return data.toISOString()
}

function adicionarHoras(data, horas) {
  const base = data instanceof Date ? data : new Date(data)
  const resultado = new Date(base)

  resultado.setHours(
    resultado.getHours() + Number(horas || 0)
  )

  return resultado
}

function normalizarPerfilTemporario(perfil) {
  if (!perfil) return null

  const expiraEm = perfil.expira_em
    ? new Date(perfil.expira_em)
    : null

  const agora = new Date()

  const segundosRestantes = expiraEm
    ? Math.max(
        0,
        Math.floor((expiraEm.getTime() - agora.getTime()) / 1000)
      )
    : 0

  return {
    ...perfil,
    policial_re: normalizarRE(perfil.policial_re),
    concedido_por_re: normalizarRE(perfil.concedido_por_re),
    revogado_por_re: normalizarRE(perfil.revogado_por_re),
    ativo: Boolean(perfil.ativo),
    revogado: Boolean(perfil.revogado),
    segundos_restantes:
      perfil.segundos_restantes !== undefined
        ? Math.max(0, Number(perfil.segundos_restantes) || 0)
        : segundosRestantes,
    valido:
      Boolean(perfil.ativo) &&
      !Boolean(perfil.revogado) &&
      Boolean(expiraEm) &&
      expiraEm.getTime() > agora.getTime()
  }
}

function tratarErro(error, mensagemPadrao) {
  console.error(mensagemPadrao, error)

  throw new Error(
    error?.message ||
    error?.details ||
    error?.hint ||
    mensagemPadrao
  )
}

export async function concederPerfilTemporario({
  policialRe,
  policialNome = '',
  perfil = PERFIS_TEMPORARIOS.AUXILIAR_SVDD_TEMPORARIO,
  setor = 'SVDD',
  localId = null,
  localNome = '',
  concedidoPorRe,
  concedidoPorNome = '',
  motivo = '',
  duracaoHoras = DURACAO_PADRAO_AUXILIAR_HORAS,
  inicioEm = new Date(),
  metadados = {}
}) {
  try {
    const rePolicial = normalizarRE(policialRe)
    const reResponsavel = normalizarRE(concedidoPorRe)

    if (!rePolicial) {
      throw new Error('O RE do policial é obrigatório.')
    }

    if (!reResponsavel) {
      throw new Error('O RE de quem concede o perfil é obrigatório.')
    }

    const horas = Number(duracaoHoras)

    if (!Number.isFinite(horas) || horas <= 0) {
      throw new Error('A duração do perfil temporário é inválida.')
    }

    const inicio = new Date(inicioEm)

    if (Number.isNaN(inicio.getTime())) {
      throw new Error('A data de início é inválida.')
    }

    const expiraEm = adicionarHoras(inicio, horas)

    await revogarPerfisAtivosDoMesmoTipo({
      policialRe: rePolicial,
      perfil,
      revogadoPorRe: reResponsavel,
      revogadoPorNome: concedidoPorNome,
      motivo: 'Substituído por uma nova concessão.'
    })

    const payload = {
      policial_re: rePolicial,
      policial_nome: texto(policialNome),
      perfil,
      setor: texto(setor) || null,
      local_id: localId || null,
      local_nome: texto(localNome) || null,
      concedido_por_re: reResponsavel,
      concedido_por_nome: texto(concedidoPorNome),
      motivo: texto(motivo) || null,
      inicio_em: dataIso(inicio),
      expira_em: dataIso(expiraEm),
      ativo: true,
      revogado: false,
      metadados: metadados || {}
    }

    const { data, error } = await supabase
      .from(TABLE)
      .insert(payload)
      .select()
      .single()

    if (error) throw error

    return normalizarPerfilTemporario(data)
  } catch (error) {
    tratarErro(error, 'Não foi possível conceder o perfil temporário.')
  }
}

export async function listarPerfisTemporarios({
  policialRe = '',
  perfil = '',
  apenasAtivos = false,
  limite = 100
} = {}) {
  try {
    const fonte = apenasAtivos ? VIEW_VALIDOS : TABLE

    let query = supabase
      .from(fonte)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Math.max(1, Number(limite) || 100))

    const re = normalizarRE(policialRe)

    if (re) {
      query = query.eq('policial_re', re)
    }

    if (texto(perfil)) {
      query = query.eq('perfil', texto(perfil).toUpperCase())
    }

    const { data, error } = await query

    if (error) throw error

    return (data || []).map(normalizarPerfilTemporario)
  } catch (error) {
    tratarErro(
      error,
      'Não foi possível listar os perfis temporários.'
    )
  }
}

export async function obterPerfilTemporarioAtivo({
  policialRe,
  perfil
}) {
  try {
    const re = normalizarRE(policialRe)

    if (!re || !perfil) return null

    const { data, error } = await supabase
      .from(VIEW_VALIDOS)
      .select('*')
      .eq('policial_re', re)
      .eq('perfil', texto(perfil).toUpperCase())
      .order('expira_em', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error

    return normalizarPerfilTemporario(data)
  } catch (error) {
    tratarErro(error, 'Não foi possível consultar o perfil temporário.')
  }
}

export async function policialPossuiPerfilTemporario({
  policialRe,
  perfil
}) {
  const registro = await obterPerfilTemporarioAtivo({
    policialRe,
    perfil
  })

  return Boolean(registro?.valido)
}

export async function revogarPerfilTemporario({
  perfilTemporarioId,
  revogadoPorRe,
  revogadoPorNome = '',
  motivo = ''
}) {
  try {
    if (!perfilTemporarioId) {
      throw new Error('Informe o perfil temporário.')
    }

    const reResponsavel = normalizarRE(revogadoPorRe)

    if (!reResponsavel) {
      throw new Error('Informe o responsável pela revogação.')
    }

    const { data, error } = await supabase
      .from(TABLE)
      .update({
        ativo: false,
        revogado: true,
        revogado_em: new Date().toISOString(),
        revogado_por_re: reResponsavel,
        revogado_por_nome: texto(revogadoPorNome),
        motivo_revogacao: texto(motivo) || null
      })
      .eq('id', perfilTemporarioId)
      .select()
      .single()

    if (error) throw error

    return normalizarPerfilTemporario(data)
  } catch (error) {
    tratarErro(error, 'Não foi possível revogar o perfil temporário.')
  }
}

export async function revogarPerfisAtivosDoMesmoTipo({
  policialRe,
  perfil,
  revogadoPorRe,
  revogadoPorNome = '',
  motivo = ''
}) {
  try {
    const rePolicial = normalizarRE(policialRe)
    const reResponsavel = normalizarRE(revogadoPorRe)

    if (!rePolicial || !perfil) return []

    const { data, error } = await supabase
      .from(TABLE)
      .update({
        ativo: false,
        revogado: true,
        revogado_em: new Date().toISOString(),
        revogado_por_re: reResponsavel || null,
        revogado_por_nome: texto(revogadoPorNome),
        motivo_revogacao:
          texto(motivo) || 'Perfil temporário substituído ou revogado.'
      })
      .eq('policial_re', rePolicial)
      .eq('perfil', texto(perfil).toUpperCase())
      .eq('ativo', true)
      .eq('revogado', false)
      .select()

    if (error) throw error

    return (data || []).map(normalizarPerfilTemporario)
  } catch (error) {
    tratarErro(
      error,
      'Não foi possível revogar os perfis temporários anteriores.'
    )
  }
}

export async function expirarPerfisTemporarios() {
  try {
    const { data, error } = await supabase.rpc(
      'sigmo_expirar_perfis_temporarios'
    )

    if (error) throw error

    return Number(data) || 0
  } catch (error) {
    tratarErro(
      error,
      'Não foi possível processar a expiração dos perfis temporários.'
    )
  }
}

export function calcularTempoRestante(expiraEm) {
  if (!expiraEm) {
    return {
      totalSegundos: 0,
      horas: 0,
      minutos: 0,
      segundos: 0,
      expirado: true,
      texto: 'Expirado'
    }
  }

  const agora = Date.now()
  const fim = new Date(expiraEm).getTime()

  if (Number.isNaN(fim)) {
    return {
      totalSegundos: 0,
      horas: 0,
      minutos: 0,
      segundos: 0,
      expirado: true,
      texto: 'Data inválida'
    }
  }

  const totalSegundos = Math.max(
    0,
    Math.floor((fim - agora) / 1000)
  )

  const horas = Math.floor(totalSegundos / 3600)
  const minutos = Math.floor((totalSegundos % 3600) / 60)
  const segundos = totalSegundos % 60
  const expirado = totalSegundos <= 0

  return {
    totalSegundos,
    horas,
    minutos,
    segundos,
    expirado,
    texto: expirado
      ? 'Expirado'
      : [
          String(horas).padStart(2, '0'),
          String(minutos).padStart(2, '0'),
          String(segundos).padStart(2, '0')
        ].join(':')
  }
}

export function iniciarContadorRegressivo({
  expiraEm,
  onAtualizar,
  intervaloMs = 1000
}) {
  if (typeof onAtualizar !== 'function') {
    return () => {}
  }

  const atualizar = () => {
    const tempo = calcularTempoRestante(expiraEm)
    onAtualizar(tempo)

    return tempo
  }

  const inicial = atualizar()

  if (inicial.expirado) {
    return () => {}
  }

  const timer = window.setInterval(() => {
    const tempo = atualizar()

    if (tempo.expirado) {
      window.clearInterval(timer)
    }
  }, Math.max(250, Number(intervaloMs) || 1000))

  return () => {
    window.clearInterval(timer)
  }
}