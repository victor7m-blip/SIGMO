import { supabase } from './supabaseClient'

import {
  criarNotificacoes,
  obterHoraServidor,
  formatarDataHoraServidor
} from './notificacoesService'

import {
  registerPatrimonialAudit
} from './auditoriaService'

import {
  STATUS_AGENDA
} from '../constants/agendaPatrimonial'

const TABLE = 'sigmo_agenda_patrimonial'
const MODULO_AUDITORIA = 'Agenda Patrimonial'
const LINK_PADRAO = 'materiais'

function texto(valor) {
  return String(valor ?? '').trim()
}

function upper(valor, fallback = '') {
  return texto(valor).toUpperCase() || fallback
}

function booleano(valor, fallback = false) {
  if (valor === undefined || valor === null) {
    return fallback
  }

  return Boolean(valor)
}

function objeto(valor, fallback = {}) {
  if (
    valor &&
    typeof valor === 'object' &&
    !Array.isArray(valor)
  ) {
    return valor
  }

  return fallback
}

function lista(valor) {
  if (!Array.isArray(valor)) {
    return []
  }

  return valor
    .map((item) => texto(item))
    .filter(Boolean)
}

function dataValida(valor, nomeCampo = 'data') {
  const data = new Date(valor)

  if (Number.isNaN(data.getTime())) {
    throw new Error(`Informe uma ${nomeCampo} válida.`)
  }

  return data
}

function normalizarAgenda(item = {}) {
  return {
    ...item,

    modulo:
      upper(item.modulo),

    tipo_evento:
      upper(item.tipo_evento),

    status:
      upper(
        item.status,
        STATUS_AGENDA.ATIVO
      ),

    destinatarios:
      lista(item.destinatarios),

    metadata:
      objeto(item.metadata)
  }
}

async function agoraServidor() {
  try {
    const valor =
      await obterHoraServidor()

    const data =
      new Date(valor)

    if (
      !Number.isNaN(
        data.getTime()
      )
    ) {
      return data
    }
  } catch (error) {
    console.warn(
      'Não foi possível obter a hora do servidor. Usando hora local:',
      error
    )
  }

  return new Date()
}

function obterNomeUsuario(user) {
  return (
    user?.nome_guerra ||
    user?.nome ||
    user?.nome_completo ||
    user?.email ||
    'Usuário do SIGMO'
  )
}

function descricaoAgenda(agenda) {
  return (
    texto(agenda.descricao) ||
    `${agenda.tipo_evento} — ${agenda.modulo}`
  )
}

function construirMetadataNotificacao(
  agenda,
  tipoAlerta
) {
  return {
    agenda_id:
      agenda.id,

    modulo:
      agenda.modulo,

    tipo_evento:
      agenda.tipo_evento,

    referencia_id:
      agenda.referencia_id,

    data_prevista:
      agenda.data_prevista,

    tipo_alerta:
      tipoAlerta,

    ...objeto(
      agenda.metadata
    )
  }
}

function construirNotificacoesPorPerfil({
  agenda,
  titulo,
  mensagem,
  tipo = 'ALERTA',
  prioridade = 'ALTA',
  tipoAlerta
}) {
  const perfis =
    lista(
      agenda.destinatarios
    )

  return perfis.map(
    (perfil) => ({
      titulo,
      mensagem,
      tipo,
      modulo:
        'AGENDA_PATRIMONIAL',

      prioridade,

      destinatario_perfil:
        upper(perfil),

      link:
        texto(
          agenda.metadata?.link
        ) ||
        LINK_PADRAO,

      metadata:
        construirMetadataNotificacao(
          agenda,
          tipoAlerta
        )
    })
  )
}

async function registrarAuditoriaSegura({
  tipo,
  descricao,
  usuario = null,
  severidade = 'Informativo'
}) {
  try {
    await registerPatrimonialAudit({
      tipo,
      descricao,
      usuario,
      modulo:
        MODULO_AUDITORIA,
      severidade
    })
  } catch (error) {
    console.warn(
      'Não foi possível registrar a auditoria da Agenda Patrimonial:',
      error
    )
  }
}

async function enviarNotificacoesAgenda(
  notificacoes
) {
  if (
    !Array.isArray(notificacoes) ||
    notificacoes.length === 0
  ) {
    return []
  }

  return criarNotificacoes(
    notificacoes
  )
}

async function atualizarAgenda(
  id,
  alteracoes
) {
  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .update(alteracoes)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw error
  }

  return normalizarAgenda(
    data
  )
}

export async function buscarAgendaPorId(
  id
) {
  if (!id) {
    throw new Error(
      'ID da agenda não informado.'
    )
  }

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    throw error
  }

  return normalizarAgenda(
    data
  )
}

export async function criarAgenda({
  modulo,
  tipoEvento,
  tipo_evento,
  referenciaId = null,
  referencia_id = null,
  descricao = '',
  dataPrevista,
  data_prevista,
  alerta48h = true,
  alerta_48h,
  alerta24h = false,
  alerta_24h,
  alertaVencimento = true,
  alerta_vencimento,
  destinatarios = [],
  metadata = {},
  usuario = null,
  evitarDuplicidade = true
} = {}) {
  const moduloNormalizado =
    upper(modulo)

  const eventoNormalizado =
    upper(
      tipoEvento ||
      tipo_evento
    )

  const referencia =
    referenciaId ||
    referencia_id ||
    null

  const dataInformada =
    dataPrevista ||
    data_prevista

  if (!moduloNormalizado) {
    throw new Error(
      'Informe o módulo da agenda.'
    )
  }

  if (!eventoNormalizado) {
    throw new Error(
      'Informe o tipo de evento da agenda.'
    )
  }

  const vencimento =
    dataValida(
      dataInformada,
      'data prevista'
    )

  const agora =
    await agoraServidor()

  if (
    vencimento.getTime() <=
    agora.getTime()
  ) {
    throw new Error(
      'A data prevista deve ser posterior à data e hora atuais.'
    )
  }

  const perfis =
    lista(destinatarios)

  if (perfis.length === 0) {
    throw new Error(
      'Informe pelo menos um destinatário para os alertas.'
    )
  }

  if (
    evitarDuplicidade &&
    referencia
  ) {
    const {
      data: existente,
      error: erroBusca
    } = await supabase
      .from(TABLE)
      .select('id')
      .eq(
        'modulo',
        moduloNormalizado
      )
      .eq(
        'tipo_evento',
        eventoNormalizado
      )
      .eq(
        'referencia_id',
        referencia
      )
      .in(
        'status',
        [
          STATUS_AGENDA.ATIVO,
          STATUS_AGENDA.VENCIDO
        ]
      )
      .limit(1)
      .maybeSingle()

    if (erroBusca) {
      throw erroBusca
    }

    if (existente?.id) {
      throw new Error(
        'Já existe um prazo ativo para esta movimentação.'
      )
    }
  }

  const payload = {
    modulo:
      moduloNormalizado,

    tipo_evento:
      eventoNormalizado,

    referencia_id:
      referencia,

    descricao:
      texto(descricao) ||
      null,

    status:
      STATUS_AGENDA.ATIVO,

    data_prevista:
      vencimento.toISOString(),

    alerta_48h:
      alerta_48h === undefined
        ? booleano(
            alerta48h,
            true
          )
        : booleano(
            alerta_48h,
            true
          ),

    alerta_24h:
      alerta_24h === undefined
        ? booleano(
            alerta24h,
            false
          )
        : booleano(
            alerta_24h,
            false
          ),

    alerta_vencimento:
      alerta_vencimento === undefined
        ? booleano(
            alertaVencimento,
            true
          )
        : booleano(
            alerta_vencimento,
            true
          ),

    destinatarios:
      perfis,

    metadata:
      objeto(metadata),

    created_by:
      usuario?.id ||
      null
  }

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .insert(payload)
    .select()
    .single()

  if (error) {
    throw error
  }

  const agenda =
    normalizarAgenda(data)

  await registrarAuditoriaSegura({
    tipo:
      'PRAZO_CRIADO',

    descricao:
      `Prazo criado para ${descricaoAgenda(
        agenda
      )}. Vencimento: ${formatarDataHoraServidor(
        agenda.data_prevista
      )}. Responsável pelo registro: ${obterNomeUsuario(
        usuario
      )}.`,

    usuario
  })

  return agenda
}

export async function listarPendentes({
  modulo = null,
  tipoEvento = null,
  referenciaId = null,
  incluirVencidos = true,
  limite = 200
} = {}) {
  const status = [
    STATUS_AGENDA.ATIVO
  ]

  if (incluirVencidos) {
    status.push(
      STATUS_AGENDA.VENCIDO
    )
  }

  let query =
    supabase
      .from(TABLE)
      .select('*')
      .in(
        'status',
        status
      )
      .order(
        'data_prevista',
        {
          ascending: true
        }
      )
      .limit(
        Math.max(
          1,
          Math.min(
            Number(limite) || 200,
            1000
          )
        )
      )

  if (texto(modulo)) {
    query = query.eq(
      'modulo',
      upper(modulo)
    )
  }

  if (texto(tipoEvento)) {
    query = query.eq(
      'tipo_evento',
      upper(tipoEvento)
    )
  }

  if (referenciaId) {
    query = query.eq(
      'referencia_id',
      referenciaId
    )
  }

  const {
    data,
    error
  } = await query

  if (error) {
    throw error
  }

  return (
    data || []
  ).map(
    normalizarAgenda
  )
}

export async function encerrarAgenda(
  id,
  {
    usuario = null,
    motivo = 'Compromisso patrimonial concluído.'
  } = {}
) {
  const atual =
    await buscarAgendaPorId(id)

  if (
    atual.status ===
    STATUS_AGENDA.ENCERRADO
  ) {
    return atual
  }

  if (
    atual.status ===
    STATUS_AGENDA.CANCELADO
  ) {
    throw new Error(
      'Não é possível encerrar uma agenda cancelada.'
    )
  }

  const agora =
    await agoraServidor()

  const agenda =
    await atualizarAgenda(
      id,
      {
        status:
          STATUS_AGENDA.ENCERRADO,

        data_encerramento:
          agora.toISOString(),

        metadata: {
          ...objeto(
            atual.metadata
          ),

          encerramento: {
            motivo:
              texto(motivo),

            usuario_id:
              usuario?.id ||
              null,

            usuario_nome:
              obterNomeUsuario(
                usuario
              ),

            data:
              agora.toISOString()
          }
        }
      }
    )

  await registrarAuditoriaSegura({
    tipo:
      'PRAZO_ENCERRADO',

    descricao:
      `Prazo encerrado: ${descricaoAgenda(
        agenda
      )}. Motivo: ${texto(
        motivo
      )}.`,

    usuario
  })

  return agenda
}

export async function cancelarAgenda(
  id,
  {
    usuario = null,
    motivo = 'Prazo cancelado.'
  } = {}
) {
  const atual =
    await buscarAgendaPorId(id)

  if (
    atual.status ===
    STATUS_AGENDA.CANCELADO
  ) {
    return atual
  }

  if (
    atual.status ===
    STATUS_AGENDA.ENCERRADO
  ) {
    throw new Error(
      'Não é possível cancelar uma agenda já encerrada.'
    )
  }

  const agora =
    await agoraServidor()

  const agenda =
    await atualizarAgenda(
      id,
      {
        status:
          STATUS_AGENDA.CANCELADO,

        data_cancelamento:
          agora.toISOString(),

        metadata: {
          ...objeto(
            atual.metadata
          ),

          cancelamento: {
            motivo:
              texto(motivo),

            usuario_id:
              usuario?.id ||
              null,

            usuario_nome:
              obterNomeUsuario(
                usuario
              ),

            data:
              agora.toISOString()
          }
        }
      }
    )

  await registrarAuditoriaSegura({
    tipo:
      'PRAZO_CANCELADO',

    descricao:
      `Prazo cancelado: ${descricaoAgenda(
        agenda
      )}. Motivo: ${texto(
        motivo
      )}.`,

    usuario
  })

  return agenda
}

async function processarAlerta48h(
  agenda,
  agora
) {
  if (
    !agenda.alerta_48h ||
    agenda.alerta_48h_enviado_em
  ) {
    return false
  }

  const vencimento =
    new Date(
      agenda.data_prevista
    )

  const horas =
    (
      vencimento.getTime() -
      agora.getTime()
    ) /
    3600000

  if (
    horas <= 0 ||
    horas > 48
  ) {
    return false
  }

  const notificacoes =
    construirNotificacoesPorPerfil({
      agenda,

      titulo:
        'Prazo patrimonial próximo do vencimento',

      mensagem:
        `${descricaoAgenda(
          agenda
        )} deverá ser concluído até ${formatarDataHoraServidor(
          agenda.data_prevista
        )}.`,

      prioridade:
        'ALTA',

      tipoAlerta:
        'LEMBRETE_48H'
    })

  await enviarNotificacoesAgenda(
    notificacoes
  )

  await atualizarAgenda(
    agenda.id,
    {
      alerta_48h_enviado_em:
        agora.toISOString()
    }
  )

  await registrarAuditoriaSegura({
    tipo:
      'LEMBRETE_48H',

    descricao:
      `Lembrete de prazo enviado para ${descricaoAgenda(
        agenda
      )}.`
  })

  return true
}

async function processarAlerta24h(
  agenda,
  agora
) {
  if (
    !agenda.alerta_24h ||
    agenda.alerta_24h_enviado_em
  ) {
    return false
  }

  const vencimento =
    new Date(
      agenda.data_prevista
    )

  const horas =
    (
      vencimento.getTime() -
      agora.getTime()
    ) /
    3600000

  if (
    horas <= 0 ||
    horas > 24
  ) {
    return false
  }

  const notificacoes =
    construirNotificacoesPorPerfil({
      agenda,

      titulo:
        'Prazo patrimonial vence em menos de 24 horas',

      mensagem:
        `${descricaoAgenda(
          agenda
        )} deverá ser concluído até ${formatarDataHoraServidor(
          agenda.data_prevista
        )}.`,

      prioridade:
        'URGENTE',

      tipoAlerta:
        'LEMBRETE_24H'
    })

  await enviarNotificacoesAgenda(
    notificacoes
  )

  await atualizarAgenda(
    agenda.id,
    {
      alerta_24h_enviado_em:
        agora.toISOString()
    }
  )

  await registrarAuditoriaSegura({
    tipo:
      'LEMBRETE_24H',

    descricao:
      `Lembrete de 24 horas enviado para ${descricaoAgenda(
        agenda
      )}.`
  })

  return true
}

async function processarVencimento(
  agenda,
  agora
) {
  const vencimento =
    new Date(
      agenda.data_prevista
    )

  if (
    vencimento.getTime() >
    agora.getTime()
  ) {
    return false
  }

  if (
    agenda.alerta_vencimento &&
    !agenda.alerta_vencimento_enviado_em
  ) {
    const notificacoes =
      construirNotificacoesPorPerfil({
        agenda,

        titulo:
          'Prazo patrimonial vencido',

        mensagem:
          `${descricaoAgenda(
            agenda
          )} venceu em ${formatarDataHoraServidor(
            agenda.data_prevista
          )} e permanece pendente.`,

        prioridade:
          'URGENTE',

        tipo:
          'ERRO',

        tipoAlerta:
          'PRAZO_VENCIDO'
      })

    await enviarNotificacoesAgenda(
      notificacoes
    )
  }

  const alteracoes = {
    status:
      STATUS_AGENDA.VENCIDO
  }

  if (
    agenda.alerta_vencimento &&
    !agenda.alerta_vencimento_enviado_em
  ) {
    alteracoes.alerta_vencimento_enviado_em =
      agora.toISOString()
  }

  await atualizarAgenda(
    agenda.id,
    alteracoes
  )

  if (
    agenda.status !==
    STATUS_AGENDA.VENCIDO
  ) {
    await registrarAuditoriaSegura({
      tipo:
        'PRAZO_VENCIDO',

      descricao:
        `Prazo vencido para ${descricaoAgenda(
          agenda
        )}. Vencimento previsto: ${formatarDataHoraServidor(
          agenda.data_prevista
        )}.`,

      severidade:
        'Alerta'
    })
  }

  return true
}

export async function verificarPrazos({
  limite = 500
} = {}) {
  const agora =
    await agoraServidor()

  const agendas =
    await listarPendentes({
      incluirVencidos:
        true,

      limite
    })

  const resultado = {
    verificados:
      agendas.length,

    lembretes48h:
      0,

    lembretes24h:
      0,

    vencidos:
      0,

    erros:
      []
  }

  for (
    const agenda of agendas
  ) {
    try {
      const venceu =
        await processarVencimento(
          agenda,
          agora
        )

      if (venceu) {
        resultado.vencidos += 1
        continue
      }

      const enviou48h =
        await processarAlerta48h(
          agenda,
          agora
        )

      if (enviou48h) {
        resultado.lembretes48h += 1
      }

      const agendaAtualizada =
        enviou48h
          ? await buscarAgendaPorId(
              agenda.id
            )
          : agenda

      const enviou24h =
        await processarAlerta24h(
          agendaAtualizada,
          agora
        )

      if (enviou24h) {
        resultado.lembretes24h += 1
      }
    } catch (error) {
      console.error(
        `Erro ao verificar agenda ${agenda.id}:`,
        error
      )

      resultado.erros.push({
        agendaId:
          agenda.id,

        mensagem:
          error?.message ||
          'Erro desconhecido.'
      })
    }
  }

  return resultado
}

export async function encerrarAgendaPorReferencia({
  modulo,
  tipoEvento,
  referenciaId,
  usuario = null,
  motivo = 'Movimentação concluída.'
}) {
  if (!referenciaId) {
    return []
  }

  const agendas =
    await listarPendentes({
      modulo,
      tipoEvento,
      referenciaId,
      incluirVencidos:
        true
    })

  const encerradas = []

  for (
    const agenda of agendas
  ) {
    encerradas.push(
      await encerrarAgenda(
        agenda.id,
        {
          usuario,
          motivo
        }
      )
    )
  }

  return encerradas
}

export default {
  criarAgenda,
  buscarAgendaPorId,
  listarPendentes,
  encerrarAgenda,
  encerrarAgendaPorReferencia,
  cancelarAgenda,
  verificarPrazos
}
