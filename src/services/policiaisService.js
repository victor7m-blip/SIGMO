import { supabase } from './supabaseClient'

import {
  registerAudit
} from './auditoriaService'

import {
  criarNotificacoes,
  obterHoraServidor,
  formatarDataHoraServidor
} from './notificacoesService'

const TABLE = 'policiais'
const FOTOS_TABLE = 'sigmo_policiais_fotos'
const USERS_TABLE =
  'sigmo_users'

const PERFIL_COMANDANTE =
  'COMANDANTE DE CIA'

const ERRO_COMANDANTE_EXISTENTE =
  'Não foi possível concluir o cadastro.\n\n' +
  'Já existe um Comandante de Companhia cadastrado.\n' +
  'A tentativa foi registrada e os responsáveis foram notificados.'


function gerarPinTemporario() {
  const cryptoApi =
    globalThis.crypto

  if (
    cryptoApi?.getRandomValues
  ) {
    const valores =
      new Uint32Array(1)

    cryptoApi.getRandomValues(
      valores
    )

    return String(
      100000 +
      (valores[0] % 900000)
    )
  }

  const numero =
    Math.floor(
      100000 +
      Math.random() * 900000
    )

  return String(numero)
}

async function pinJaExiste(pin) {
  const [policiaisResult, usuariosResult] = await Promise.all([
    supabase.from(TABLE).select('id').eq('pin', pin).limit(1),
    supabase.from(USERS_TABLE).select('id').eq('pin', pin).limit(1)
  ])

  if (policiaisResult.error) throw policiaisResult.error
  if (usuariosResult.error) throw usuariosResult.error

  return Boolean(
    policiaisResult.data?.length ||
    usuariosResult.data?.length
  )
}

async function gerarPinUnico() {
  for (
    let tentativa = 0;
    tentativa < 20;
    tentativa += 1
  ) {
    const pin =
      gerarPinTemporario()

    const existe =
      await pinJaExiste(pin)

    if (!existe) {
      return pin
    }
  }

  throw new Error(
    'Não foi possível gerar um PIN temporário. Tente novamente.'
  )
}

async function anexarFotosPrincipais(
  policiais = []
) {
  if (
    !Array.isArray(policiais) ||
    policiais.length === 0
  ) {
    return []
  }

  const ids = policiais
    .map(
      (policial) =>
        policial.id
    )
    .filter(Boolean)

  if (ids.length === 0) {
    return policiais
  }

  const {
    data: fotos,
    error
  } = await supabase
    .from(FOTOS_TABLE)
    .select(`
      id,
      policial_id,
      url,
      principal,
      created_at
    `)
    .in(
      'policial_id',
      ids
    )
    .order(
      'principal',
      {
        ascending: false
      }
    )
    .order(
      'created_at',
      {
        ascending: false
      }
    )

  if (error) {
    console.warn(
      'Não foi possível carregar as fotos dos policiais:',
      error
    )

    return policiais
  }

  const fotoPorPolicial =
    new Map()

  for (
    const foto of fotos ?? []
  ) {
    if (
      !foto?.policial_id ||
      !foto?.url
    ) {
      continue
    }

    /*
     * A consulta já vem ordenada com:
     * 1. foto principal primeiro;
     * 2. foto mais recente depois.
     *
     * Por isso mantemos a primeira foto
     * encontrada de cada policial.
     */
    if (
      !fotoPorPolicial.has(
        foto.policial_id
      )
    ) {
      fotoPorPolicial.set(
        foto.policial_id,
        foto
      )
    }
  }

  return policiais.map(
    (policial) => {
      const foto =
        fotoPorPolicial.get(
          policial.id
        )

      return {
        ...policial,

        /*
         * Preferimos a foto cadastrada
         * na galeria. Caso não exista,
         * mantemos foto_url do policial.
         */
        foto_url:
          foto?.url ||
          policial.foto_url ||
          null,

        foto_principal:
          foto || null
      }
    }
  )
}


export async function obterPolicialPorId(
  id
) {
  if (!id) {
    throw new Error(
      'Policial não informado.'
    )
  }

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .select('*')
    .eq(
      'id',
      id
    )
    .maybeSingle()

  if (error) {
    throw error
  }

  return data || null
}

export async function listarPoliciais({
  filtros = {},
  pagina = 1,
  limite = 20,
  sortBy = 'created_at',
  sortDirection = 'desc'
} = {}) {
  const inicio =
    (pagina - 1) * limite

  const fim =
    inicio + limite - 1

  let query = supabase
    .from(TABLE)
    .select('*', {
      count: 'exact'
    })
    .order(sortBy, {
      ascending:
        sortDirection === 'asc',

      nullsFirst: false
    })
    .range(
      inicio,
      fim
    )

  if (filtros.nome?.trim()) {
    query = query.ilike(
      'nome',
      `%${filtros.nome.trim()}%`
    )
  }

  if (
    filtros.nome_guerra?.trim()
  ) {
    query = query.ilike(
      'nome_guerra',
      `%${filtros.nome_guerra.trim()}%`
    )
  }

  if (filtros.re?.trim()) {
    query = query.ilike(
      're',
      `%${filtros.re.trim()}%`
    )
  }

  if (
  filtros.perfil?.trim()
) {
  query = query.eq(
    'perfil',
    filtros.perfil
  )
}

  if (
    filtros.qr_code?.trim()
  ) {
    query = query.ilike(
      'qr_code',
      `%${filtros.qr_code.trim()}%`
    )
  }

  if (
    filtros.posto_graduacao?.trim()
  ) {
    query = query.eq(
      'posto_graduacao',
      filtros.posto_graduacao
    )
  }

  if (
    filtros.companhia?.trim()
  ) {
    query = query.ilike(
      'companhia',
      `%${filtros.companhia.trim()}%`
    )
  }

  if (
    filtros.pelotao?.trim()
  ) {
    query = query.ilike(
      'pelotao',
      `%${filtros.pelotao.trim()}%`
    )
  }

  if (
    filtros.situacao?.trim()
  ) {
    query = query.eq(
      'situacao',
      filtros.situacao
    )
  }

  const {
    data,
    error,
    count
  } = await query

  if (error) {
    throw error
  }

  const policiaisComFotos =
    await anexarFotosPrincipais(
      data ?? []
    )

  return {
    data:
      policiaisComFotos,

    total:
      count ?? 0
  }
}

async function buscarValoresUnicos(
  campo
) {
  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .select(campo)

  if (error) {
    throw error
  }

  return [
    ...new Set(
      (data ?? [])
        .map(
          (item) =>
            item[campo]
        )
        .filter(Boolean)
    )
  ].sort()
}

export function listarPostosGraduacoes() {
  return buscarValoresUnicos(
    'posto_graduacao'
  )
}

export function listarCompanhias() {
  return buscarValoresUnicos(
    'companhia'
  )
}

export function listarPelotoes() {
  return buscarValoresUnicos(
    'pelotao'
  )
}

export function listarSituacoesPoliciais() {
  return buscarValoresUnicos(
    'situacao'
  )
}

function normalizarTexto(
  valor
) {
  return String(
    valor ?? ''
  )
    .trim()
    .toUpperCase()
}

function ehPerfilComandante(
  perfil
) {
  const valor =
    normalizarTexto(perfil)

  return [
    'COMANDANTE DE CIA',
    'COMANDANTE DA CIA',
    'COMANDANTE DE COMPANHIA',
    'CMT DE CIA'
  ].includes(valor)
}

function identificarUsuario(
  user
) {
  const posto =
    normalizarTexto(
      user?.posto_graduacao
    )

  const nome =
    normalizarTexto(
      user?.nome_guerra ||
      user?.nome
    )

  return (
    [posto, nome]
      .filter(Boolean)
      .join(' ') ||
    'USUÁRIO NÃO IDENTIFICADO'
  )
}

function identificarCadastro(
  payload
) {
  const posto =
    normalizarTexto(
      payload?.posto_graduacao
    )

  const nome =
    normalizarTexto(
      payload?.nome_guerra ||
      payload?.nome
    )

  return (
    [posto, nome]
      .filter(Boolean)
      .join(' ') ||
    'NÃO INFORMADO'
  )
}

async function buscarComandanteExistente({
  ignorarId = null
} = {}) {
  let query =
    supabase
      .from(TABLE)
      .select(`
        id,
        nome,
        nome_guerra,
        re,
        posto_graduacao,
        perfil,
        situacao
      `)
      .eq(
        'perfil',
        PERFIL_COMANDANTE
      )
      .neq(
        'situacao',
        'INATIVO'
      )
      .limit(1)

  if (ignorarId) {
    query =
      query.neq(
        'id',
        ignorarId
      )
  }

  const {
    data,
    error
  } = await query

  if (error) {
    throw error
  }

  return data?.[0] || null
}

async function buscarDestinatariosSeguranca(
  comandante
) {
  const policialIds =
    new Set()

  if (comandante?.id) {
    policialIds.add(
      comandante.id
    )
  }

  /*
   * Localiza policiais que trabalham
   * no P1. A busca considera função,
   * equipe e pelotão para suportar
   * o cadastro atual do SIGMO.
   */
  const {
    data: policiaisP1,
    error: policiaisP1Error
  } = await supabase
    .from(TABLE)
    .select(`
      id,
      nome,
      nome_guerra,
      re,
      funcao,
      equipe,
      pelotao
    `)
    .or(
      'funcao.ilike.%P1%,' +
      'equipe.ilike.%P1%,' +
      'pelotao.ilike.%P1%'
    )

  if (policiaisP1Error) {
    throw policiaisP1Error
  }

  for (
    const policial of
    policiaisP1 ?? []
  ) {
    if (policial?.id) {
      policialIds.add(
        policial.id
      )
    }
  }

  if (
    policialIds.size === 0
  ) {
    return []
  }

  const ids =
    Array.from(policialIds)

  const {
    data: usuarios,
    error: usuariosError
  } = await supabase
    .from(USERS_TABLE)
    .select(`
      id,
      policial_id,
      perfil,
      ativo
    `)
    .in(
      'policial_id',
      ids
    )
    .eq(
      'ativo',
      true
    )

  if (usuariosError) {
    throw usuariosError
  }

  const usuariosPorPolicial =
    new Map()

  for (
    const usuario of
    usuarios ?? []
  ) {
    if (
      usuario?.policial_id &&
      !usuariosPorPolicial.has(
        usuario.policial_id
      )
    ) {
      usuariosPorPolicial.set(
        usuario.policial_id,
        usuario
      )
    }
  }

  return ids.map(
    (policialId) => {
      const usuario =
        usuariosPorPolicial.get(
          policialId
        )

      return {
        usuarioId:
          usuario?.id || null,

        policialId
      }
    }
  )
}

async function registrarAuditoriaTentativa({
  payload,
  user,
  comandante
}) {
  try {
    await registerAudit({
      user,

      action:
        'TENTATIVA_CADASTRO_COMANDANTE',

      tableName:
        TABLE,

      recordId:
        comandante?.id || null,

      description:
        `${identificarUsuario(
          user
        )} tentou cadastrar ` +
        `${identificarCadastro(
          payload
        )}, RE ${
          payload?.re ||
          'NÃO INFORMADO'
        }, como novo Comandante de Companhia. ` +
        'A tentativa foi bloqueada porque já existe um Comandante de Companhia ativo.',

      module:
        'POLICIAIS',

      severity:
        'CRITICA'
    })
  } catch (error) {
    console.error(
      'Erro ao registrar auditoria da tentativa:',
      error
    )
  }
}

async function notificarTentativaComandante({
  payload,
  user,
  comandante
}) {
  const horaServidor =
    await obterHoraServidor()

  const dataHora =
    formatarDataHoraServidor(
      horaServidor
    )

  const destinatarios =
    await buscarDestinatariosSeguranca(
      comandante
    )

  const mensagem =
    'O usuário ' +
    identificarUsuario(user) +
    ' tentou cadastrar um novo ' +
    'Comandante de Companhia.\n\n' +

    'Cadastro pretendido:\n' +
    identificarCadastro(payload) +
    '\n' +
    `RE: ${
      payload?.re ||
      'NÃO INFORMADO'
    }\n\n` +

    'Tentativa registrada em:\n' +
    dataHora +
    '\n\n' +

    'O cadastro foi bloqueado porque já existe um ' +
    'Comandante de Companhia ativo no SIGMO.'

  const notificacoes =
    destinatarios.map(
      (destinatario) => ({
        titulo:
          'TENTATIVA DE CADASTRO DE COMANDANTE DE CIA',

        mensagem,

        tipo:
          'SEGURANCA',

        modulo:
          'POLICIAIS',

        prioridade:
          'CRITICA',

        destinatario_usuario_id:
          destinatario.usuarioId,

        destinatario_policial_id:
          destinatario.policialId,

        link:
          '/policiais',

        metadata: {
          evento:
            'TENTATIVA_CADASTRO_COMANDANTE',

          registrado_em:
            horaServidor,

          autor_id:
            user?.id || null,

          autor_user_id:
            user?.user_id || null,

          autor_nome:
            identificarUsuario(user),

          cadastro_pretendido_nome:
            identificarCadastro(
              payload
            ),

          cadastro_pretendido_re:
            payload?.re || null,

          comandante_existente_id:
            comandante?.id || null,

          comandante_existente_re:
            comandante?.re || null
        }
      })
    )

  if (
    notificacoes.length === 0
  ) {
    console.warn(
      'Nenhum destinatário foi localizado para o alerta de segurança.'
    )

    return
  }

  await criarNotificacoes(
    notificacoes
  )
}

async function validarComandanteUnico({
  payload,
  user,
  ignorarId = null
}) {
  if (
    !ehPerfilComandante(
      payload?.perfil
    )
  ) {
    return
  }

  const comandante =
    await buscarComandanteExistente({
      ignorarId
    })

  if (!comandante) {
    return
  }

  await registrarAuditoriaTentativa({
    payload,
    user,
    comandante
  })

  try {
    await notificarTentativaComandante({
      payload,
      user,
      comandante
    })
  } catch (error) {
    console.error(
      'Erro ao enviar notificações da tentativa:',
      error
    )
  }

  throw new Error(
    ERRO_COMANDANTE_EXISTENTE
  )
}

function ehCadastroExterno(payload) {
  return String(payload?.tipo_cadastro || '')
    .trim()
    .toUpperCase() !== 'POLICIAL_27_BPM'
}

async function garantirUsuarioExterno({
  policialId,
  pin = null,
  ativo = true,
  user = null
}) {
  if (!policialId) {
    throw new Error(
      'Pessoa cadastrada não identificada.'
    )
  }

  const operadorUsuarioId =
    user?.user_id ||
    user?.usuario_id ||
    null

  if (!operadorUsuarioId) {
    throw new Error(
      'Usuário operador não identificado. Saia e entre novamente no SIGMO.'
    )
  }

  const pinLimpo =
    pin
      ? String(pin)
          .replace(/\D/g, '')
          .slice(0, 6)
      : null

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_garantir_usuario_externo',
    {
      p_operador_usuario_id:
        operadorUsuarioId,

      p_policial_id:
        policialId,

      p_pin:
        pinLimpo,

      p_ativo:
        Boolean(ativo)
    }
  )

  if (error) {
    throw new Error(
      error?.message ||
      error?.details ||
      'Não foi possível criar o acesso do usuário externo.'
    )
  }

  const resultado =
    Array.isArray(data)
      ? data[0]
      : data

  if (!resultado?.usuario_id) {
    throw new Error(
      'O banco não confirmou a criação do acesso externo.'
    )
  }

  return resultado.usuario_id
}

export async function cadastrarPolicial(
  payload,
  user = null
) {
  await validarComandanteUnico({
    payload,
    user
  })

  const externo = ehCadastroExterno(payload)
  const payloadFinal = externo
    ? {
        ...payload,
        perfil: 'USUARIO EXTERNO',
        companhia: null,
        pelotao: null,
        equipe: null,
        funcao: null
      }
    : payload

  const pinTemporario = await gerarPinUnico()

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      ...payloadFinal,
      qr_code: payloadFinal.qr_code || null,
      pin: pinTemporario
    })
    .select()
    .single()

  if (error) throw error

  if (externo) {
    try {
      await garantirUsuarioExterno({
  policialId: data.id,
  pin: pinTemporario,
  ativo:
    payloadFinal.situacao !==
    'INATIVO',
  user
})
    } catch (usuarioError) {
      await supabase.from(TABLE).delete().eq('id', data.id)
      throw new Error(
        usuarioError?.message ||
        'Não foi possível criar o acesso do usuário externo.'
      )
    }
  }

  return {
    ...data,
    pinTemporario
  }
}

export async function atualizarPolicial(
  id,
  payload,
  user = null
) {
  if (!id) {
    throw new Error(
      'Policial não informado.'
    )
  }

  await validarComandanteUnico({
    payload,
    user,
    ignorarId: id
  })

  const dadosAtualizacao = {
    ...payload,

    qr_code:
      payload.qr_code ||
      null
  }

  delete dadosAtualizacao.id
  delete dadosAtualizacao.pin
  delete dadosAtualizacao.pinTemporario
  delete dadosAtualizacao.foto_principal
  delete dadosAtualizacao.created_at
  delete dadosAtualizacao.updated_at

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .update(
      dadosAtualizacao
    )
    .eq(
      'id',
      id
    )
    .select()
    .single()

  if (error) {
    throw error
  }

  if (ehCadastroExterno(data)) {
  await garantirUsuarioExterno({
    policialId: data.id,
    ativo:
      data.situacao !==
      'INATIVO',
    user
  })
}

  return data
}

export async function gerarNovoPinPolicial(
  id
) {
  if (!id) {
    throw new Error(
      'Policial não informado.'
    )
  }

  const pinTemporario =
    await gerarPinUnico()

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .update({
      pin:
        pinTemporario
    })
    .eq(
      'id',
      id
    )
    .select()
    .single()

  if (error) {
    throw error
  }

  return {
    ...data,

    pinTemporario
  }
}

const VINCULOS_EXCLUSAO = [
  {
    tabela: 'sigmo_users',
    coluna: 'policial_id',
    descricao: 'usuário de acesso ao SIGMO'
  },
  {
    tabela: 'sigmo_tonfas_movimentacoes',
    coluna: 'policial_id',
    descricao: 'movimentação de tonfa/cassetete'
  },
  {
    tabela: 'sigmo_manutencoes',
    coluna: 'policial_id',
    descricao: 'registro de manutenção/novidade'
  },
  {
    tabela: 'sigmo_solicitacoes_cadastrais',
    coluna: 'policial_id',
    descricao: 'solicitação cadastral'
  }
]

async function verificarVinculosExclusao(
  policialId
) {
  const vinculos = []

  for (const item of VINCULOS_EXCLUSAO) {
    const {
      count,
      error
    } = await supabase
      .from(item.tabela)
      .select('id', {
        count: 'exact',
        head: true
      })
      .eq(
        item.coluna,
        policialId
      )

    if (error) {
      /*
       * Não ignoramos falhas de validação: excluir sem
       * conseguir confirmar os vínculos poderia deixar
       * referências órfãs no banco.
       */
      throw new Error(
        'Não foi possível verificar os vínculos do policial antes da exclusão. ' +
        'Nenhuma alteração foi realizada.'
      )
    }

    if ((count ?? 0) > 0) {
      vinculos.push(item.descricao)
    }
  }

  return vinculos
}

export async function excluirPolicial(
  id
) {
  if (!id) {
    throw new Error(
      'Policial não informado.'
    )
  }

  const vinculos =
    await verificarVinculosExclusao(
      id
    )

  if (vinculos.length > 0) {
    throw new Error(
      'Este policial não pode ser excluído porque possui vínculo com: ' +
      vinculos.join(', ') +
      '. Altere a situação para INATIVO para preservar o histórico.'
    )
  }

  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .delete()
    .eq(
      'id',
      id
    )
    .select('id')
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data?.id) {
    throw new Error(
      'O policial não foi localizado ou não pôde ser excluído.'
    )
  }

  return data
}