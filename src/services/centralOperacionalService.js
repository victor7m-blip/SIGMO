import { supabase } from './supabaseClient'
import { listarNovidadesPatrimoniais } from './dashboardService'
import { listarMovimentacoes, buscarMovimentacaoPorId } from './movimentacoesService'
import { obterPerfilEfetivo, normalizarPerfil } from './permissionService'

function texto(valor) {
  return String(valor ?? '').trim()
}

function upper(valor) {
  return texto(valor).toUpperCase()
}

function contem(valor, termos) {
  const alvo = upper(valor)
  return termos.some((termo) => alvo.includes(termo))
}

function dataItem(item) {
  return item?.created_at || item?.atualizado_em || item?.updated_at || null
}

function ordenarRecentes(lista) {
  return [...lista].sort((a, b) => {
    const da = new Date(dataItem(a) || 0).getTime()
    const db = new Date(dataItem(b) || 0).getTime()
    return db - da
  })
}

function perfilCentral(user) {
  return normalizarPerfil(obterPerfilEfetivo(user))
}

function pertenceAoPerfil(item, perfil) {
  if (!item || !perfil) return true
  if (perfil === 'ADMINISTRADOR') return true

  const origem = upper(item.origem_local || item.local_origem || item.origem)
  const destino = upper(item.destino_local || item.local_destino || item.destino)
  const conjunto = `${origem} ${destino}`

  if (perfil.includes('SVDD')) {
    return contem(conjunto, ['SVDD', 'SERVIÇO DE DIA', 'SERVICO DE DIA', 'COFRE'])
  }

  if (perfil.includes('P4')) {
    return contem(conjunto, ['P4', 'DEPÓSITO', 'DEPOSITO'])
  }

  return true
}


async function listarTransferenciasOperacionaisPendentes() {
  const { data, error } = await supabase
    .from('sigmo_transferencias_patrimoniais')
    .select('*')
    .eq('status', 'PENDENTE')
    .order('enviado_em', { ascending: true })
    .limit(500)

  if (error) throw error
  return data ?? []
}

function transferenciaParaPerfil(item, perfil) {
  if (!item || !perfil) return true
  if (perfil === 'ADMINISTRADOR') return true

  const destino = upper(item.destino_codigo || item.destino_nome)

  if (perfil.includes('SVDD')) {
    return contem(destino, ['SVDD', 'SERVIÇO DE DIA', 'SERVICO DE DIA', 'COFRE'])
  }

  if (perfil.includes('P4')) {
    return contem(destino, ['P4', 'DEPÓSITO', 'DEPOSITO'])
  }

  return false
}


async function listarBaixasAguardandoAprovacao() {
  const { data, error } = await supabase
    .from('sigmo_patrimonio_baixas')
    .select('*')
    .eq('status', 'AGUARDANDO_APROVACAO')
    .order('solicitada_em', { ascending: false })

  if (error) throw error

  return (data ?? []).map((item) => ({
    ...item,
    origem_aprovacao: 'BAIXA_PATRIMONIAL',
    tipo: `BAIXA ${upper(item.modulo) || 'PATRIMONIAL'}`,
    created_at: item.solicitada_em || item.created_at
  }))
}

function aprovacoesVisiveisAoPerfil({ movimentacoes = [], baixas = [], perfil }) {
  const aprovacoesMovimentacao = movimentacoes
    .filter((item) =>
      contem(item.status, [
        'AGUARDANDO_APROVACAO',
        'AGUARDANDO APROVACAO',
        'PENDENTE_APROVACAO',
        'PENDENTE APROVACAO'
      ])
    )
    .map((item) => ({
      ...item,
      origem_aprovacao: 'MOVIMENTACAO'
    }))

  // Baixa patrimonial é decidida pelo Comandante/Admin. P4 e SVDD podem
  // acompanhar seus próprios fluxos em módulos específicos, mas não recebem
  // a decisão como pendência operacional na Central.
  const podeDecidirBaixa =
    perfil === 'ADMINISTRADOR' ||
    perfil.includes('COMANDANTE')

  return ordenarRecentes([
    ...aprovacoesMovimentacao,
    ...(podeDecidirBaixa ? baixas : [])
  ])
}


function normalizarSemAcentos(valor) {
  return texto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function patrimonioEstaBaixado(item) {
  const status = normalizarSemAcentos(
    item?.status_operacional || item?.status
  )

  // "INATIVO" e "EXCLUIDO" podem representar registros centrais antigos
  // ou substituídos. O card Baixados deve refletir somente baixa patrimonial
  // explícita para não misturar histórico técnico com baixa operacional.
  return status === 'BAIXADO'
}

function patrimonioNaoLocalizado(item) {
  if (patrimonioEstaBaixado(item)) return false

  const status = normalizarSemAcentos(
    item?.status_operacional || item?.status
  )
  const local = normalizarSemAcentos(item?.local_atual)

  // Mesma convenção já utilizada por Armas/HT/Tonfas: status/local explícito
  // ou ausência de localização operacional.
  return (
    status.includes('NAO LOCALIZ') ||
    local.includes('NAO LOCALIZ') ||
    !local
  )
}

async function listarPatrimoniosIndicadores() {
  const { data, error } = await supabase
    .from('sigmo_patrimonios')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function carregarCentralOperacional({ user } = {}) {
  const perfil = perfilCentral(user)

  const resultados = await Promise.allSettled([
    listarMovimentacoes(),
    listarTransferenciasOperacionaisPendentes(),
    listarNovidadesPatrimoniais({
      limite: 50,
      status: 'REGISTRADA'
    }),
    listarPatrimoniosIndicadores(),
    listarBaixasAguardandoAprovacao()
  ])

  const [movRes, transfRes, novRes, patRes, baixasRes] = resultados
  const movimentacoes = movRes.status === 'fulfilled' ? movRes.value : []
  const transferencias = transfRes.status === 'fulfilled' ? transfRes.value : []
  const novidades = novRes.status === 'fulfilled' ? novRes.value : []
  const patrimonios = patRes.status === 'fulfilled' ? patRes.value : []

  const novidadesRegistradas = (novidades || []).filter(
    (item) => normalizarSemAcentos(item?.status) === 'REGISTRADA'
  )

  // A origem da novidade em patrimônio cautelado é a origem da cautela
  // finalizada mais recente que colocou o item em CAUTELA INDIVIDUAL.
  const patrimonioIds = [
    ...new Set(
      novidadesRegistradas
        .map((item) => item?.patrimonio_id)
        .filter(Boolean)
    )
  ]

  const cautelaPorPatrimonio = new Map()

  if (patrimonioIds.length > 0) {
    const { data: itensNovidade, error: itensNovidadeError } = await supabase
      .from('sigmo_movimentacao_itens')
      .select('patrimonio_id, movimentacao_id')
      .in('patrimonio_id', patrimonioIds)

    if (itensNovidadeError) {
      console.warn('Falha ao localizar movimentações das novidades:', itensNovidadeError)
    } else {
      const movimentacaoIds = [
        ...new Set(
          (itensNovidade || [])
            .map((item) => item?.movimentacao_id)
            .filter(Boolean)
        )
      ]

      if (movimentacaoIds.length > 0) {
        const { data: movsNovidade, error: movsNovidadeError } = await supabase
          .from('sigmo_movimentacoes')
          .select('id, tipo_movimentacao, status, origem_local, destino_local, solicitante_nome, recebedor_nome, created_at')
          .in('id', movimentacaoIds)
          .order('created_at', { ascending: false })

        if (movsNovidadeError) {
          console.warn('Falha ao carregar cautelas das novidades:', movsNovidadeError)
        } else {
          const movPorId = new Map(
            (movsNovidade || []).map((mov) => [mov.id, mov])
          )

          // Como movsNovidade já vem do mais recente para o mais antigo,
          // a primeira cautela válida encontrada para cada patrimônio vence.
          const itensPorMovimentacao = new Map()
          for (const item of itensNovidade || []) {
            const lista = itensPorMovimentacao.get(item.movimentacao_id) || []
            lista.push(item)
            itensPorMovimentacao.set(item.movimentacao_id, lista)
          }

          for (const mov of movsNovidade || []) {
            const tipo = normalizarSemAcentos(mov?.tipo_movimentacao)
            const status = normalizarSemAcentos(mov?.status)
            const destino = normalizarSemAcentos(mov?.destino_local)

            if (
              tipo !== 'CAUTELA' ||
              status !== 'FINALIZADA' ||
              destino !== 'CAUTELA INDIVIDUAL'
            ) {
              continue
            }

            for (const item of itensPorMovimentacao.get(mov.id) || []) {
              const patrimonioId = String(item?.patrimonio_id || '')
              if (patrimonioId && !cautelaPorPatrimonio.has(patrimonioId)) {
                cautelaPorPatrimonio.set(patrimonioId, mov)
              }
            }
          }
        }
      }
    }
  }

  const patrimonioPorId = new Map(
    patrimonios.map((item) => [String(item?.id || ''), item])
  )

  const novidadesClassificadas = novidadesRegistradas.map((item) => {
    const patrimonioId = String(item?.patrimonio_id || '')
    const patrimonio = patrimonioPorId.get(patrimonioId)
    const cautela = cautelaPorPatrimonio.get(patrimonioId)
    const origemCautela = cautela?.origem_local || null

    const cargaAtual =
      contem(origemCautela, ['SVDD', 'SERVIÇO DE DIA', 'SERVICO DE DIA'])
        ? 'SVDD'
        : contem(origemCautela, ['P4', 'DEPÓSITO', 'DEPOSITO'])
          ? 'P4'
          : null

    return {
      ...item,
      local_atual: patrimonio?.local_atual || item?.local_atual || null,
      carga_atual: cargaAtual,
      responsabilidade_atual: cargaAtual,
      origem_cautela: origemCautela,
      pago_por: cautela?.solicitante_nome || null,
      cautelado_com:
        cautela?.recebedor_nome ||
        patrimonio?.responsavel_atual_nome ||
        null,
      cautela_movimentacao_id: cautela?.id || null,
      patrimonio_status:
        patrimonio?.status_operacional ||
        patrimonio?.status ||
        null
    }
  })

  // Regra da Central:
  // - SVDD vê somente novidades de materiais sob carga/origem SVDD.
  // - P4 e Administrador podem acompanhar todas as novidades; no P4 a UI
  //   separa em "Novidades P4" e "Novidades SVDD".
  const novidadesVisiveisAoPerfil =
    perfil.includes('SVDD')
      ? novidadesClassificadas.filter(
          (item) => normalizarSemAcentos(item?.carga_atual) === 'SVDD'
        )
      : novidadesClassificadas

  const novidadesPendentes = ordenarRecentes(
    novidadesVisiveisAoPerfil
  )
  const baixasAprovacao = baixasRes.status === 'fulfilled' ? baixasRes.value : []

  const movPerfil = movimentacoes.filter((item) => pertenceAoPerfil(item, perfil))
  const transfPerfil = transferencias.filter((item) => transferenciaParaPerfil(item, perfil))

  const aguardandoAprovacao = aprovacoesVisiveisAoPerfil({
    movimentacoes: movPerfil,
    baixas: baixasAprovacao,
    perfil
  })

  // A Engine usa estados positivos de pendência. Não inferimos pendência
  // simplesmente por "não estar concluída", pois FINALIZADA é histórico.
  const statusRecebimentoPendente = [
    'AGUARDANDO_RECEBIMENTO',
    'AGUARDANDO RECEBIMENTO',
    'PENDENTE_RECEBIMENTO',
    'PENDENTE RECEBIMENTO'
  ]

  const statusDevolucaoPendente = [
    ...statusRecebimentoPendente,
    'ALTERACAO_SOLICITADA',
    'ALTERAÇÃO SOLICITADA',
    'EM_ANDAMENTO',
    'EM ANDAMENTO'
  ]

  const aguardandoRecebimentoBase = movPerfil.filter((item) => {
    if (!contem(item.status, statusRecebimentoPendente)) return false

    // Recebimentos individuais pertencem exclusivamente ao policial
    // destinatário. O Administrador pode acompanhar o sistema, mas não deve
    // enxergar/assumir a confirmação de cautela ou entrega de outro usuário.
    if (perfil === 'ADMINISTRADOR') {
      const destino = normalizarSemAcentos(
        item?.destino_local || item?.destino_nome || item?.destino_codigo
      )
      const tipo = normalizarSemAcentos(
        item?.tipo_movimentacao || item?.tipo
      )

      const recebimentoIndividual =
        destino === 'CAUTELA INDIVIDUAL' &&
        (tipo === 'CAUTELA' || tipo === 'ENTREGA')

      if (recebimentoIndividual) return false
    }

    return true
  })

  // Só detalhamos as pendências exibidas na Central. Isso permite mostrar
  // destinatário, itens e quantidades sem alterar a Engine de movimentação.
  const aguardandoRecebimento = await Promise.all(
    aguardandoRecebimentoBase.map(async (item) => {
      try {
        return await buscarMovimentacaoPorId(item.id) || item
      } catch {
        return item
      }
    })
  )

  const devolucoes = movPerfil.filter((item) =>
    contem(item.tipo_movimentacao, ['DEVOLUÇÃO', 'DEVOLUCAO', 'RETORNO']) &&
    contem(item.status, statusDevolucaoPendente)
  )

  const baixados = patrimonios.filter(patrimonioEstaBaixado)

  const naoLocalizados = patrimonios.filter(patrimonioNaoLocalizado)

  return {
    perfil,
    atualizadoEm: new Date().toISOString(),
    alertas: [
      { key: 'aprovacoes', titulo: 'Aguardando aprovações', total: aguardandoAprovacao.length, itens: ordenarRecentes(aguardandoAprovacao), tom: 'atencao' },
      { key: 'recebimentos', titulo: 'Aguardando recebimento pelo usuário', total: aguardandoRecebimento.length, itens: ordenarRecentes(aguardandoRecebimento), tom: 'acao' },
      { key: 'devolucoes', titulo: 'Devoluções pendentes', total: devolucoes.length, itens: ordenarRecentes(devolucoes), tom: 'acao' },
      { key: 'transferencias', titulo: 'Transferências pendentes', total: transfPerfil.length, itens: ordenarRecentes(transfPerfil), tom: 'atencao' }
    ],
    indicadores: [
      { key: 'nao-localizados', titulo: 'Não localizados', total: naoLocalizados.length, itens: naoLocalizados },
      { key: 'baixados', titulo: 'Baixados', total: baixados.length, itens: baixados },
      { key: 'novidades', titulo: 'Novidades patrimoniais', total: novidadesPendentes.length, itens: novidadesPendentes }
    ]
  }
}
