import { supabase } from './supabaseClient'
import { loadSessionToken } from './authService'
import { listarMateriaisEmServicoUsuario } from './cautelasUsuarioService'

const TABLE_MAPA = 'sigmo_mapa_forca'
const TABLE_US = 'sigmo_mapa_forca_us'
const TABLE_EFETIVO = 'sigmo_mapa_forca_efetivo'
const TABLE_CAUTELAS = 'sigmo_mapa_forca_cautelas'

function isoOuNull(valor) {
  if (!valor) return null
  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? null : data.toISOString()
}

function dataReferenciaLocal(valor) {
  if (!valor) return null

  if (typeof valor === 'string') {
    const correspondencia = valor.match(/^(\\d{4})-(\\d{2})-(\\d{2})/)
    if (correspondencia) {
      return `${correspondencia[1]}-${correspondencia[2]}-${correspondencia[3]}`
    }
  }

  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return null

  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(data)

  const ano = partes.find((parte) => parte.type === 'year')?.value
  const mes = partes.find((parte) => parte.type === 'month')?.value
  const dia = partes.find((parte) => parte.type === 'day')?.value

  return ano && mes && dia ? `${ano}-${mes}-${dia}` : null
}

function cabecalhoMapa({ inicio, fim, user }) {
  const inicioIso = isoOuNull(inicio)
  const fimIso = isoOuNull(fim)

  if (!inicioIso || !fimIso) {
    throw new Error('Informe corretamente o início e o término do turno.')
  }

  if (new Date(fimIso) <= new Date(inicioIso)) {
    throw new Error('O término do turno deve ser posterior ao início.')
  }

  return {
    data_referencia: dataReferenciaLocal(inicio),
    inicio_turno: inicioIso,
    fim_turno: fimIso,
    status: 'EM ELABORAÇÃO',
    criado_por: user?.id || null,
    criado_por_nome:
      user?.nome_guerra ||
      user?.nome ||
      user?.nome_completo ||
      user?.re ||
      'USUÁRIO',
    updated_at: new Date().toISOString()
  }
}

export async function carregarMapaEmElaboracao() {
  const { data: mapa, error } = await supabase
    .from(TABLE_MAPA)
    .select('*')
    .eq('status', 'EM ELABORAÇÃO')
    .order('data_referencia', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!mapa) return null

  const { data: unidades, error: erroUs } = await supabase
    .from(TABLE_US)
    .select('*, viatura:sigmo_viaturas!sigmo_mapa_forca_us_viatura_id_fkey(*), viatura_prevista:sigmo_viaturas!sigmo_mapa_forca_us_viatura_prevista_id_fkey(*)')
    .eq('mapa_id', mapa.id)
    .order('ordem', { ascending: true })

  if (erroUs) throw erroUs

  const { data: efetivo, error: erroEfetivo } = await supabase
    .from(TABLE_EFETIVO)
    .select('*, policial:policiais(*)')
    .eq('mapa_id', mapa.id)
    .order('ordem', { ascending: true })

  if (erroEfetivo) throw erroEfetivo

  return {
    mapa,
    unidades: unidades || [],
    efetivo: efetivo || []
  }
}

export async function salvarCabecalhoMapaForca({
  mapaId,
  inicio,
  fim,
  user
}) {
  const cabecalho = cabecalhoMapa({ inicio, fim, user })

  if (mapaId) {
    const { error } = await supabase
      .from(TABLE_MAPA)
      .update(cabecalho)
      .eq('id', mapaId)

    if (error) throw error
    return mapaId
  }

  const { data, error } = await supabase
    .from(TABLE_MAPA)
    .insert(cabecalho)
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

export async function salvarUSMapaForca({
  mapaId,
  inicio,
  fim,
  user,
  grupo,
  unidade,
  ordem = 0
}) {
  if (!grupo?.id || !unidade) {
    throw new Error('Selecione o tipo da US.')
  }

  const idMapa = await salvarCabecalhoMapaForca({
    mapaId,
    inicio,
    fim,
    user
  })

  const inicioUs = isoOuNull(unidade.inicioUs) || isoOuNull(inicio)
  const fimUs = isoOuNull(unidade.fimUs) || isoOuNull(fim)

  if (!inicioUs || !fimUs || new Date(fimUs) <= new Date(inicioUs)) {
    throw new Error(`O término da US "${unidade.prefixo || grupo.titulo}" deve ser posterior ao início.`)
  }

  const payload = {
    mapa_id: idMapa,
    grupo_id: grupo.id,
    grupo_titulo: grupo.titulo,
    prefixo: String(unidade.prefixo || grupo.titulo).trim().toUpperCase(),
    tipo: unidade.tipo,
    ordem,
    viatura_id: unidade.viatura?.id || null,
    vtr_diferente_escala: Boolean(unidade.vtrDiferenteEscala),
    viatura_prevista_id: unidade.vtrDiferenteEscala ? (unidade.viaturaPrevista?.id || null) : null,
    motivo_troca_vtr: unidade.vtrDiferenteEscala ? String(unidade.motivoTrocaVtr || '').trim().toUpperCase() : null,
    criada_manualmente: true,
    inicio_us: inicioUs,
    fim_us: fimUs,
    updated_at: new Date().toISOString()
  }

  let usId = unidade.persistido ? unidade.id : null

  if (usId) {
    const { error } = await supabase
      .from(TABLE_US)
      .update(payload)
      .eq('id', usId)
      .eq('mapa_id', idMapa)

    if (error) throw error

    const { error: erroLimparEfetivo } = await supabase
      .from(TABLE_EFETIVO)
      .delete()
      .eq('us_id', usId)

    if (erroLimparEfetivo) throw erroLimparEfetivo
  } else {
    const { data, error } = await supabase
      .from(TABLE_US)
      .insert(payload)
      .select('id')
      .single()

    if (error) throw error
    usId = data.id
  }

  const efetivo = Object.entries(unidade.policiais || {})
    .filter(([, policial]) => policial?.id)
    .map(([funcao, policial], indice) => ({
      mapa_id: idMapa,
      us_id: usId,
      policial_id: policial.id,
      funcao,
      ordem: indice
    }))

  if (efetivo.length) {
    const { error } = await supabase
      .from(TABLE_EFETIVO)
      .insert(efetivo)

    if (error) throw error
  }

  return { mapaId: idMapa, usId }
}

export async function excluirUSMapaForca({ mapaId, usId }) {
  if (!mapaId || !usId) return

  const { error } = await supabase
    .from(TABLE_US)
    .delete()
    .eq('id', usId)
    .eq('mapa_id', mapaId)

  if (error) throw error
}


function normalizarStatusCautela(valor) {
  return String(valor || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
}

function statusCautelaMapa({
  statusMovimentacao = '',
  statusMunicoes = []
}) {
  const principal =
    normalizarStatusCautela(
      statusMovimentacao
    )

  const municoes =
    (statusMunicoes || [])
      .map(
        normalizarStatusCautela
      )
      .filter(Boolean)

  const todosStatus = [
    principal,
    ...municoes
  ].filter(Boolean)

  if (
    todosStatus.length > 0 &&
    todosStatus.every(
      (status) =>
        [
          'CANCELADA',
          'CANCELADO'
        ].includes(status)
    )
  ) {
    return 'CANCELADA'
  }

  if (
    todosStatus.some(
      (status) =>
        [
          'PENDENTE',
          'AGUARDANDO_RECEBIMENTO',
          'AGUARDANDO_RECEBIMENTO_USUARIO',
          'EM_ANDAMENTO'
        ].includes(status)
    )
  ) {
    return 'AGUARDANDO_RECEBIMENTO'
  }

  if (
    todosStatus.some(
      (status) =>
        [
          'RECEBIDA',
          'RECEBIDO',
          'CONCLUIDA',
          'CONCLUIDO',
          'EM_SERVICO'
        ].includes(status)
    )
  ) {
    return 'RECEBIDA'
  }

  return (
    principal ||
    municoes[0] ||
    'PAGO'
  )
}

function itemResumoEhMunicao(item) {
  const campos = [
    item?.modulo,
    item?.categoria,
    item?.tipo,
    item?.tabela_origem
  ]
    .map(normalizarStatusCautela)
    .filter(Boolean)

  return Boolean(
    item?.municao_id ||
    campos.includes('MUNICAO') ||
    campos.includes('MUNICOES') ||
    campos.includes('SIGMO_MUNICOES')
  )
}

function obterMovimentacaoCautelaAtual(item) {
  return String(
    item?.movimentacao_cautela_id ||
    item?.movimentacao_principal_id ||
    ''
  ).trim()
}

function itemAtualCorrespondeResumo({
  atual,
  resumo,
  movimentacaoPrincipalId
}) {
  if (!atual || !resumo) {
    return false
  }

  const patrimonioResumo =
    String(
      resumo?.patrimonio_id ||
      ''
    ).trim()

  const patrimonioAtual =
    String(
      atual?.patrimonio_id ||
      atual?.id ||
      ''
    ).trim()

  const referenciaResumo =
    String(
      resumo?.referencia_id ||
      ''
    ).trim()

  const referenciaAtual =
    String(
      atual?.referencia_id ||
      atual?.tonfa_id ||
      ''
    ).trim()

  const mesmoMaterial =
    (
      patrimonioResumo &&
      patrimonioAtual &&
      patrimonioResumo === patrimonioAtual
    ) ||
    (
      referenciaResumo &&
      referenciaAtual &&
      referenciaResumo === referenciaAtual
    )

  if (!mesmoMaterial) {
    return false
  }

  const principal =
    String(
      movimentacaoPrincipalId ||
      ''
    ).trim()

  const movimentacaoAtual =
    obterMovimentacaoCautelaAtual(
      atual
    )

  /*
   * Quando o material já foi devolvido e cautelado novamente,
   * ele pode voltar a estar com o mesmo policial. Nesse caso a
   * cautela antiga do Mapa Força não pode renascer. Se o serviço
   * conseguiu identificar a movimentação atual, o vínculo precisa
   * ser exatamente o mesmo.
   */
  if (
    principal &&
    movimentacaoAtual &&
    principal !== movimentacaoAtual
  ) {
    return false
  }

  return true
}

async function carregarMateriaisAtuaisPorPolicial(
  lista
) {
  const policiais =
    Array.from(
      new Map(
        (lista || [])
          .filter(
            (item) =>
              item?.policial_id
          )
          .map(
            (item) => [
              String(
                item.policial_id
              ),
              {
                id:
                  item.policial_id,
                policial_id:
                  item.policial_id,
                re:
                  item.policial_re ||
                  null,
                policial_re:
                  item.policial_re ||
                  null,
                nome:
                  item.policial_nome ||
                  null,
                nome_guerra:
                  item.policial_nome ||
                  null
              }
            ]
          )
      ).entries()
    )

  const resultado =
    new Map()

  await Promise.all(
    policiais.map(
      async ([id, policial]) => {
        try {
          const materiais =
            await listarMateriaisEmServicoUsuario(
              policial
            )

          resultado.set(
            id,
            {
              consultado: true,
              materiais:
                Array.isArray(
                  materiais
                )
                  ? materiais
                  : []
            }
          )
        } catch (error) {
          /*
           * Perfis somente-leitura podem não ter acesso a todas as
           * fontes patrimoniais. Não derruba o Mapa Força: nesses
           * casos mantemos o comportamento histórico como fallback.
           */
          console.warn(
            `Não foi possível confirmar a posse atual dos materiais de ${policial?.re || id}:`,
            error
          )

          resultado.set(
            id,
            {
              consultado: false,
              materiais: []
            }
          )
        }
      }
    )
  )

  return resultado
}

async function carregarMunicoesAtivasPorMovimentacao({
  idsMovimentacao
}) {
  const ids =
    Array.from(
      new Set(
        (idsMovimentacao || [])
          .map(
            (id) =>
              String(id || '')
                .trim()
          )
          .filter(Boolean)
      )
    )

  if (ids.length === 0) {
    return {
      consultado: true,
      chaves: new Set()
    }
  }

  try {
    const {
      data,
      error
    } = await supabase
      .from(
        'sigmo_municoes_cautelas'
      )
      .select(
        'movimentacao_principal_id, policial_id, municao_id, status, saldo'
      )
      .in(
        'movimentacao_principal_id',
        ids
      )
      .eq(
        'status',
        'EM_SERVICO'
      )
      .gt(
        'saldo',
        0
      )

    if (error) {
      throw error
    }

    const chaves =
      new Set(
        (data || []).map(
          (item) => [
            item?.movimentacao_principal_id,
            item?.policial_id,
            item?.municao_id
          ]
            .map(
              (valor) =>
                String(
                  valor || ''
                ).trim()
            )
            .join(':')
        )
      )

    return {
      consultado: true,
      chaves
    }
  } catch (error) {
    console.warn(
      'Não foi possível confirmar as cautelas atuais de munição do Mapa Força:',
      error
    )

    return {
      consultado: false,
      chaves: new Set()
    }
  }
}

function cautelaRecebidaContinuaAtiva({
  vinculo,
  materiaisAtuais,
  municoesAtivas
}) {
  const resumo =
    Array.isArray(
      vinculo?.resumo_itens
    )
      ? vinculo.resumo_itens
      : []

  /*
   * Vínculos antigos sem resumo não possuem informação suficiente
   * para provar que foram devolvidos. Preserva o comportamento
   * anterior em vez de ocultar uma cautela válida por engano.
   */
  if (resumo.length === 0) {
    return null
  }

  const policialId =
    String(
      vinculo?.policial_id ||
      ''
    ).trim()

  const principal =
    String(
      vinculo
        ?.movimentacao_principal_id ||
      ''
    ).trim()

  let algumDeterminavel =
    false

  for (const item of resumo) {
    if (itemResumoEhMunicao(item)) {
      if (
        !principal ||
        !municoesAtivas?.consultado
      ) {
        continue
      }

      const municaoId =
        String(
          item?.municao_id ||
          item?.referencia_id ||
          ''
        ).trim()

      if (!municaoId) {
        continue
      }

      algumDeterminavel =
        true

      const chave = [
        principal,
        policialId,
        municaoId
      ].join(':')

      if (
        municoesAtivas.chaves.has(
          chave
        )
      ) {
        return true
      }

      continue
    }

    const atualDoPolicial =
      materiaisAtuais.get(
        policialId
      )

    if (
      !atualDoPolicial
        ?.consultado
    ) {
      continue
    }

    algumDeterminavel =
      true

    if (
      atualDoPolicial.materiais.some(
        (atual) =>
          itemAtualCorrespondeResumo({
            atual,
            resumo: item,
            movimentacaoPrincipalId:
              principal
          })
      )
    ) {
      return true
    }
  }

  return algumDeterminavel
    ? false
    : null
}

export async function registrarCautelaMapaForca({
  mapaId,
  usId = null,
  policial,
  funcao = '',
  prefixoUs = '',
  movimentacaoPrincipalId = null,
  transferenciasMunicaoIds = [],
  resumoItens = [],
  quantidadeItens = 0
}) {
  if (!mapaId) {
    throw new Error(
      'O Mapa Força precisa estar identificado antes de vincular a cautela.'
    )
  }

  if (!policial?.id) {
    throw new Error(
      'Policial não identificado para vincular a cautela ao Mapa Força.'
    )
  }

  const idsMunicao =
    Array.from(
      new Set(
        (transferenciasMunicaoIds || [])
          .map((id) =>
            String(id || '').trim()
          )
          .filter(Boolean)
      )
    )

  if (
    !movimentacaoPrincipalId &&
    idsMunicao.length === 0
  ) {
    throw new Error(
      'A cautela foi criada, mas não possui identificador para vínculo com o Mapa Força.'
    )
  }

  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada.'
    )
  }

  const usIdValido =
    usId &&
    !String(usId).startsWith('nova-')
      ? usId
      : null

  const {
    data,
    error
  } =
    await supabase.rpc(
      'sigmo_mapa_forca_registrar_cautela',
      {
        p_token:
          token,

        p_mapa_id:
          mapaId,

        p_us_id:
          usIdValido,

        p_policial_id:
          policial.id,

        p_policial_re:
          policial.re ||
          null,

        p_policial_nome:
          policial.nome_guerra ||
          policial.nome ||
          policial.nome_completo ||
          null,

        p_funcao:
          String(funcao || '')
            .trim()
            .toUpperCase() ||
          null,

        p_prefixo_us:
          String(prefixoUs || '')
            .trim()
            .toUpperCase() ||
          null,

        p_movimentacao_principal_id:
          movimentacaoPrincipalId ||
          null,

        p_transferencias_municao_ids:
          idsMunicao,

        p_resumo_itens:
          Array.isArray(resumoItens)
            ? resumoItens
            : [],

        p_quantidade_itens:
          Math.max(
            0,
            Number(
              quantidadeItens ||
              0
            ) || 0
          )
      }
    )

  if (error) {
    throw error
  }

  const id =
    typeof data === 'string'
      ? data
      : (
          data?.id ||
          data?.cautela_id ||
          null
        )

  if (!id) {
    throw new Error(
      'O SIGMO não retornou o identificador do vínculo da cautela com o Mapa Força.'
    )
  }

  return id
}

export async function vincularCautelasPendentesAUS({
  mapaId,
  usId,
  unidade
}) {
  if (!mapaId || !usId || !unidade) {
    return
  }

  /*
   * Só existe cautela sem us_id quando o pagamento foi feito
   * enquanto a US ainda era um rascunho "nova-<timestamp>".
   *
   * Em uma US já persistida, registrarCautelaMapaForca recebe
   * o UUID real e grava o vínculo diretamente.
   */
  const idRascunho =
    String(
      unidade?.id ||
      ''
    )

  if (
    !idRascunho.startsWith(
      'nova-'
    )
  ) {
    return
  }

  const criadaEmMs =
    Number(
      idRascunho.replace(
        /^nova-/,
        ''
      )
    )

  if (
    !Number.isFinite(criadaEmMs) ||
    criadaEmMs <= 0
  ) {
    throw new Error(
      'Não foi possível identificar quando a nova US foi iniciada.'
    )
  }

  const criadaDesde =
    new Date(
      criadaEmMs
    ).toISOString()

  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada.'
    )
  }

  const policiais =
    Object.entries(
      unidade.policiais || {}
    )
      .filter(
        ([, policial]) =>
          policial?.id
      )

  for (
    const [
      funcao,
      policial
    ] of policiais
  ) {
    const {
      error
    } =
      await supabase.rpc(
        'sigmo_mapa_forca_vincular_cautelas_us',
        {
          p_token:
            token,

          p_mapa_id:
            mapaId,

          p_us_id:
            usId,

          p_policial_id:
            policial.id,

          p_funcao:
            String(funcao || '')
              .trim()
              .toUpperCase(),

          p_criada_desde:
            criadaDesde
        }
      )

    if (error) {
      throw error
    }
  }
}

export async function listarCautelasMapaForca({
  mapaId
}) {
  if (!mapaId) {
    return []
  }

  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada.'
    )
  }

  const {
    data: vinculos,
    error
  } =
    await supabase.rpc(
      'sigmo_mapa_forca_listar_cautelas',
      {
        p_token:
          token,

        p_mapa_id:
          mapaId
      }
    )

  if (error) {
    throw error
  }

  const lista =
    Array.isArray(vinculos)
      ? vinculos
      : []

  if (lista.length === 0) {
    return []
  }

  const idsMovimentacao =
    Array.from(
      new Set(
        lista
          .map(
            (item) =>
              item
                ?.movimentacao_principal_id
          )
          .filter(Boolean)
      )
    )

  const idsMunicoes =
    Array.from(
      new Set(
        lista.flatMap(
          (item) =>
            Array.isArray(
              item
                ?.transferencias_municao_ids
            )
              ? item
                  .transferencias_municao_ids
              : []
        )
      )
    )

  const statusMovimentacoes =
    new Map()

  const statusMunicoes =
    new Map()

  if (
    idsMovimentacao.length > 0
  ) {
    const {
      data,
      error:
        erroMovimentacoes
    } =
      await supabase.rpc(
        'sigmo_mapa_forca_status_movimentacoes',
        {
          p_token:
            token,

          p_ids:
            idsMovimentacao
        }
      )

    if (erroMovimentacoes) {
      throw erroMovimentacoes
    }

    for (
      const registro of
      data || []
    ) {
      statusMovimentacoes.set(
        String(registro.id),
        registro.status
      )
    }
  }

  if (
    idsMunicoes.length > 0
  ) {
    const {
      data,
      error:
        erroMunicoes
    } =
      await supabase.rpc(
        'sigmo_mapa_forca_status_municoes',
        {
          p_token:
            token,

          p_ids:
            idsMunicoes
        }
      )

    if (erroMunicoes) {
      throw erroMunicoes
    }

    for (
      const registro of
      data || []
    ) {
      statusMunicoes.set(
        String(registro.id),
        registro.status
      )
    }
  }

  const statusBase =
    lista.map(
      (item) => {
        const idsTransferencias =
          Array.isArray(
            item
              ?.transferencias_municao_ids
          )
            ? item
                .transferencias_municao_ids
            : []

        const statusAtual =
          statusCautelaMapa({
            statusMovimentacao:
              item
                ?.movimentacao_principal_id
                ? statusMovimentacoes.get(
                    String(
                      item
                        .movimentacao_principal_id
                    )
                  ) || ''
                : '',

            statusMunicoes:
              idsTransferencias.map(
                (id) =>
                  statusMunicoes.get(
                    String(id)
                  ) || ''
              )
          })

        return {
          item,
          statusAtual
        }
      }
    )

  const recebidas =
    statusBase
      .filter(
        (registro) =>
          registro.statusAtual ===
          'RECEBIDA'
      )
      .map(
        (registro) =>
          registro.item
      )

  const [
    materiaisAtuais,
    municoesAtivas
  ] = await Promise.all([
    carregarMateriaisAtuaisPorPolicial(
      recebidas
    ),

    carregarMunicoesAtivasPorMovimentacao({
      idsMovimentacao:
        recebidas.map(
          (item) =>
            item
              ?.movimentacao_principal_id
        )
    })
  ])

  return statusBase.map(
    ({ item, statusAtual }) => {
      if (
        statusAtual ===
        'CANCELADA'
      ) {
        return {
          ...item,
          status_atual:
            'CANCELADA',
          ativa: false
        }
      }

      if (
        statusAtual ===
        'AGUARDANDO_RECEBIMENTO'
      ) {
        return {
          ...item,
          status_atual:
            statusAtual,
          ativa: true
        }
      }

      if (
        statusAtual ===
        'RECEBIDA'
      ) {
        const continuaAtiva =
          cautelaRecebidaContinuaAtiva({
            vinculo: item,
            materiaisAtuais,
            municoesAtivas
          })

        if (
          continuaAtiva === false
        ) {
          return {
            ...item,
            status_atual:
              'ENCERRADA',
            ativa: false
          }
        }

        return {
          ...item,
          status_atual:
            statusAtual,
          ativa: true
        }
      }

      return {
        ...item,
        status_atual:
          statusAtual,
        ativa: true
      }
    }
  )
}


// Mantida por compatibilidade com a etapa anterior.
export async function salvarMapaForca({ mapaId, inicio, fim, user, grupos }) {
  const id = await salvarCabecalhoMapaForca({ mapaId, inicio, fim, user })

  const { error: erroLimpeza } = await supabase
    .from(TABLE_US)
    .delete()
    .eq('mapa_id', id)

  if (erroLimpeza) throw erroLimpeza

  let ordem = 0
  for (const grupo of grupos || []) {
    for (const unidade of grupo.unidades || []) {
      await salvarUSMapaForca({
        mapaId: id,
        inicio,
        fim,
        user,
        grupo,
        unidade: { ...unidade, persistido: false },
        ordem
      })
      ordem += 1
    }
  }

  return id
}
