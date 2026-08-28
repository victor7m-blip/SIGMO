import { supabase } from './supabaseClient'
import { listarNovidadesPatrimoniais } from './dashboardService'
import { listarMovimentacoes, buscarMovimentacaoPorId } from './movimentacoesService'
import { obterPerfilEfetivo, normalizarPerfil } from './permissionService'
import { loadSessionToken } from './authService'

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
  // Há dois fluxos de transferência coexistindo no SIGMO:
  // 1) tabela operacional legada sigmo_transferencias_patrimoniais;
  // 2) Engine Patrimonial, que grava em sigmo_patrimonio_movimentacoes.
  //
  // A Central consolida ambos. Em especial, transferências de HT feitas
  // pela Engine (ex.: SVDD -> P4 preservando MANUTENCAO) não existem na
  // tabela operacional legada.
  const [legadoRes, engineRes] = await Promise.allSettled([
    supabase
      .from('sigmo_transferencias_patrimoniais')
      .select('*')
      .eq('status', 'PENDENTE')
      .order('enviado_em', { ascending: true })
      .limit(500),

    supabase
      .from('sigmo_patrimonio_movimentacoes')
      .select(`
        id,
        protocolo,
        tipo_movimentacao,
        status_movimentacao,
        patrimonio_id,
        local_origem,
        local_destino,
        destino_guardiao_codigo,
        destino_guardiao_nome,
        motivo,
        observacao,
        dados,
        metadata,
        criado_em,
        created_at
      `)
      .eq('tipo_movimentacao', 'TRANSFERENCIA')
      .eq('status_movimentacao', 'PENDENTE')
      .order('criado_em', { ascending: true })
      .limit(500)
  ])

  const legado =
    legadoRes.status === 'fulfilled' && !legadoRes.value.error
      ? (legadoRes.value.data ?? [])
      : []

  if (legadoRes.status === 'fulfilled' && legadoRes.value.error) {
    console.warn(
      'Falha ao carregar transferências operacionais legadas:',
      legadoRes.value.error
    )
  }

  const engineBruto =
    engineRes.status === 'fulfilled' && !engineRes.value.error
      ? (engineRes.value.data ?? [])
      : []

  if (engineRes.status === 'fulfilled' && engineRes.value.error) {
    console.warn(
      'Falha ao carregar transferências da Engine Patrimonial:',
      engineRes.value.error
    )
  }

  // Por enquanto entram nesta consolidação somente as transferências de HT
  // identificadas explicitamente pela Engine. Isso evita alterar o
  // comportamento dos demais módulos que já usam a tabela operacional.
  const engineHT = engineBruto
    .filter((item) => {
      const dados = item?.dados || {}
      const dadosEngine = item?.metadata?.dados_engine || {}
      const modulo = normalizarSemAcentos(
        dados?.modulo ||
        dados?.categoria ||
        dadosEngine?.modulo ||
        dadosEngine?.categoria
      )

      return modulo === 'HT'
    })
    .map((item) => {
      const dados = item?.dados || {}
      const dadosEngine = item?.metadata?.dados_engine || {}
      const origemEngine =
        dados?.guardiao_origem?.codigo ||
        dadosEngine?.guardiao_origem?.codigo ||
        null
      const destinoEngine =
        item?.destino_guardiao_codigo ||
        dados?.guardiao_destino?.codigo ||
        dadosEngine?.guardiao_destino?.codigo ||
        null

      return {
        ...item,

        // Shape comum esperado pela Central/PainelOperacional.
        status: item?.status_movimentacao,
        tipo: item?.tipo_movimentacao,
        modulo: 'HT',
        categoria: 'HT',
        referencia_id:
          dados?.referencia_id ||
          dados?.ht_id ||
          dadosEngine?.referencia_id ||
          dadosEngine?.ht_id ||
          null,
        ht_id:
          dados?.ht_id ||
          dadosEngine?.ht_id ||
          null,
        patrimonio:
          dados?.patrimonio ||
          dadosEngine?.patrimonio ||
          item?.metadata?.patrimonio?.identificacao ||
          null,
        numero_serie:
          dados?.numero_serie ||
          dadosEngine?.numero_serie ||
          null,

        origem_codigo: origemEngine,
        origem_nome:
          dados?.guardiao_origem?.nome ||
          dadosEngine?.guardiao_origem?.nome ||
          item?.local_origem ||
          null,
        origem_local: item?.local_origem,
        destino_codigo: destinoEngine,
        destino_nome:
          item?.destino_guardiao_nome ||
          dados?.guardiao_destino?.nome ||
          dadosEngine?.guardiao_destino?.nome ||
          item?.local_destino ||
          null,
        destino_local: item?.local_destino,

        // ordenarRecentes/dataItem reconhece created_at.
        created_at: item?.created_at || item?.criado_em,

        origem_transferencia: 'ENGINE_PATRIMONIAL'
      }
    })

  // Evita duplicidade caso algum fluxo seja espelhado nas duas tabelas.
  const resultado = []
  const chaves = new Set()

  for (const item of [...legado, ...engineHT]) {
    const dados = item?.dados || {}
    const chave = [
      item?.id || '',
      item?.patrimonio_id || '',
      item?.referencia_id || dados?.referencia_id || '',
      item?.destino_codigo || item?.destino_guardiao_codigo || '',
      item?.created_at || item?.criado_em || item?.enviado_em || ''
    ].join('|')

    if (chaves.has(chave)) continue
    chaves.add(chave)
    resultado.push(item)
  }

  return resultado
}

function transferenciaParaPerfil(item, perfil) {
  if (!item || !perfil) return true
  if (perfil === 'ADMINISTRADOR') return true

  const origem = upper(
    item.origem_codigo ||
    item.origem_nome ||
    item.origem_local ||
    item.local_origem
  )

  const destino = upper(
    item.destino_codigo ||
    item.destino_nome ||
    item.destino_local ||
    item.local_destino
  )

  // A transferência pendente deve ser visível tanto para quem enviou
  // quanto para quem vai receber. Isso permite ao SVDD acompanhar uma
  // devolução SVDD -> P4 enquanto ela ainda aguarda recebimento.
  if (perfil.includes('SVDD')) {
    return (
      contem(origem, ['SVDD', 'SERVIÇO DE DIA', 'SERVICO DE DIA', 'COFRE DO SVDD']) ||
      contem(destino, ['SVDD', 'SERVIÇO DE DIA', 'SERVICO DE DIA', 'COFRE DO SVDD'])
    )
  }

  if (perfil.includes('P4')) {
    return (
      contem(origem, ['P4', 'DEPÓSITO', 'DEPOSITO', 'GUARDA DO P4', 'COFRE DO P4']) ||
      contem(destino, ['P4', 'DEPÓSITO', 'DEPOSITO', 'GUARDA DO P4', 'COFRE DO P4'])
    )
  }

  return false
}



async function listarManutencoesExternasAguardandoAprovacao() {
  const token = loadSessionToken()
  if (!token) return []

  const { data, error } = await supabase.rpc(
    'sigmo_listar_manutencoes_externas_pendentes',
    { p_token: token }
  )

  if (error) {
    console.warn('Falha ao carregar manutenções externas pendentes:', error)
    return []
  }

  return (data ?? []).map((item) => ({
    ...item,
    origem_aprovacao: 'MANUTENCAO_EXTERNA',
    tipo: 'MANUTENÇÃO EXTERNA',
    created_at: item?.solicitada_em || item?.created_at
  }))
}


export async function decidirManutencaoExterna({
  manutencaoExternaId,
  decisao,
  observacoes = null
}) {
  const token = loadSessionToken()

  if (!token) {
    throw new Error('Sessão SIGMO não localizada. Faça login novamente.')
  }

  const decisaoNormalizada = upper(decisao)

  if (!['APROVAR', 'REPROVAR'].includes(decisaoNormalizada)) {
    throw new Error('Decisão de manutenção externa inválida.')
  }

  const { data, error } = await supabase.rpc(
    'sigmo_decidir_manutencao_externa',
    {
      p_token: token,
      p_manutencao_externa_id: manutencaoExternaId,
      p_decisao: decisaoNormalizada,
      p_observacoes: texto(observacoes) || null
    }
  )

  if (error) throw error

  return data
}


export async function listarManutencoesExternasContagem() {
  const token = loadSessionToken()
  if (!token) return []

  const { data, error } = await supabase.rpc(
    'sigmo_listar_manutencoes_externas_contagem',
    { p_token: token }
  )

  if (error) {
    console.warn('Falha ao carregar contagem de manutenção externa:', error)
    return []
  }

  return data ?? []
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
    listarBaixasAguardandoAprovacao(),
    listarManutencoesExternasAguardandoAprovacao(),
    supabase
      .from('sigmo_manutencoes')
      .select('id, quantidade')
      .eq('status', 'EM_MANUTENCAO'),
    listarManutencoesExternasContagem()
  ])

  const [
    movRes,
    transfRes,
    novRes,
    patRes,
    baixasRes,
    manutExternasRes,
    manutInternasRes,
    manutExternasContagemRes
  ] = resultados
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

    const localAtual =
      item?.local_atual ||
      patrimonio?.local_atual ||
      null

    const cargaPelaCautela =
      contem(origemCautela, ['SVDD', 'SERVIÇO DE DIA', 'SERVICO DE DIA'])
        ? 'SVDD'
        : contem(origemCautela, ['P4', 'DEPÓSITO', 'DEPOSITO'])
          ? 'P4'
          : null

    const cargaPeloLocalAtual =
      contem(localAtual, ['SVDD', 'SERVIÇO DE DIA', 'SERVICO DE DIA', 'COFRE DO SVDD'])
        ? 'SVDD'
        : contem(localAtual, ['P4', 'DEPÓSITO', 'DEPOSITO', 'COFRE DO P4', 'GUARDA DO P4'])
          ? 'P4'
          : null

    // A responsabilidade operacional atual prevalece sobre a origem histórica
    // da cautela. A origem da cautela é usada somente como fallback quando o
    // patrimônio não possui um local atual reconhecido.
    const cargaAtual =
      cargaPeloLocalAtual ||
      cargaPelaCautela ||
      null

    return {
      ...item,
      local_atual: localAtual,
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
  const manutencoesExternasAprovacao =
    manutExternasRes.status === 'fulfilled' ? manutExternasRes.value : []

  const movPerfil = movimentacoes.filter((item) => pertenceAoPerfil(item, perfil))
  const transfPerfil = transferencias.filter((item) => transferenciaParaPerfil(item, perfil))

  const aguardandoAprovacao = aprovacoesVisiveisAoPerfil({
    movimentacoes: movPerfil,
    baixas: baixasAprovacao,
    perfil
  })

  const ehP4 = perfil.includes('P4')
  const ehComandante = perfil.includes('COMANDANTE')
  const manutencoesExternasPendentes = ordenarRecentes(manutencoesExternasAprovacao)

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

  const manutencoesExternasContagem =
    manutExternasContagemRes.status === 'fulfilled'
      ? (manutExternasContagemRes.value || [])
      : []

  const idsExternos = new Set(
    manutencoesExternasContagem
      .map((item) => String(item?.manutencao_id || ''))
      .filter(Boolean)
  )

  const manutencoesInternasContagem =
    manutInternasRes.status === 'fulfilled' && !manutInternasRes.value?.error
      ? (manutInternasRes.value?.data || [])
      : []

  const totalManutencaoInterna = manutencoesInternasContagem
    .filter((item) => !idsExternos.has(String(item?.id || '')))
    .reduce(
      (total, item) => total + Math.max(1, Number(item?.quantidade || 1)),
      0
    )

  const totalManutencaoExterna = manutencoesExternasContagem.reduce(
    (total, item) => total + Math.max(1, Number(item?.quantidade || 1)),
    0
  )

  return {
    perfil,
    atualizadoEm: new Date().toISOString(),
    manutencao_interna: totalManutencaoInterna,
    manutencao_externa: totalManutencaoExterna,
    alertas: [
      ...(ehComandante
        ? [{
            key: 'aprovacoes-comandante',
            titulo: 'Aprovações pendentes',
            total: aguardandoAprovacao.length + manutencoesExternasPendentes.length,
            itens: ordenarRecentes([
              ...aguardandoAprovacao,
              ...manutencoesExternasPendentes
            ]),
            tom: 'atencao'
          }]
        : [{
            key: 'aprovacoes',
            titulo: 'Aguardando aprovações',
            total: aguardandoAprovacao.length,
            itens: ordenarRecentes(aguardandoAprovacao),
            tom: 'atencao'
          }]),
      ...(ehP4 ? [{
        key: 'manutencao-externa-acompanhamento',
        titulo: 'Aguardando aprovação do Cmt',
        total: manutencoesExternasPendentes.length,
        itens: manutencoesExternasPendentes,
        tom: 'atencao'
      }] : []),
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
