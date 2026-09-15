import { supabase } from './supabaseClient'
import { loadSessionToken } from './authService'
import { criarOuAtualizarPatrimonio } from './patrimoniosService'
import { criarNotificacaoParaPerfil } from './notificacoesService'
import { listarResumoMunicoes } from './municoesService'
import {
  buscarPatrimonioPorReferencia,
  buscarMovimentacaoPorId,
  cancelarMovimentacao,
  concluirMovimentacao,
  listarMovimentacoesPendentes,
  registrarMovimentacao,
  STATUS_MOVIMENTACAO,
  TIPOS_MOVIMENTACAO
} from './patrimonioMovimentacaoService'

const TABLE_MUNICOES = 'sigmo_municoes'
const TABLE_LOTES = 'sigmo_municoes_lotes'
const TABLE_CAUTELAS = 'sigmo_municoes_cautelas'
const TABLE_MOVIMENTACOES = 'sigmo_municoes_movimentacoes'
const BUCKET_FOTOS_MANUTENCAO = 'manutencoes-fotos'

export const STATUS_CAUTELA_MUNICAO = {
  EM_SERVICO: 'EM_SERVICO',
  DEVOLVIDA: 'DEVOLVIDA',
  CONSUMIDA: 'CONSUMIDA',
  ENCERRADA: 'ENCERRADA',
  CANCELADA: 'CANCELADA'
}

function texto(valor) {
  return String(valor ?? '').trim()
}

function maiusculo(valor) {
  return texto(valor).toUpperCase()
}

function numeroInteiro(valor) {
  const numero = Number(valor)

  if (!Number.isFinite(numero)) {
    return 0
  }

  return Math.max(0, Math.trunc(numero))
}

function somenteNumeros(valor) {
  return texto(valor).replace(/\D/g, '')
}

function normalizarRe(valor) {
  return somenteNumeros(valor).slice(0, 6)
}

function nomeUsuario(user) {
  return (
    user?.nome ||
    user?.nome_guerra ||
    user?.nome_completo ||
    user?.user_metadata?.nome ||
    user?.user_metadata?.full_name ||
    user?.email ||
    'USUÁRIO SIGMO'
  )
}

function nomePolicial(policial) {
  return (
    policial?.nome_guerra ||
    policial?.nome ||
    policial?.nome_completo ||
    null
  )
}

function idPolicial(policial) {
  return (
    policial?.id ||
    policial?.policial_id ||
    null
  )
}

function rePolicial(policial) {
  return (
    policial?.re ||
    policial?.policial_re ||
    null
  )
}

async function buscarMunicao({
  municaoId = null,
  calibre = ''
} = {}) {
  if (
    !municaoId &&
    !texto(calibre)
  ) {
    throw new Error(
      'Informe o calibre da munição.'
    )
  }

  /*
   * Usa a mesma RPC segura que alimenta a tela de Munições.
   * A leitura direta de sigmo_municoes pode ser bloqueada pelo RLS
   * para o perfil SVDD, fazendo um calibre existente parecer inexistente.
   */
  const lista =
    await listarResumoMunicoes({
      somenteAtivas: true
    })

  const calibreNormalizado =
    maiusculo(calibre)

  const data =
    (lista || []).find(
      (item) =>
        municaoId
          ? String(item?.id || '') ===
            String(municaoId)
          : maiusculo(
              item?.calibre
            ) === calibreNormalizado
    ) || null

  if (!data?.id) {
    throw new Error(
      'Calibre de munição não localizado.'
    )
  }

  return data
}

async function listarLotesDisponiveis({
  municaoId,
  campoSaldo
}) {
  let query = supabase
    .from(TABLE_LOTES)
    .select('*')
    .eq('municao_id', municaoId)
    .eq('ativo', true)
    .gt(campoSaldo, 0)

  /*
   * O lote é escolhido internamente.
   * Prioriza validade mais próxima e, depois,
   * os lotes cadastrados há mais tempo.
   */
  query = query
    .order('validade', {
      ascending: true,
      nullsFirst: false
    })
    .order('criado_em', {
      ascending: true
    })

  const { data, error } = await query

  if (error) {
    throw error
  }

  return data || []
}

async function registrarHistorico({
  municaoId,
  loteId = null,
  cautelaId = null,
  movimentacaoPrincipalId = null,
  tipoMovimentacao,
  origem = null,
  destino = null,
  quantidade,
  policial = null,
  documento = null,
  observacoes = null,
  user = null
}) {
  const valor =
    numeroInteiro(quantidade)

  if (valor <= 0) {
    throw new Error(
      'A quantidade da movimentação deve ser maior que zero.'
    )
  }

  const payload = {
    municao_id:
      municaoId,

    lote_id:
      loteId,

    cautela_id:
      cautelaId,

    movimentacao_principal_id:
      movimentacaoPrincipalId,

    tipo_movimentacao:
      maiusculo(tipoMovimentacao),

    origem:
      origem ? maiusculo(origem) : null,

    destino:
      destino ? maiusculo(destino) : null,

    quantidade:
      valor,

    policial_id:
      idPolicial(policial),

    policial_re:
      rePolicial(policial),

    policial_nome:
      nomePolicial(policial),

    documento:
      texto(documento)
        ? maiusculo(documento)
        : null,

    observacoes:
      texto(observacoes)
        ? maiusculo(observacoes)
        : null,

    registrado_por_id:
      user?.id || null,

    registrado_por_nome:
      nomeUsuario(user)
  }

  const { data, error } = await supabase
    .from(TABLE_MOVIMENTACOES)
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data
}

async function atualizarSaldoLote({
  lote,
  campoOrigem,
  campoDestino = null,
  quantidade
}) {
  const valor =
    numeroInteiro(quantidade)

  const saldoOrigem =
    numeroInteiro(
      lote?.[campoOrigem]
    )

  if (valor <= 0) {
    throw new Error(
      'A quantidade deve ser maior que zero.'
    )
  }

  if (valor > saldoOrigem) {
    throw new Error(
      'O lote não possui saldo suficiente para esta movimentação.'
    )
  }

  const payload = {
    [campoOrigem]:
      saldoOrigem - valor
  }

  if (campoDestino) {
    payload[campoDestino] =
      numeroInteiro(
        lote?.[campoDestino]
      ) + valor
  }

  const { data, error } = await supabase
    .from(TABLE_LOTES)
    .update(payload)
    .eq('id', lote.id)
    /*
     * Controle otimista: se outro operador alterar
     * o saldo entre leitura e gravação, a operação
     * não deve consumir um saldo antigo.
     */
    .eq(
      campoOrigem,
      saldoOrigem
    )
    .select('*')
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data?.id) {
    throw new Error(
      'O estoque foi alterado por outra operação. Atualize a tela e tente novamente.'
    )
  }

  return data
}

async function restaurarSaldoLote({
  loteId,
  valores
}) {
  try {
    await supabase
      .from(TABLE_LOTES)
      .update(valores)
      .eq('id', loteId)
  } catch (error) {
    console.error(
      'Falha ao restaurar saldo de lote de munição:',
      error
    )
  }
}

async function apagarRegistro({
  tabela,
  id
}) {
  if (!id) return

  try {
    await supabase
      .from(tabela)
      .delete()
      .eq('id', id)
  } catch (error) {
    console.error(
      `Falha ao remover registro de rollback em ${tabela}:`,
      error
    )
  }
}

async function movimentarEntreEstoques({
  municaoId = null,
  calibre = '',
  quantidade,
  campoOrigem,
  campoDestino,
  origem,
  destino,
  tipoMovimentacao,
  documento = null,
  observacoes = null,
  user = null
}) {
  const valor =
    numeroInteiro(quantidade)

  if (valor <= 0) {
    throw new Error(
      'Informe uma quantidade maior que zero.'
    )
  }

  const municao =
    await buscarMunicao({
      municaoId,
      calibre
    })

  const lotes =
    await listarLotesDisponiveis({
      municaoId: municao.id,
      campoSaldo: campoOrigem
    })

  const totalDisponivel =
    lotes.reduce(
      (total, lote) =>
        total +
        numeroInteiro(
          lote?.[campoOrigem]
        ),
      0
    )

  if (valor > totalDisponivel) {
    throw new Error(
      `Existem apenas ${totalDisponivel} unidade(s) de ${maiusculo(municao.calibre)} disponíveis em ${origem}.`
    )
  }

  const processados = []
  let restante = valor

  try {
    for (const lote of lotes) {
      if (restante <= 0) {
        break
      }

      const saldo =
        numeroInteiro(
          lote?.[campoOrigem]
        )

      if (saldo <= 0) {
        continue
      }

      const quantidadeLote =
        Math.min(
          saldo,
          restante
        )

      const loteAtualizado =
        await atualizarSaldoLote({
          lote,
          campoOrigem,
          campoDestino,
          quantidade:
            quantidadeLote
        })

      const historico =
        await registrarHistorico({
          municaoId:
            municao.id,

          loteId:
            lote.id,

          tipoMovimentacao,

          origem,
          destino,

          quantidade:
            quantidadeLote,

          documento,
          observacoes,
          user
        })

      processados.push({
        lote,
        loteAtualizado,
        historico,
        quantidade:
          quantidadeLote
      })

      restante -=
        quantidadeLote
    }

    if (restante > 0) {
      throw new Error(
        'Não foi possível completar a movimentação com os lotes disponíveis.'
      )
    }

    return {
      municao,
      quantidade:
        valor,
      lotes:
        processados.map(
          (item) => ({
            lote_id:
              item.lote.id,
            numero_lote:
              item.lote.numero_lote,
            quantidade:
              item.quantidade
          })
        )
    }
  } catch (error) {
    for (
      const item of
      [...processados].reverse()
    ) {
      await apagarRegistro({
        tabela:
          TABLE_MOVIMENTACOES,
        id:
          item.historico?.id
      })

      await restaurarSaldoLote({
        loteId:
          item.lote.id,
        valores: {
          [campoOrigem]:
            item.lote[campoOrigem],
          [campoDestino]:
            item.lote[campoDestino]
        }
      })
    }

    throw error
  }
}


function dadosMovimentacaoPatrimonial(movimentacao) {
  return (
    movimentacao?.dados ||
    movimentacao?.metadata?.dados_engine ||
    {}
  )
}

function origemMovimentacaoPatrimonial(movimentacao) {
  const dados = dadosMovimentacaoPatrimonial(movimentacao)

  return maiusculo(
    movimentacao?.origem_guardiao_codigo ||
    movimentacao?.metadata?.guardiao_origem?.codigo ||
    dados?.guardiao_origem?.codigo ||
    dados?.origem_codigo ||
    ''
  )
}

function destinoMovimentacaoPatrimonial(movimentacao) {
  const dados = dadosMovimentacaoPatrimonial(movimentacao)

  return maiusculo(
    movimentacao?.destino_guardiao_codigo ||
    movimentacao?.metadata?.guardiao_destino?.codigo ||
    dados?.guardiao_destino?.codigo ||
    dados?.destino_codigo ||
    ''
  )
}

function ehTransferenciaManutencaoMunicao(movimentacao) {
  const dados = dadosMovimentacaoPatrimonial(movimentacao)

  return (
    maiusculo(dados?.modulo || dados?.categoria) === 'MUNICAO' &&
    dados?.manutencao_em_transferencia === true &&
    origemMovimentacaoPatrimonial(movimentacao) === 'SVDD' &&
    destinoMovimentacaoPatrimonial(movimentacao) === 'P4'
  )
}

async function buscarManutencaoMunicaoAtiva(manutencaoId) {
  if (!manutencaoId) {
    throw new Error('Manutenção de munição não informada.')
  }

  const { data, error } = await supabase
    .from('sigmo_manutencoes')
    .select('*')
    .eq('id', manutencaoId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data?.id) {
    throw new Error('Manutenção de munição não localizada.')
  }

  if (maiusculo(data.modulo) !== 'MUNICAO') {
    throw new Error('O registro informado não pertence ao módulo de Munições.')
  }

  if (maiusculo(data.status) !== 'EM_MANUTENCAO') {
    throw new Error('Somente manutenção ativa pode ser encaminhada ao P4.')
  }

  const origem = maiusculo(data.origem)

  if (
    !origem.includes('SVDD') &&
    !origem.includes('SERVICO DE DIA') &&
    !origem.includes('SERVIÇO DE DIA')
  ) {
    throw new Error('Esta manutenção não está atualmente sob responsabilidade do SVDD.')
  }

  return data
}

export async function criarTransferenciaManutencaoMunicaoPendente({
  manutencaoId,
  quantidade,
  observacoes = null,
  user = null
}) {
  const valor = numeroInteiro(quantidade)

  if (valor <= 0) {
    throw new Error('Informe uma quantidade maior que zero.')
  }

  const manutencao =
    await buscarManutencaoMunicaoAtiva(
      manutencaoId
    )

  const quantidadeManutencao =
    numeroInteiro(
      manutencao.quantidade
    )

  if (valor > quantidadeManutencao) {
    throw new Error(
      `A manutenção possui apenas ${quantidadeManutencao} unidade(s) sob responsabilidade do SVDD.`
    )
  }

  const municaoId =
    manutencao.referencia_id

  if (!municaoId) {
    throw new Error('A manutenção não possui referência da munição.')
  }

  const municao =
    await buscarMunicao({
      municaoId
    })

  const pendentes =
    await listarMovimentacoesPendentes({
      limite: 500
    })

  const quantidadeJaPendente =
    (pendentes || [])
      .filter((item) => {
        const dados =
          dadosMovimentacaoPatrimonial(item)

        return (
          ehTransferenciaManutencaoMunicao(item) &&
          String(dados?.manutencao_id || '') ===
            String(manutencao.id)
        )
      })
      .reduce(
        (total, item) =>
          total +
          numeroInteiro(
            dadosMovimentacaoPatrimonial(item)
              ?.quantidade
          ),
        0
      )

  const quantidadeDisponivel =
    Math.max(
      0,
      quantidadeManutencao -
        quantidadeJaPendente
    )

  if (valor > quantidadeDisponivel) {
    throw new Error(
      `Existem apenas ${quantidadeDisponivel} unidade(s) desta manutenção disponíveis para encaminhamento ao P4.`
    )
  }

  /*
   * Munição é quantitativa. O patrimônio agregado por calibre serve
   * somente para a Engine/Central Operacional; o saldo real continua
   * controlado pelo módulo de Munições.
   *
   * Enquanto a movimentação estiver PENDENTE, NÃO alteramos
   * sigmo_manutencoes e NÃO movimentamos quantidade_svdd/quantidade_p4.
   */
  const patrimonio =
    await criarOuAtualizarPatrimonio({
      tipo: 'municao',
      referencia_id: municao.id,
      dados: {
        id: municao.id,
        municao_id: municao.id,
        calibre: maiusculo(municao.calibre),
        descricao:
          `MUNIÇÃO ${maiusculo(municao.calibre)}`,
        tipo_registro:
          'MUNICAO_QUANTIDADE',
        status_operacional:
          'MANUTENCAO',
        local_atual:
          'COFRE DO SVDD'
      },
      user,
      local_atual:
        'COFRE DO SVDD',
      companhia_atual:
        municao.unidade || ''
    })

  if (!patrimonio?.id) {
    throw new Error(
      'Não foi possível vincular a munição à Engine patrimonial.'
    )
  }

  const resultado =
    await registrarMovimentacao({
      patrimonioId:
        patrimonio.id,

      tipo:
        TIPOS_MOVIMENTACAO.TRANSFERENCIA,

      statusNovo:
        'MANUTENCAO',

      localDestino:
        'COFRE DO P4',

      companhiaDestino:
        municao.unidade || '',

      motivo:
        'ENCAMINHAMENTO_MANUTENCAO_SVDD_P4',

      observacao:
        texto(observacoes) ||
        `Encaminhamento de ${valor} munição(ões) ${maiusculo(municao.calibre)} em manutenção: SVDD → P4.`,

      dados: {
        modulo:
          'MUNICAO',

        categoria:
          'MUNICAO',

        municao_id:
          municao.id,

        referencia_id:
          municao.id,

        manutencao_id:
          manutencao.id,

        quantidade:
          valor,

        status_movimentacao:
          STATUS_MOVIMENTACAO.PENDENTE,

        preservar_status_operacional:
          true,

        status_operacional_origem:
          'MANUTENCAO',

        manutencao_em_transferencia:
          true,

        transferencia_manutencao_municao:
          true,

        guardiao_origem: {
          tipo:
            'SETOR',
          codigo:
            'SVDD',
          nome:
            'COFRE DO SVDD'
        },

        guardiao_destino: {
          tipo:
            'SETOR',
          codigo:
            'P4',
          nome:
            'COFRE DO P4'
        },

        local_origem:
          'COFRE DO SVDD',

        local_destino:
          'COFRE DO P4',

        calibre:
          maiusculo(municao.calibre)
      },

      user
    })

  /*
   * registrarMovimentacao atualiza o patrimônio agregado para o destino.
   * Como a transferência ainda aguarda aceite, restauramos apenas esse
   * espelho patrimonial. A manutenção real continua intacta no SVDD.
   */
  await criarOuAtualizarPatrimonio({
    tipo:
      'municao',

    referencia_id:
      municao.id,

    dados: {
      id:
        municao.id,
      municao_id:
        municao.id,
      calibre:
        maiusculo(municao.calibre),
      descricao:
        `MUNIÇÃO ${maiusculo(municao.calibre)}`,
      tipo_registro:
        'MUNICAO_QUANTIDADE',
      status_operacional:
        'MANUTENCAO',
      local_atual:
        'COFRE DO SVDD'
    },

    user,

    local_atual:
      'COFRE DO SVDD',

    companhia_atual:
      municao.unidade || ''
  })

  return {
    movimentacao:
      resultado?.movimentacao || null,

    manutencao,

    municao,

    quantidade:
      valor
  }
}

export async function listarTransferenciasManutencaoMunicaoPendentes({
  destinoCodigo = 'P4',
  limite = 200
} = {}) {
  const pendentes =
    await listarMovimentacoesPendentes({
      guardiaoCodigo:
        maiusculo(destinoCodigo),
      limite:
        Math.max(
          1,
          Math.min(
            Number(limite) || 200,
            500
          )
        )
    })

  return (pendentes || []).filter(
    ehTransferenciaManutencaoMunicao
  )
}

export async function aceitarTransferenciaManutencaoMunicao({
  movimentacaoId,
  user = null
}) {
  const movimentacao =
    await buscarMovimentacaoPorId(
      movimentacaoId
    )

  if (
    !movimentacao ||
    !ehTransferenciaManutencaoMunicao(
      movimentacao
    )
  ) {
    throw new Error(
      'Transferência de manutenção de munição não encontrada.'
    )
  }

  const dados =
    dadosMovimentacaoPatrimonial(
      movimentacao
    )

  const quantidade =
    numeroInteiro(
      dados?.quantidade ||
      movimentacao?.quantidade
    )

  if (quantidade <= 0) {
    throw new Error(
      'A transferência não possui quantidade válida.'
    )
  }

  const manutencao =
    await buscarManutencaoMunicaoAtiva(
      dados?.manutencao_id
    )

  const quantidadeOrigem =
    numeroInteiro(
      manutencao.quantidade
    )

  if (quantidade > quantidadeOrigem) {
    throw new Error(
      'A manutenção do SVDD não possui mais quantidade suficiente para concluir esta transferência.'
    )
  }

  const agora =
    new Date().toISOString()

  let manutencaoDestino =
    null

  let manutencaoOrigemAlterada =
    false

  try {
    if (quantidade === quantidadeOrigem) {
      const {
        data,
        error
      } = await supabase
        .from('sigmo_manutencoes')
        .update({
          origem:
            'COFRE DO P4',
          atualizado_em:
            agora,
          observacoes:
            [
              texto(
                manutencao.observacoes
              ),
              `RECEBIDA PELO P4 VIA TRANSFERÊNCIA ${movimentacaoId}`
            ]
              .filter(Boolean)
              .join(' | ')
        })
        .eq(
          'id',
          manutencao.id
        )
        .eq(
          'quantidade',
          quantidadeOrigem
        )
        .select('*')
        .maybeSingle()

      if (error) {
        throw error
      }

      if (!data?.id) {
        throw new Error(
          'A manutenção foi alterada por outra operação. Atualize e tente novamente.'
        )
      }

      manutencaoDestino =
        data

      manutencaoOrigemAlterada =
        true
    } else {
      const {
        data: origemAtualizada,
        error: erroOrigem
      } = await supabase
        .from('sigmo_manutencoes')
        .update({
          quantidade:
            quantidadeOrigem -
            quantidade,
          atualizado_em:
            agora
        })
        .eq(
          'id',
          manutencao.id
        )
        .eq(
          'quantidade',
          quantidadeOrigem
        )
        .select('*')
        .maybeSingle()

      if (erroOrigem) {
        throw erroOrigem
      }

      if (!origemAtualizada?.id) {
        throw new Error(
          'A manutenção foi alterada por outra operação. Atualize e tente novamente.'
        )
      }

      manutencaoOrigemAlterada =
        true

      const novaManutencao = {
        ...manutencao,
        id:
          undefined,
        quantidade,
        origem:
          'COFRE DO P4',
        criado_em:
          agora,
        atualizado_em:
          agora,
        observacoes:
          [
            texto(
              manutencao.observacoes
            ),
            `RECEBIDA PELO P4 VIA TRANSFERÊNCIA ${movimentacaoId}`,
            `MANUTENÇÃO DE ORIGEM: ${manutencao.id}`
          ]
            .filter(Boolean)
            .join(' | ')
      }

      delete novaManutencao.created_at
      delete novaManutencao.updated_at

      const {
        data: destinoCriado,
        error: erroDestino
      } = await supabase
        .from('sigmo_manutencoes')
        .insert(
          novaManutencao
        )
        .select('*')
        .single()

      if (erroDestino) {
        throw erroDestino
      }

      manutencaoDestino =
        destinoCriado
    }

    /*
     * O histórico específico de munições usa uma tabela protegida por RLS.
     * Em alguns perfis P4 a transferência patrimonial é permitida, mas o
     * INSERT direto em sigmo_municoes_movimentacoes é bloqueado (42501).
     *
     * A própria Engine patrimonial já mantém a trilha oficial desta
     * transferência (solicitação, aprovação do Cmt e recebimento pelo P4).
     * Portanto, neste fluxo específico, não podemos deixar uma limitação
     * de escrita do histórico auxiliar impedir a conclusão da custódia.
     */
    try {
      await registrarHistorico({
        municaoId:
          dados?.municao_id ||
          manutencao.referencia_id,

        tipoMovimentacao:
          'TRANSFERENCIA_MANUTENCAO',

        origem:
          'SVDD',

        destino:
          'P4',

        quantidade,

        observacoes:
          `MANUTENÇÃO RECEBIDA PELO P4 | MOVIMENTAÇÃO: ${movimentacaoId}`,

        user
      })
    } catch (historicoError) {
      const codigo =
        String(
          historicoError?.code ||
          ''
        )

      const mensagem =
        String(
          historicoError?.message ||
          historicoError ||
          ''
        ).toLowerCase()

      const bloqueioRls =
        codigo === '42501' ||
        mensagem.includes(
          'row-level security'
        ) ||
        mensagem.includes(
          'row level security'
        )

      if (!bloqueioRls) {
        throw historicoError
      }

      console.warn(
        'Histórico auxiliar de munições bloqueado por RLS; a transferência permanece auditada pela Engine patrimonial.',
        historicoError
      )
    }

    await concluirMovimentacao({
      movimentacaoId,

      observacao:
        `P4 recebeu ${quantidade} unidade(s) em manutenção do SVDD.`,

      user
    })

    const municao =
      await buscarMunicao({
        municaoId:
          dados?.municao_id ||
          manutencao.referencia_id
      })

    await criarOuAtualizarPatrimonio({
      tipo:
        'municao',

      referencia_id:
        municao.id,

      dados: {
        id:
          municao.id,
        municao_id:
          municao.id,
        calibre:
          maiusculo(
            municao.calibre
          ),
        descricao:
          `MUNIÇÃO ${maiusculo(municao.calibre)}`,
        tipo_registro:
          'MUNICAO_QUANTIDADE',
        status_operacional:
          'MANUTENCAO',
        local_atual:
          'COFRE DO P4'
      },

      user,

      local_atual:
        'COFRE DO P4',

      companhia_atual:
        municao.unidade || ''
    })

    return {
      manutencao:
        manutencaoDestino,

      quantidade,

      movimentacao_id:
        movimentacaoId
    }
  } catch (error) {
    /*
     * Rollback da divisão da manutenção. O histórico de munições é
     * registrado somente depois da alteração principal; se a conclusão
     * falhar, restauramos a quantidade/origem do registro original.
     */
    if (manutencaoDestino?.id &&
        String(manutencaoDestino.id) !==
          String(manutencao.id)) {
      await apagarRegistro({
        tabela:
          'sigmo_manutencoes',
        id:
          manutencaoDestino.id
      })
    }

    if (manutencaoOrigemAlterada) {
      try {
        await supabase
          .from('sigmo_manutencoes')
          .update({
            quantidade:
              quantidadeOrigem,
            origem:
              manutencao.origem,
            observacoes:
              manutencao.observacoes,
            atualizado_em:
              manutencao.atualizado_em
          })
          .eq(
            'id',
            manutencao.id
          )
      } catch (rollbackError) {
        console.error(
          'Falha ao restaurar manutenção de munição após erro no aceite:',
          rollbackError
        )
      }
    }

    throw error
  }
}

export async function recusarTransferenciaManutencaoMunicao({
  movimentacaoId,
  motivo,
  user = null
}) {
  const movimentacao =
    await buscarMovimentacaoPorId(
      movimentacaoId
    )

  if (
    !movimentacao ||
    !ehTransferenciaManutencaoMunicao(
      movimentacao
    )
  ) {
    throw new Error(
      'Transferência de manutenção de munição não encontrada.'
    )
  }

  await cancelarMovimentacao({
    movimentacaoId,

    motivo:
      texto(motivo) ||
      'TRANSFERÊNCIA DE MANUTENÇÃO RECUSADA PELO P4',

    user
  })

  /*
   * Nenhuma quantidade foi alterada durante a pendência.
   * Portanto, ao recusar, a manutenção simplesmente continua no SVDD.
   */
  return true
}



function ehSolicitacaoDescargaManutencaoMunicao(movimentacao) {
  const dados = dadosMovimentacaoPatrimonial(movimentacao)

  return (
    maiusculo(dados?.modulo || dados?.categoria) === 'MUNICAO' &&
    dados?.solicitacao_descarga_manutencao === true &&
    maiusculo(
      dados?.origem_codigo ||
      origemMovimentacaoPatrimonial(movimentacao)
    ) === 'P4'
  )
}

async function validarQuantidadeManutencaoP4({
  municaoId,
  quantidade
}) {
  const valor = numeroInteiro(quantidade)

  const municao =
    await buscarMunicao({
      municaoId
    })

  const { data, error } = await supabase
    .from('sigmo_manutencoes')
    .select('*')
    .eq('modulo', 'MUNICAO')
    .eq('referencia_id', municao.id)
    .eq('status', 'EM_MANUTENCAO')
    .order('criado_em', {
      ascending: true
    })

  if (error) throw error

  const manutencoesP4 =
    (data || [])
      .filter((item) =>
        maiusculo(item?.origem).includes('P4')
      )
      .filter((item) =>
        numeroInteiro(item?.quantidade) > 0
      )

  const totalManutencaoP4 =
    manutencoesP4.reduce(
      (total, item) =>
        total + numeroInteiro(item?.quantidade),
      0
    )

  if (valor > totalManutencaoP4) {
    throw new Error(
      `Existem apenas ${totalManutencaoP4} unidade(s) de ${maiusculo(municao.calibre)} em manutenção sob responsabilidade do P4.`
    )
  }

  return {
    municao,
    manutencoesP4,
    totalManutencaoP4
  }
}

async function efetivarDescargaManutencaoMunicaoP4({
  municaoId,
  quantidade,
  motivo,
  destinoFinal,
  documento = null,
  observacoes = null,
  movimentacaoId = null,
  user = null
}) {
  const valor = numeroInteiro(quantidade)
  const motivoFinal = maiusculo(motivo)
  const destinoFinalNormalizado = maiusculo(destinoFinal)

  const {
    municao,
    manutencoesP4
  } = await validarQuantidadeManutencaoP4({
    municaoId,
    quantidade: valor
  })

  const {
    data: lotesData,
    error: lotesError
  } = await supabase
    .from(TABLE_LOTES)
    .select('*')
    .eq('municao_id', municao.id)
    .eq('ativo', true)
    .gt('quantidade_manutencao', 0)
    .order('validade', {
      ascending: true,
      nullsFirst: false
    })
    .order('criado_em', {
      ascending: true
    })

  if (lotesError) throw lotesError

  const totalManutencaoLotes =
    (lotesData || []).reduce(
      (total, lote) =>
        total + numeroInteiro(lote?.quantidade_manutencao),
      0
    )

  if (valor > totalManutencaoLotes) {
    throw new Error(
      `O controle por lote possui apenas ${totalManutencaoLotes} unidade(s) em manutenção. Atualize os dados antes de aprovar a descarga.`
    )
  }

  const agora = new Date().toISOString()

  const detalheDescarga = [
    'DESCARGA DE MUNIÇÃO APROVADA PELO CMT DE CIA',
    movimentacaoId ? `MOVIMENTAÇÃO: ${movimentacaoId}` : null,
    `MOTIVO: ${motivoFinal}`,
    `DESTINO FINAL: ${destinoFinalNormalizado}`,
    texto(documento)
      ? `DOCUMENTO: ${maiusculo(documento)}`
      : null,
    texto(observacoes)
      ? `OBSERVAÇÕES: ${maiusculo(observacoes)}`
      : null,
    `APROVADO POR: ${maiusculo(nomeUsuario(user))}`
  ]
    .filter(Boolean)
    .join(' | ')

  const manutencoesAlteradas = []
  const manutencoesCriadas = []
  const lotesAlterados = []

  let restanteManutencao = valor
  let restanteLotes = valor

  try {
    for (const manutencao of manutencoesP4) {
      if (restanteManutencao <= 0) break

      const quantidadeAtual =
        numeroInteiro(manutencao?.quantidade)

      const descarregar =
        Math.min(
          quantidadeAtual,
          restanteManutencao
        )

      if (descarregar <= 0) continue

      const observacoesDescarga =
        [
          texto(manutencao?.observacoes) || null,
          detalheDescarga
        ]
          .filter(Boolean)
          .join(' | ')

      if (descarregar === quantidadeAtual) {
        const {
          data: manutencaoAtualizada,
          error
        } = await supabase
          .from('sigmo_manutencoes')
          .update({
            destino: 'DESCARGA',
            status: 'CONCLUIDA',
            observacoes: observacoesDescarga,
            atualizado_em: agora
          })
          .eq('id', manutencao.id)
          .eq('status', 'EM_MANUTENCAO')
          .eq('quantidade', quantidadeAtual)
          .select('*')
          .maybeSingle()

        if (error) throw error

        if (!manutencaoAtualizada?.id) {
          throw new Error(
            'Uma manutenção foi alterada por outra operação. Atualize e tente novamente.'
          )
        }

        manutencoesAlteradas.push({
          anterior: manutencao,
          atual: manutencaoAtualizada
        })
      } else {
        const {
          data: manutencaoRestante,
          error: erroReducao
        } = await supabase
          .from('sigmo_manutencoes')
          .update({
            quantidade:
              quantidadeAtual - descarregar,
            atualizado_em: agora
          })
          .eq('id', manutencao.id)
          .eq('status', 'EM_MANUTENCAO')
          .eq('quantidade', quantidadeAtual)
          .select('*')
          .maybeSingle()

        if (erroReducao) throw erroReducao

        if (!manutencaoRestante?.id) {
          throw new Error(
            'Uma manutenção foi alterada por outra operação. Atualize e tente novamente.'
          )
        }

        manutencoesAlteradas.push({
          anterior: manutencao,
          atual: manutencaoRestante
        })

        const registroDescarga = {
          ...manutencao,
          id: undefined,
          quantidade: descarregar,
          origem: 'COFRE DO P4',
          destino: 'DESCARGA',
          status: 'CONCLUIDA',
          observacoes: observacoesDescarga,
          criado_em: agora,
          atualizado_em: agora
        }

        delete registroDescarga.created_at
        delete registroDescarga.updated_at

        const {
          data: descargaCriada,
          error: erroCriacao
        } = await supabase
          .from('sigmo_manutencoes')
          .insert(registroDescarga)
          .select('*')
          .single()

        if (erroCriacao) throw erroCriacao

        manutencoesCriadas.push(descargaCriada)
      }

      restanteManutencao -= descarregar
    }

    if (restanteManutencao > 0) {
      throw new Error(
        'Não foi possível descarregar toda a quantidade aprovada nas manutenções do P4.'
      )
    }

    for (const lote of (lotesData || [])) {
      if (restanteLotes <= 0) break

      const manutencaoAtual =
        numeroInteiro(lote?.quantidade_manutencao)

      if (manutencaoAtual <= 0) continue

      const descarregar =
        Math.min(
          manutencaoAtual,
          restanteLotes
        )

      const descargaAtual =
        numeroInteiro(lote?.quantidade_descarga)

      const {
        data: loteAtualizado,
        error
      } = await supabase
        .from(TABLE_LOTES)
        .update({
          quantidade_manutencao:
            manutencaoAtual - descarregar,
          quantidade_descarga:
            descargaAtual + descarregar,
          atualizado_em: agora
        })
        .eq('id', lote.id)
        .eq(
          'quantidade_manutencao',
          manutencaoAtual
        )
        .select('*')
        .maybeSingle()

      if (error) throw error

      if (!loteAtualizado?.id) {
        throw new Error(
          'O saldo de manutenção do lote foi alterado por outra operação. Atualize e tente novamente.'
        )
      }

      lotesAlterados.push({
        anterior: lote,
        atual: loteAtualizado
      })

      restanteLotes -= descarregar
    }

    if (restanteLotes > 0) {
      throw new Error(
        'Não foi possível registrar toda a descarga aprovada nos lotes.'
      )
    }

    try {
      await registrarHistorico({
        municaoId: municao.id,
        tipoMovimentacao: 'DESCARGA',
        origem: 'MANUTENCAO_P4',
        destino: destinoFinalNormalizado,
        quantidade: valor,
        documento,
        observacoes: [
          `MOTIVO: ${motivoFinal}`,
          movimentacaoId
            ? `APROVAÇÃO CMT: ${movimentacaoId}`
            : null,
          texto(observacoes)
            ? maiusculo(observacoes)
            : null
        ]
          .filter(Boolean)
          .join(' | '),
        user
      })
    } catch (historicoError) {
      const codigo =
        String(historicoError?.code || '')

      const mensagem =
        String(
          historicoError?.message ||
          historicoError ||
          ''
        ).toLowerCase()

      const bloqueioRls =
        codigo === '42501' ||
        mensagem.includes('row-level security') ||
        mensagem.includes('row level security')

      if (!bloqueioRls) {
        throw historicoError
      }

      console.warn(
        'Histórico auxiliar da descarga bloqueado por RLS; a operação permanece registrada na manutenção, lotes e Engine.',
        historicoError
      )
    }

    return {
      municao,
      quantidade: valor,
      motivo: motivoFinal,
      destino_final: destinoFinalNormalizado,
      manutencoes_afetadas:
        manutencoesAlteradas.length +
        manutencoesCriadas.length,
      lotes_afetados:
        lotesAlterados.length
    }
  } catch (error) {
    for (const lote of [...lotesAlterados].reverse()) {
      try {
        await supabase
          .from(TABLE_LOTES)
          .update({
            quantidade_manutencao:
              lote.anterior.quantidade_manutencao,
            quantidade_descarga:
              lote.anterior.quantidade_descarga,
            atualizado_em:
              lote.anterior.atualizado_em
          })
          .eq('id', lote.anterior.id)
      } catch (rollbackError) {
        console.error(
          'Falha ao restaurar lote após erro na descarga:',
          rollbackError
        )
      }
    }

    for (const criada of [...manutencoesCriadas].reverse()) {
      await apagarRegistro({
        tabela: 'sigmo_manutencoes',
        id: criada.id
      })
    }

    for (const item of [...manutencoesAlteradas].reverse()) {
      try {
        await supabase
          .from('sigmo_manutencoes')
          .update({
            quantidade:
              item.anterior.quantidade,
            origem:
              item.anterior.origem,
            destino:
              item.anterior.destino,
            status:
              item.anterior.status,
            observacoes:
              item.anterior.observacoes,
            atualizado_em:
              item.anterior.atualizado_em
          })
          .eq('id', item.anterior.id)
      } catch (rollbackError) {
        console.error(
          'Falha ao restaurar manutenção após erro na descarga:',
          rollbackError
        )
      }
    }

    throw error
  }
}


function extensaoImagemDescarga(arquivo) {
  const nome =
    texto(arquivo?.name)

  const extensaoNome =
    nome.includes('.')
      ? nome.split('.').pop().toLowerCase()
      : ''

  if (
    ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']
      .includes(extensaoNome)
  ) {
    return extensaoNome === 'jpeg'
      ? 'jpg'
      : extensaoNome
  }

  const tipo =
    texto(arquivo?.type).toLowerCase()

  if (tipo === 'image/png') return 'png'
  if (tipo === 'image/webp') return 'webp'
  if (tipo === 'image/heic') return 'heic'
  if (tipo === 'image/heif') return 'heif'

  return 'jpg'
}

async function enviarFotosSolicitacaoDescargaMunicao({
  municaoId,
  arquivos = []
}) {
  const lista =
    Array.from(arquivos || [])
      .filter(Boolean)
      .slice(0, 6)

  if (lista.length === 0) {
    return []
  }

  const enviados = []

  try {
    for (let indice = 0; indice < lista.length; indice += 1) {
      const arquivo =
        lista[indice]

      const tipo =
        texto(arquivo?.type).toLowerCase()

      if (!tipo.startsWith('image/')) {
        throw new Error(
          'Todos os anexos da descarga devem ser imagens.'
        )
      }

      if (
        Number(arquivo?.size || 0) >
        5 * 1024 * 1024
      ) {
        throw new Error(
          'Cada foto da descarga deve possuir no máximo 5 MB.'
        )
      }

      const identificador =
        globalThis.crypto?.randomUUID?.() ||
        `${Date.now()}-${indice}-${Math.random().toString(16).slice(2)}`

      const caminho = [
        'municao',
        texto(municaoId) || 'sem-referencia',
        'descarga',
        `${identificador}.${extensaoImagemDescarga(arquivo)}`
      ].join('/')

      const {
        error: uploadError
      } = await supabase.storage
        .from(BUCKET_FOTOS_MANUTENCAO)
        .upload(
          caminho,
          arquivo,
          {
            cacheControl: '3600',
            upsert: false,
            contentType:
              arquivo.type ||
              undefined
          }
        )

      if (uploadError) {
        throw new Error(
          `Não foi possível enviar a foto da descarga: ${uploadError.message}`
        )
      }

      const { data } =
        supabase.storage
          .from(BUCKET_FOTOS_MANUTENCAO)
          .getPublicUrl(caminho)

      const url =
        data?.publicUrl || null

      if (!url) {
        await supabase.storage
          .from(BUCKET_FOTOS_MANUTENCAO)
          .remove([caminho])

        throw new Error(
          'Não foi possível gerar a URL pública da foto da descarga.'
        )
      }

      enviados.push({
        url,
        foto_url: url,
        caminho,
        foto_caminho: caminho,
        nome:
          texto(arquivo?.name) ||
          `FOTO ${indice + 1}`,
        ordem:
          indice + 1
      })
    }

    return enviados
  } catch (error) {
    const caminhos =
      enviados
        .map(
          (item) =>
            item?.caminho
        )
        .filter(Boolean)

    if (caminhos.length > 0) {
      const {
        error: remocaoError
      } = await supabase.storage
        .from(BUCKET_FOTOS_MANUTENCAO)
        .remove(caminhos)

      if (remocaoError) {
        console.error(
          'Falha ao remover fotos após erro na solicitação de descarga:',
          remocaoError
        )
      }
    }

    throw error
  }
}

async function removerFotosSolicitacaoDescargaMunicao(
  fotos
) {
  const caminhos =
    (fotos || [])
      .map(
        (item) =>
          item?.caminho ||
          item?.foto_caminho
      )
      .filter(Boolean)

  if (caminhos.length === 0) {
    return
  }

  const {
    error
  } = await supabase.storage
    .from(BUCKET_FOTOS_MANUTENCAO)
    .remove(caminhos)

  if (error) {
    console.error(
      'Não foi possível remover fotos de uma solicitação de descarga não gravada:',
      error
    )
  }
}


export async function registrarDescargaManutencaoMunicaoP4({
  municaoId,
  quantidade,
  motivo,
  destinoFinal,
  documento = null,
  observacoes = null,
  fotos = [],
  user = null
}) {
  const valor = numeroInteiro(quantidade)

  if (!municaoId) {
    throw new Error(
      'Munição não informada para descarga.'
    )
  }

  if (valor <= 0) {
    throw new Error(
      'Informe uma quantidade maior que zero.'
    )
  }

  const motivoFinal = maiusculo(motivo)

  if (!motivoFinal) {
    throw new Error(
      'Informe o motivo da descarga.'
    )
  }

  const destinoFinalNormalizado =
    maiusculo(destinoFinal)

  if (!destinoFinalNormalizado) {
    throw new Error(
      'Informe o destino final da descarga.'
    )
  }

  const {
    municao,
    totalManutencaoP4
  } = await validarQuantidadeManutencaoP4({
    municaoId,
    quantidade: valor
  })

  const pendentes =
    await listarMovimentacoesPendentes({
      limite: 500
    })

  const quantidadeJaPendente =
    (pendentes || [])
      .filter((item) => {
        if (
          !ehSolicitacaoDescargaManutencaoMunicao(
            item
          )
        ) {
          return false
        }

        const dados =
          dadosMovimentacaoPatrimonial(item)

        return (
          String(
            dados?.municao_id ||
            dados?.referencia_id ||
            ''
          ) === String(municao.id)
        )
      })
      .reduce(
        (total, item) =>
          total +
          numeroInteiro(
            dadosMovimentacaoPatrimonial(item)
              ?.quantidade
          ),
        0
      )

  const quantidadeDisponivel =
    Math.max(
      0,
      totalManutencaoP4 -
      quantidadeJaPendente
    )

  if (valor > quantidadeDisponivel) {
    throw new Error(
      `Existem apenas ${quantidadeDisponivel} unidade(s) desta munição em manutenção no P4 disponíveis para nova solicitação de descarga.`
    )
  }

  const patrimonio =
    await criarOuAtualizarPatrimonio({
      tipo: 'municao',
      referencia_id: municao.id,
      dados: {
        id: municao.id,
        municao_id: municao.id,
        calibre: maiusculo(municao.calibre),
        descricao:
          `MUNIÇÃO ${maiusculo(municao.calibre)}`,
        tipo_registro:
          'MUNICAO_QUANTIDADE',
        status_operacional:
          'MANUTENCAO',
        local_atual:
          'COFRE DO P4'
      },
      user,
      local_atual:
        'COFRE DO P4',
      companhia_atual:
        municao.unidade || ''
    })

  if (!patrimonio?.id) {
    throw new Error(
      'Não foi possível vincular a munição à Engine patrimonial.'
    )
  }

  const fotosEnviadas =
    await enviarFotosSolicitacaoDescargaMunicao({
      municaoId:
        municao.id,
      arquivos:
        fotos
    })

  let resultado = null

  try {
    resultado =
      await registrarMovimentacao({
      patrimonioId:
        patrimonio.id,

      tipo:
        TIPOS_MOVIMENTACAO.TRANSFERENCIA,

      statusNovo:
        'MANUTENCAO',

      localDestino:
        'DESCARGA PENDENTE',

      companhiaDestino:
        municao.unidade || '',

      motivo:
        'SOLICITACAO_DESCARGA_MUNICAO',

      observacao:
        [
          `P4 solicita descarga de ${valor} munição(ões) ${maiusculo(municao.calibre)} em manutenção.`,
          `MOTIVO: ${motivoFinal}.`,
          `DESTINO FINAL: ${destinoFinalNormalizado}.`,
          texto(documento)
            ? `DOCUMENTO: ${maiusculo(documento)}.`
            : null,
          texto(observacoes)
            ? `OBSERVAÇÕES: ${maiusculo(observacoes)}.`
            : null
        ]
          .filter(Boolean)
          .join(' '),

      dados: {
        modulo: 'MUNICAO',
        categoria: 'MUNICAO',
        municao_id: municao.id,
        referencia_id: municao.id,
        calibre: maiusculo(municao.calibre),
        quantidade: valor,
        motivo_descarga: motivoFinal,
        destino_final:
          destinoFinalNormalizado,
        documento:
          texto(documento)
            ? maiusculo(documento)
            : null,
        observacoes:
          texto(observacoes)
            ? maiusculo(observacoes)
            : null,
        fotos:
          fotosEnviadas,
        foto_urls:
          fotosEnviadas.map(
            (item) =>
              item.url
          ),
        solicitacao_descarga_manutencao:
          true,
        descarga_manutencao_p4:
          true,
        requer_aprovacao_cmt:
          true,
        cmt_aprovado:
          false,
        etapa_fluxo:
          'AGUARDANDO_APROVACAO_CMT',
        status_movimentacao:
          STATUS_MOVIMENTACAO.PENDENTE,
        preservar_status_operacional:
          true,
        status_operacional_origem:
          'MANUTENCAO',
        origem_codigo:
          'P4',
        destino_codigo:
          'DESCARGA',
        guardiao_origem: {
          tipo: 'SETOR',
          codigo: 'P4',
          nome: 'COFRE DO P4'
        },
        guardiao_destino: {
          tipo: 'PROCESSO',
          codigo: 'DESCARGA',
          nome: 'DESCARGA PENDENTE'
        },
        local_origem:
          'COFRE DO P4',
        local_destino:
          'DESCARGA PENDENTE'
      },

      user
    })
  } catch (error) {
    await removerFotosSolicitacaoDescargaMunicao(
      fotosEnviadas
    )

    throw error
  }

  await criarOuAtualizarPatrimonio({
    tipo: 'municao',
    referencia_id: municao.id,
    dados: {
      id: municao.id,
      municao_id: municao.id,
      calibre: maiusculo(municao.calibre),
      descricao:
        `MUNIÇÃO ${maiusculo(municao.calibre)}`,
      tipo_registro:
        'MUNICAO_QUANTIDADE',
      status_operacional:
        'MANUTENCAO',
      local_atual:
        'COFRE DO P4'
    },
    user,
    local_atual:
      'COFRE DO P4',
    companhia_atual:
      municao.unidade || ''
  })

  try {
    await criarNotificacaoParaPerfil({
      perfil:
        'COMANDANTE DE CIA',

      titulo:
        'DESCARGA DE MUNIÇÃO PENDENTE',

      mensagem:
        `O P4 solicitou descarga de ${valor} munição(ões) ${maiusculo(municao.calibre)} em manutenção. A baixa só será efetivada após aprovação.`,

      tipo:
        'ALERTA',

      modulo:
        'MUNICAO',

      prioridade:
        'ALTA',

      link:
        '/central-operacional',

      metadata: {
        movimentacao_id:
          resultado?.movimentacao?.id || null,
        municao_id:
          municao.id,
        calibre:
          maiusculo(municao.calibre),
        quantidade:
          valor,
        fotos:
          fotosEnviadas,
        foto_urls:
          fotosEnviadas.map(
            (item) =>
              item.url
          ),
        tipo:
          'SOLICITACAO_DESCARGA_MUNICAO'
      }
    })
  } catch (notificacaoError) {
    console.warn(
      'Não foi possível notificar o Cmt de Cia sobre a solicitação de descarga:',
      notificacaoError
    )
  }

  return {
    movimentacao:
      resultado?.movimentacao || null,
    municao,
    quantidade: valor,
    fotos:
      fotosEnviadas,
    status:
      'PENDENTE_APROVACAO_CMT'
  }
}

export async function aprovarDescargaManutencaoMunicaoCmt({
  movimentacaoId,
  user = null
}) {
  if (!movimentacaoId) {
    throw new Error(
      'Solicitação de descarga não informada.'
    )
  }

  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_aprovar_descarga_manutencao_cmt',
    {
      p_token:
        token,

      p_movimentacao_id:
        movimentacaoId
    }
  )

  if (error) {
    throw error
  }

  return data
}


export async function recusarDescargaManutencaoMunicaoCmt({
  movimentacaoId,
  motivo,
  user = null
}) {
  if (!movimentacaoId) {
    throw new Error(
      'Solicitação de descarga não informada.'
    )
  }

  const movimentacao =
    await buscarMovimentacaoPorId(
      movimentacaoId
    )

  if (
    !movimentacao ||
    !ehSolicitacaoDescargaManutencaoMunicao(
      movimentacao
    )
  ) {
    throw new Error(
      'Solicitação de descarga de munição não encontrada.'
    )
  }

  await cancelarMovimentacao({
    movimentacaoId,
    motivo:
      texto(motivo) ||
      'DESCARGA DE MUNIÇÃO RECUSADA PELO CMT DE CIA',
    user
  })

  return true
}


export async function transferirMunicaoP4ParaSvdd({
  municaoId = null,
  calibre = '',
  quantidade,
  documento = null,
  observacoes = null,
  user = null
}) {
  const valor =
    numeroInteiro(quantidade)

  if (valor <= 0) {
    throw new Error(
      'Informe uma quantidade maior que zero.'
    )
  }

  let idMunicao =
    municaoId

  /*
   * Mantém compatibilidade com chamadas antigas
   * que eventualmente informem apenas o calibre.
   * A tela atual de Munições já envia municaoId.
   */
  if (
    !idMunicao &&
    texto(calibre)
  ) {
    const municao =
      await buscarMunicao({
        calibre
      })

    idMunicao =
      municao.id
  }

  if (!idMunicao) {
    throw new Error(
      'Munição não informada.'
    )
  }

  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_transferir_p4_svdd',
    {
      p_token:
        token,

      p_municao_id:
        idMunicao,

      p_quantidade:
        valor,

      p_documento:
        texto(documento)
          ? maiusculo(documento)
          : null,

      p_observacoes:
        texto(observacoes)
          ? maiusculo(observacoes)
          : null
    }
  )

  if (error) {
    throw error
  }

  return data
}

export async function transferirMunicaoSvddParaP4({
  municaoId = null,
  calibre = '',
  quantidade,
  documento = null,
  observacoes = null,
  user = null
}) {
  const valor =
    numeroInteiro(quantidade)

  if (valor <= 0) {
    throw new Error(
      'Informe uma quantidade maior que zero.'
    )
  }

  let idMunicao =
    municaoId

  /*
   * Mantém compatibilidade com chamadas antigas
   * que eventualmente informem apenas o calibre.
   * A tela atual de Munições já envia municaoId.
   */
  if (
    !idMunicao &&
    texto(calibre)
  ) {
    const municao =
      await buscarMunicao({
        calibre
      })

    idMunicao =
      municao.id
  }

  if (!idMunicao) {
    throw new Error(
      'Munição não informada.'
    )
  }

  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_transferir_svdd_p4',
    {
      p_token:
        token,

      p_municao_id:
        idMunicao,

      p_quantidade:
        valor,

      p_documento:
        texto(documento)
          ? maiusculo(documento)
          : null,

      p_observacoes:
        texto(observacoes)
          ? maiusculo(observacoes)
          : null
    }
  )

  if (error) {
    throw error
  }

  return data
}


export async function transferirMunicaoExterna({
  municaoId = null,
  calibre = '',
  quantidade,
  destinoTipo,
  destinoNome,
  documento = null,
  observacoes = null,
  user = null
}) {
  const valor =
    numeroInteiro(quantidade)

  if (valor <= 0) {
    throw new Error(
      'Informe uma quantidade maior que zero.'
    )
  }

  let idMunicao =
    municaoId

  if (
    !idMunicao &&
    texto(calibre)
  ) {
    const municao =
      await buscarMunicao({
        calibre
      })

    idMunicao =
      municao.id
  }

  if (!idMunicao) {
    throw new Error(
      'Munição não informada.'
    )
  }

  const tipoDestino =
    maiusculo(destinoTipo)

  const destinosPermitidos = [
    'CARGA_PERMANENTE',
    'OUTRAS_CIAS',
    'BATALHAO',
    'OUTRA_UNIDADE'
  ]

  if (
    !destinosPermitidos.includes(
      tipoDestino
    )
  ) {
    throw new Error(
      'Tipo de destino externo inválido.'
    )
  }

  const nomeDestino =
    maiusculo(destinoNome)

  if (!nomeDestino) {
    throw new Error(
      'Informe a unidade ou destino da transferência.'
    )
  }

  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_transferir_externa',
    {
      p_token:
        token,

      p_municao_id:
        idMunicao,

      p_quantidade:
        valor,

      p_destino_tipo:
        tipoDestino,

      p_destino_nome:
        nomeDestino,

      p_documento:
        texto(documento)
          ? maiusculo(documento)
          : null,

      p_observacoes:
        texto(observacoes)
          ? maiusculo(observacoes)
          : null
    }
  )

  if (error) {
    throw error
  }

  return data
}

export async function listarTransferenciasExternasPendentes() {
  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_listar_transferencias_externas_pendentes',
    {
      p_token:
        token
    }
  )

  if (error) {
    throw error
  }

  return data || []
}


export async function aprovarTransferenciaMunicaoCmt(
  transferenciaId
) {
  if (!transferenciaId) {
    throw new Error(
      'Transferência não informada.'
    )
  }

  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_aprovar_transferencia_cmt',
    {
      p_token:
        token,

      p_transferencia_id:
        transferenciaId
    }
  )

  if (error) {
    throw error
  }

  return data
}



export async function listarCargasPermanentesPendentesPolicial() {
  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_listar_cargas_pendentes_policial',
    {
      p_token:
        token
    }
  )

  if (error) {
    throw error
  }

  return data || []
}

export async function receberCargaPermanenteMunicao(
  transferenciaId
) {
  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  if (!transferenciaId) {
    throw new Error(
      'Transferência de munição não informada.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_receber_carga_permanente',
    {
      p_token:
        token,

      p_transferencia_id:
        transferenciaId
    }
  )

  if (error) {
    throw error
  }

  return data
}

export async function listarTransferenciasOutrosRecebidos() {
  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_listar_outros_recebidos',
    {
      p_token:
        token
    }
  )

  if (error) {
    throw error
  }

  return data || []
}

export async function confirmarTransferenciaExterna(
  transferenciaId
) {
  if (!transferenciaId) {
    throw new Error(
      'Transferência não informada.'
    )
  }

  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_confirmar_transferencia_externa',
    {
      p_token:
        token,

      p_transferencia_id:
        transferenciaId
    }
  )

  if (error) {
    throw error
  }

  return data
}

export async function cautelarMunicaoParaPolicial({
  municaoId = null,
  calibre = '',
  policial,
  quantidade,
  devolucaoPrevista = null,
  movimentacaoPrincipalId = null,
  documento = null,
  observacoes = null,
  user = null
}) {
  if (!policial) {
    throw new Error(
      'O policial responsável pela cautela não foi informado.'
    )
  }

  const policialId =
    idPolicial(policial)

  if (!policialId) {
    throw new Error(
      'O policial responsável pela cautela não possui identificação válida.'
    )
  }

  const valor =
    numeroInteiro(quantidade)

  if (valor <= 0) {
    throw new Error(
      'A quantidade da cautela deve ser maior que zero.'
    )
  }

  let idMunicao =
    municaoId

  if (
    !idMunicao &&
    texto(calibre)
  ) {
    const municao =
      await buscarMunicao({
        calibre
      })

    idMunicao =
      municao.id
  }

  if (!idMunicao) {
    throw new Error(
      'Munição não informada.'
    )
  }

  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_criar_cautela_pendente',
    {
      p_token:
        token,

      p_municao_id:
        idMunicao,

      p_policial_id:
        policialId,

      p_quantidade:
        valor,

      p_devolucao_prevista:
        devolucaoPrevista ||
        null,

      p_movimentacao_principal_id:
        movimentacaoPrincipalId ||
        null,

      p_documento:
        texto(documento)
          ? maiusculo(documento)
          : null,

      p_observacoes:
        texto(observacoes)
          ? maiusculo(observacoes)
          : null
    }
  )

  if (error) {
    throw error
  }

  return data
}

export async function listarCautelasPendentesPolicial() {
  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_listar_cautelas_pendentes_policial',
    {
      p_token:
        token
    }
  )

  if (error) {
    throw error
  }

  return data || []
}


async function buscarContextoCautelaMunicaoParaNovidade(
  identificador,
  token
) {
  /*
   * Usa exatamente a mesma fonte que alimenta a tela Receber Material.
   * Não consulta sigmo_municoes_cautelas diretamente, porque essa leitura
   * pode ser bloqueada por RLS para o perfil USUÁRIO.
   */
  const {
    data: pendentes,
    error
  } = await supabase.rpc(
    'sigmo_municoes_listar_cautelas_pendentes_policial',
    {
      p_token:
        token
    }
  )

  if (error) {
    throw error
  }

  const lista =
    Array.isArray(pendentes)
      ? pendentes
      : []

  const referencia =
    lista.find(
      (item) =>
        String(
          item?.transferencia_id ||
          item?.id ||
          ''
        ) === String(
          identificador ||
          ''
        )
    )

  if (!referencia) {
    throw new Error(
      'Cautela de munição pendente não localizada para registrar a novidade.'
    )
  }

  return referencia
}

function extrairIdRpc(valor) {
  if (!valor) {
    return null
  }

  if (Array.isArray(valor)) {
    const primeiro = valor[0]

    if (!primeiro) {
      return null
    }

    if (
      typeof primeiro === 'string'
    ) {
      return primeiro
    }

    if (
      typeof primeiro === 'object'
    ) {
      return (
        primeiro?.id ||
        primeiro
          ?.sigmo_registrar_patrimonio_novidade ||
        null
      )
    }

    return null
  }

  if (typeof valor === 'string') {
    return valor
  }

  if (typeof valor === 'object') {
    return (
      valor?.id ||
      valor
        ?.sigmo_registrar_patrimonio_novidade ||
      null
    )
  }

  return null
}


async function registrarNovidadeCentralMunicao({
  contexto,
  cautelaId,
  novidade
}) {
  const municaoId =
    contexto?.municao_id ||
    contexto?.municao?.id ||
    null

  if (!municaoId) {
    throw new Error(
      'Munição não identificada para registrar a novidade.'
    )
  }

  const calibre =
    maiusculo(
      contexto?.calibre ||
      contexto?.municao?.calibre ||
      contexto?.municao?.descricao ||
      'MUNIÇÃO'
    )

  const tipoNovidade =
    maiusculo(
      novidade?.tipo ||
      'NOVIDADE'
    )

  const descricaoNovidade =
    maiusculo(
      novidade?.descricao ||
      ''
    )

  const quantidadeAfetada =
    Math.max(
      1,
      numeroInteiro(
        novidade?.quantidade_afetada
      )
    )

  /*
   * Munição é quantitativa e não possui patrimônio individual.
   * Criamos/atualizamos um patrimônio agregado por calibre apenas
   * para que a ocorrência participe da mesma Central Operacional
   * das demais novidades patrimoniais.
   */
  const patrimonio =
    await criarOuAtualizarPatrimonio({
      tipo:
        'municao',

      referencia_id:
        municaoId,

      dados: {
        id:
          municaoId,
        municao_id:
          municaoId,
        calibre,
        descricao:
          `MUNIÇÃO ${calibre}`,
        tipo_registro:
          'MUNICAO_QUANTIDADE',
        origem_novidade:
          'RECEBIMENTO PELO USUÁRIO',
        quantidade_afetada:
          quantidadeAfetada,
        status_operacional:
          'EM_SERVICO',
        local_atual:
          'CAUTELA INDIVIDUAL'
      },

      user:
        null,

      local_atual:
        'CAUTELA INDIVIDUAL',

      companhia_atual:
        ''
    })

  if (!patrimonio?.id) {
    throw new Error(
      'Não foi possível vincular a munição à Central Operacional.'
    )
  }

  const descricaoCentral = [
    `MUNIÇÃO ${calibre}`,
    `QUANTIDADE AFETADA: ${quantidadeAfetada}`,
    descricaoNovidade
      ? `DESCRIÇÃO: ${descricaoNovidade}`
      : null,
    contexto?.policial_nome
      ? `RELATADO POR: ${maiusculo(
          contexto.policial_nome
        )}`
      : null,
    contexto?.policial_re
      ? `RE: ${contexto.policial_re}`
      : null,
    `CAUTELA DE MUNIÇÃO: ${cautelaId}`,
    'PROVIDÊNCIA SUGERIDA: MANUTENÇÃO'
  ]
    .filter(Boolean)
    .join(' | ')

  const {
    data: novidadeCriada,
    error: novidadeError
  } = await supabase.rpc(
    'sigmo_registrar_patrimonio_novidade',
    {
      p_patrimonio_id:
        patrimonio.id,

      p_tipo_patrimonio:
        'MUNICAO',

      p_titulo:
        tipoNovidade,

      p_descricao:
        descricaoCentral,

      p_gravidade:
        'baixa',

      p_registrado_por_id:
        contexto?.policial_id ||
        null,

      p_registrado_por_nome:
        maiusculo(
          contexto?.policial_nome ||
          'USUÁRIO SIGMO'
        )
    }
  )

  if (novidadeError) {
    throw new Error(
      `A munição foi recebida, mas a novidade não pôde ser registrada na Central Operacional: ${novidadeError.message}`
    )
  }

  const novidadeId =
    extrairIdRpc(
      novidadeCriada
    )

  if (!novidadeId) {
    throw new Error(
      'A munição foi recebida, mas a novidade não retornou identificação da Central Operacional.'
    )
  }

  const nomeRelator =
    maiusculo(
      contexto?.policial_nome ||
      contexto?.destino_nome ||
      'USUÁRIO SIGMO'
    )

  const reRelator =
    texto(
      contexto?.policial_re ||
      contexto?.destino_re ||
      ''
    )

  const mensagem = [
    `${nomeRelator}${reRelator ? ` (RE ${reRelator})` : ''} registrou uma novidade em MUNIÇÃO ${calibre}.`,
    `TIPO: ${tipoNovidade}.`,
    `QUANTIDADE AFETADA: ${quantidadeAfetada}.`,
    descricaoNovidade
      ? `DESCRIÇÃO: ${descricaoNovidade}.`
      : '',
    'PROVIDÊNCIA SUGERIDA: MANUTENÇÃO.'
  ]
    .filter(Boolean)
    .join(' ')

  await criarNotificacaoParaPerfil({
    perfil:
      'ENCARREGADO DO SVDD',

    titulo:
      'NOVIDADE PATRIMONIAL REGISTRADA',

    mensagem,

    tipo:
      'ALERTA',

    modulo:
      'PATRIMONIO',

    prioridade:
      'ALTA',

    link:
      '/central-operacional',

    metadata: {
      origem:
        'RECEBIMENTO PELO USUÁRIO',
      novidade_id:
        novidadeId,
      patrimonio_id:
        patrimonio.id,
      referencia_id:
        municaoId,
      municao_id:
        municaoId,
      cautela_municao_id:
        cautelaId,
      tipo_patrimonio:
        'MUNICAO',
      tipo_novidade:
        tipoNovidade,
      quantidade_afetada:
        quantidadeAfetada,
      providencia:
        'MANUTENCAO',
      policial_id:
        contexto?.policial_id ||
        null,
      policial_re:
        reRelator ||
        null,
      policial_nome:
        nomeRelator
    }
  })

  return {
    novidade_id:
      novidadeId,
    patrimonio_id:
      patrimonio.id
  }
}


export async function receberCautelaMunicaoPolicial(
  transferenciaId,
  novidade = null
) {
  if (!transferenciaId) {
    throw new Error(
      'Cautela de munição não informada.'
    )
  }

  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  const possuiNovidade =
    Boolean(
      novidade &&
      texto(
        novidade?.tipo
      ) &&
      texto(
        novidade?.descricao
      ) &&
      numeroInteiro(
        novidade?.quantidade_afetada
      ) > 0
    )

  /*
   * A novidade registrada pelo policial NÃO movimenta a munição
   * para manutenção. Neste momento ele está apenas confirmando
   * o recebimento da cautela e relatando uma ocorrência.
   *
   * A quantidade inteira permanece EM SERVIÇO com o policial.
   * A entrada efetiva em manutenção só ocorrerá depois, no fluxo
   * de devolução/recebimento pelo SVDD, seguindo o mesmo padrão do HT.
   */
  const contextoNovidade =
    possuiNovidade
      ? await buscarContextoCautelaMunicaoParaNovidade(
          transferenciaId,
          token
        )
      : null

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_receber_cautela_policial',
    {
      p_token:
        token,

      p_transferencia_id:
        transferenciaId
    }
  )

  if (error) {
    throw error
  }

  let registroCentral =
    null

  if (
    possuiNovidade &&
    contextoNovidade
  ) {
    registroCentral =
      await registrarNovidadeCentralMunicao({
        contexto:
          contextoNovidade,

        cautelaId:
          transferenciaId,

        novidade
      })
  }

  return {
    resultado:
      data,

    novidade_central:
      registroCentral,

    // Compatibilidade com chamadas existentes:
    // a manutenção ainda não existe nesta etapa.
    manutencao:
      null
  }
}


export async function buscarCautelaMunicaoPorId(
  cautelaId
) {
  if (!cautelaId) {
    throw new Error(
      'Cautela de munição não informada.'
    )
  }

  const { data, error } = await supabase
    .from(TABLE_CAUTELAS)
    .select(
      '*, municao:sigmo_municoes(*), lote:sigmo_municoes_lotes(*)'
    )
    .eq('id', cautelaId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data || null
}

export async function devolverMunicaoDoPolicialAoSvdd({
  cautelaId,
  quantidade,
  observacoes = null,
  user = null
}) {
  const valor =
    numeroInteiro(quantidade)

  if (valor <= 0) {
    throw new Error(
      'A quantidade devolvida deve ser maior que zero.'
    )
  }

  const cautela =
    await buscarCautelaMunicaoPorId(
      cautelaId
    )

  if (!cautela?.id) {
    throw new Error(
      'Cautela de munição não localizada.'
    )
  }

  if (
    maiusculo(cautela.status) !==
    STATUS_CAUTELA_MUNICAO.EM_SERVICO
  ) {
    throw new Error(
      'Esta cautela não está mais em serviço.'
    )
  }

  const saldoAtual =
    numeroInteiro(
      cautela.saldo
    )

  if (valor > saldoAtual) {
    throw new Error(
      `A cautela possui apenas ${saldoAtual} unidade(s) pendente(s).`
    )
  }

  const lote =
    cautela.lote

  if (!lote?.id) {
    throw new Error(
      'O lote associado à cautela não foi localizado.'
    )
  }

  const novaDevolvida =
    numeroInteiro(
      cautela.quantidade_devolvida
    ) + valor

  const novoSaldo =
    Math.max(
      0,
      saldoAtual - valor
    )

  const novoStatus =
    novoSaldo === 0
      ? STATUS_CAUTELA_MUNICAO.DEVOLVIDA
      : STATUS_CAUTELA_MUNICAO.EM_SERVICO

  const saldoSvddAnterior =
    numeroInteiro(
      lote.quantidade_svdd
    )

  let loteAtualizado = null
  let cautelaAtualizada = null
  let historico = null

  try {
    const {
      data: loteNovo,
      error: erroLote
    } = await supabase
      .from(TABLE_LOTES)
      .update({
        quantidade_svdd:
          saldoSvddAnterior + valor
      })
      .eq('id', lote.id)
      .eq(
        'quantidade_svdd',
        saldoSvddAnterior
      )
      .select('*')
      .maybeSingle()

    if (erroLote) {
      throw erroLote
    }

    if (!loteNovo?.id) {
      throw new Error(
        'O estoque do lote foi alterado. Atualize e tente novamente.'
      )
    }

    loteAtualizado =
      loteNovo

    const {
      data: cautelaNova,
      error: erroCautela
    } = await supabase
      .from(TABLE_CAUTELAS)
      .update({
        quantidade_devolvida:
          novaDevolvida,

        status:
          novoStatus
      })
      .eq('id', cautela.id)
      .eq(
        'quantidade_devolvida',
        numeroInteiro(
          cautela.quantidade_devolvida
        )
      )
      .select('*')
      .maybeSingle()

    if (erroCautela) {
      throw erroCautela
    }

    if (!cautelaNova?.id) {
      throw new Error(
        'A cautela foi alterada por outra operação.'
      )
    }

    cautelaAtualizada =
      cautelaNova

    historico =
      await registrarHistorico({
        municaoId:
          cautela.municao_id,

        loteId:
          lote.id,

        cautelaId:
          cautela.id,

        movimentacaoPrincipalId:
          cautela.movimentacao_principal_id,

        tipoMovimentacao:
          'DEVOLUCAO',

        origem:
          'POLICIAL',

        destino:
          'SVDD',

        quantidade:
          valor,

        policial: {
          id:
            cautela.policial_id,
          re:
            cautela.policial_re,
          nome_guerra:
            cautela.policial_nome
        },

        observacoes,
        user
      })

    return {
      cautela:
        cautelaAtualizada,
      lote:
        loteAtualizado,
      historico
    }
  } catch (error) {
    if (historico?.id) {
      await apagarRegistro({
        tabela:
          TABLE_MOVIMENTACOES,
        id:
          historico.id
      })
    }

    if (cautelaAtualizada?.id) {
      try {
        await supabase
          .from(TABLE_CAUTELAS)
          .update({
            quantidade_devolvida:
              cautela.quantidade_devolvida,
            status:
              cautela.status
          })
          .eq('id', cautela.id)
      } catch (rollbackError) {
        console.error(
          'Falha ao restaurar cautela de munição:',
          rollbackError
        )
      }
    }

    if (loteAtualizado?.id) {
      await restaurarSaldoLote({
        loteId:
          lote.id,
        valores: {
          quantidade_svdd:
            saldoSvddAnterior
        }
      })
    }

    throw error
  }
}

export async function registrarConsumoMunicao({
  cautelaId,
  quantidade,
  documento = null,
  observacoes = null,
  user = null
}) {
  const valor =
    numeroInteiro(quantidade)

  if (valor <= 0) {
    throw new Error(
      'A quantidade consumida deve ser maior que zero.'
    )
  }

  const cautela =
    await buscarCautelaMunicaoPorId(
      cautelaId
    )

  if (!cautela?.id) {
    throw new Error(
      'Cautela de munição não localizada.'
    )
  }

  if (
    maiusculo(cautela.status) !==
    STATUS_CAUTELA_MUNICAO.EM_SERVICO
  ) {
    throw new Error(
      'Esta cautela não está mais em serviço.'
    )
  }

  const saldoAtual =
    numeroInteiro(
      cautela.saldo
    )

  if (valor > saldoAtual) {
    throw new Error(
      `A cautela possui apenas ${saldoAtual} unidade(s) pendente(s).`
    )
  }

  const novaConsumida =
    numeroInteiro(
      cautela.quantidade_consumida
    ) + valor

  const novoSaldo =
    Math.max(
      0,
      saldoAtual - valor
    )

  const novoStatus =
    novoSaldo === 0
      ? STATUS_CAUTELA_MUNICAO.CONSUMIDA
      : STATUS_CAUTELA_MUNICAO.EM_SERVICO

  const {
    data,
    error
  } = await supabase
    .from(TABLE_CAUTELAS)
    .update({
      quantidade_consumida:
        novaConsumida,
      status:
        novoStatus
    })
    .eq('id', cautela.id)
    .eq(
      'quantidade_consumida',
      numeroInteiro(
        cautela.quantidade_consumida
      )
    )
    .select('*')
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data?.id) {
    throw new Error(
      'A cautela foi alterada por outra operação. Atualize e tente novamente.'
    )
  }

  try {
    await registrarHistorico({
      municaoId:
        cautela.municao_id,

      loteId:
        cautela.lote_id,

      cautelaId:
        cautela.id,

      movimentacaoPrincipalId:
        cautela.movimentacao_principal_id,

      tipoMovimentacao:
        'CONSUMO',

      origem:
        'CAUTELA INDIVIDUAL',

      destino:
        'CONSUMO',

      quantidade:
        valor,

      policial: {
        id:
          cautela.policial_id,
        re:
          cautela.policial_re,
        nome_guerra:
          cautela.policial_nome
      },

      documento,
      observacoes,
      user
    })
  } catch (historicoError) {
    await supabase
      .from(TABLE_CAUTELAS)
      .update({
        quantidade_consumida:
          cautela.quantidade_consumida,
        status:
          cautela.status
      })
      .eq('id', cautela.id)

    throw historicoError
  }

  return data
}

export async function listarCautelasMunicaoAtivas({
  municaoId = null,
  calibre = '',
  loteId = null
} = {}) {
  let query = supabase
    .from(TABLE_CAUTELAS)
    .select(
      '*, municao:sigmo_municoes(*), lote:sigmo_municoes_lotes(*)'
    )
    .eq(
      'status',
      STATUS_CAUTELA_MUNICAO.EM_SERVICO
    )
    .gt('saldo', 0)
    .order('criado_em', {
      ascending: false
    })

  if (municaoId) {
    query = query.eq(
      'municao_id',
      municaoId
    )
  }

  if (loteId) {
    query = query.eq(
      'lote_id',
      loteId
    )
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  const lista = data || []

  if (!texto(calibre)) {
    return lista
  }

  const calibreNormalizado =
    maiusculo(calibre)

  return lista.filter(
    (item) =>
      maiusculo(
        item?.municao?.calibre
      ) === calibreNormalizado
  )
}

export async function listarMunicoesEmServico({
  re = '',
  policialId = null
} = {}) {
  const reNormalizado =
    normalizarRe(re)

  if (
    !reNormalizado &&
    !policialId
  ) {
    return []
  }

  /*
   * Primeiro tenta a consulta segura do próprio policial
   * autenticado. A RPC agrega por calibre/munição e não
   * expõe lote.
   *
   * Se o policial retornado pela sessão não corresponder
   * ao policial solicitado, mantemos a consulta antiga
   * como fallback para usos administrativos, como o
   * Mapa Força consultando outro policial.
   */
  const token =
    loadSessionToken()

  if (token) {
    const {
      data: minhasCautelas,
      error: minhasCautelasError
    } = await supabase.rpc(
      'sigmo_municoes_listar_minhas_cautelas',
      {
        p_token:
          token
      }
    )

    if (!minhasCautelasError) {
      const listaSegura =
        Array.isArray(
          minhasCautelas
        )
          ? minhasCautelas
          : []

      const correspondeAoSolicitado =
        listaSegura.some(
          (item) => {
            const mesmoId =
              policialId &&
              String(
                item?.policial_id ||
                ''
              ) ===
                String(
                  policialId
                )

            const mesmoRe =
              reNormalizado &&
              normalizarRe(
                item?.policial_re
              ) ===
                reNormalizado

            return (
              mesmoId ||
              mesmoRe
            )
          }
        )

      if (
        correspondeAoSolicitado ||
        (
          listaSegura.length === 0 &&
          !policialId &&
          !reNormalizado
        )
      ) {
        return listaSegura
          .map(
            (item) => {
              const quantidade =
                numeroInteiro(
                  item?.quantidade_em_posse
                )

              return {
                id:
                  `MUNICAO-${item.municao_id}`,

                patrimonio_id:
                  null,

                referencia_id:
                  item.municao_id,

                municao_id:
                  item.municao_id,

                tipo_registro:
                  'MUNICAO_QUANTIDADE',

                modulo:
                  'MUNICAO_QUANTIDADE',

                tipo:
                  'MUNICAO',

                categoria:
                  'MUNICAO',

                calibre:
                  maiusculo(
                    item?.calibre
                  ),

                patrimonio:
                  'ESTOQUE CONTROLADO',

                identificador:
                  maiusculo(
                    item?.calibre
                  ) ||
                  'MUNIÇÃO',

                descricao:
                  item?.descricao
                    ? maiusculo(
                        item.descricao
                      )
                    : `MUNIÇÃO ${
                        maiusculo(
                          item?.calibre
                        )
                      }`.trim(),

                local_origem:
                  'CAUTELA INDIVIDUAL',

                local_atual:
                  'CAUTELA INDIVIDUAL',

                status:
                  'EM SERVIÇO',

                quantidade,

                saldo:
                  quantidade,

                policial_id:
                  item?.policial_id ||
                  null,

                policial_re:
                  item?.policial_re ||
                  null,

                policial_nome:
                  item?.policial_nome ||
                  null,

                devolucao_prevista:
                  item?.devolucao_prevista ||
                  null,

                primeira_retirada:
                  item?.primeira_retirada ||
                  null,

                /*
                 * Lotes e cautelas individuais não são expostos
                 * nesta consulta do usuário. A devolução será
                 * tratada por RPC própria no próximo passo.
                 */
                cautelas:
                  []
              }
            }
          )
          .filter(
            (item) =>
              item.quantidade >
              0
          )
      }
    } else {
      console.warn(
        'Não foi possível consultar as cautelas de munição pela RPC segura. Tentando consulta administrativa de compatibilidade.',
        minhasCautelasError
      )
    }
  }

  /*
   * Compatibilidade administrativa:
   * mantém o comportamento anterior para telas que
   * consultam outro policial e já possuem permissão
   * de leitura direta.
   */
  const {
    data,
    error
  } = await supabase
    .from(TABLE_CAUTELAS)
    .select(
      '*, municao:sigmo_municoes(id,calibre,descricao)'
    )
    .eq(
      'status',
      STATUS_CAUTELA_MUNICAO.EM_SERVICO
    )
    .gt('saldo', 0)
    .order('criado_em', {
      ascending: true
    })

  if (error) {
    throw error
  }

  const doPolicial =
    (data || []).filter(
      (item) => {
        const mesmoId =
          policialId &&
          String(
            item.policial_id ||
            ''
          ) ===
            String(policialId)

        const mesmoRe =
          reNormalizado &&
          normalizarRe(
            item.policial_re
          ) ===
            reNormalizado

        return (
          mesmoId ||
          mesmoRe
        )
      }
    )

  const porMunicao =
    new Map()

  for (const cautela of doPolicial) {
    const chave =
      String(
        cautela.municao_id
      )

    if (!porMunicao.has(chave)) {
      porMunicao.set(
        chave,
        {
          id:
            `MUNICAO-${chave}`,

          patrimonio_id:
            null,

          referencia_id:
            cautela.municao_id,

          municao_id:
            cautela.municao_id,

          tipo_registro:
            'MUNICAO_QUANTIDADE',

          modulo:
            'MUNICAO_QUANTIDADE',

          tipo:
            'MUNICAO',

          categoria:
            'MUNICAO',

          calibre:
            maiusculo(
              cautela?.municao?.calibre
            ),

          patrimonio:
            'ESTOQUE CONTROLADO',

          identificador:
            maiusculo(
              cautela?.municao?.calibre
            ) ||
            'MUNIÇÃO',

          descricao:
            `MUNIÇÃO ${
              maiusculo(
                cautela?.municao?.calibre
              )
            }`.trim(),

          local_origem:
            'CAUTELA INDIVIDUAL',

          local_atual:
            'CAUTELA INDIVIDUAL',

          status:
            'EM SERVIÇO',

          quantidade:
            0,

          saldo:
            0,

          policial_id:
            cautela.policial_id,

          policial_re:
            cautela.policial_re,

          policial_nome:
            cautela.policial_nome,

          devolucao_prevista:
            cautela.devolucao_prevista,

          cautelas:
            []
        }
      )
    }

    const agregado =
      porMunicao.get(chave)

    const saldo =
      numeroInteiro(
        cautela.saldo
      )

    agregado.quantidade +=
      saldo

    agregado.saldo +=
      saldo

    agregado.cautelas.push({
      cautela_id:
        cautela.id,

      lote_id:
        cautela.lote_id,

      quantidade:
        saldo,

      criado_em:
        cautela.criado_em
    })
  }

  return Array.from(
    porMunicao.values()
  )
}


export async function listarHistoricoMunicao({
  municaoId = null,
  loteId = null,
  policialId = null
} = {}) {
  let query = supabase
    .from(TABLE_MOVIMENTACOES)
    .select('*')
    .order('criado_em', {
      ascending: false
    })

  if (municaoId) {
    query = query.eq(
      'municao_id',
      municaoId
    )
  }

  if (loteId) {
    query = query.eq(
      'lote_id',
      loteId
    )
  }

  if (policialId) {
    query = query.eq(
      'policial_id',
      policialId
    )
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return data || []
}
