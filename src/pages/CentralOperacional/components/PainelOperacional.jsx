import { useEffect, useMemo, useState } from 'react'

import { supabase } from '../../../services/supabaseClient'
import { loadSessionToken } from '../../../services/authService'

import {
  cancelarMovimentacao,
  confirmarRecebimentoMovimentacao
} from '../../../services/movimentacoesService'

import {
  finalizarDevolucaoCargaP4
} from '../../../services/armasService'

import {
  decidirManutencaoExterna
} from '../../../services/centralOperacionalService'

import {
  decidirDescargaColete
} from '../../../services/coletesBalisticosService'

import {
  aceitarTransferencia,
  aprovarTransferenciaTPDPeloCmt,
  recusarTransferencia
} from '../../../services/patrimonioTransferenciaService'

import {
  aceitarTransferenciaHT,
  recusarTransferenciaHT
} from '../../../services/htsTransferenciaService'

import {
  aceitarTransferenciaTaser,
  decidirTransferenciaTaserCmt,
  recusarTransferenciaTaser
} from '../../../services/tasersTransferenciaService'

import {
  aceitarTransferenciaManutencaoMunicao,
  aprovarDescargaManutencaoMunicaoCmt,
  recusarDescargaManutencaoMunicaoCmt,
  recusarTransferenciaManutencaoMunicao
} from '../../../services/municoesMovimentacoesService'

import {
  listarNovidadesVtrFluxo,
  registrarCienciaProvidenciaVtr,
  listarDocumentosNovidadeVtr,
  enviarDocumentoNovidadeVtr,
  excluirDocumentoNovidadeVtr
} from '../../../services/novidadesVtrService'

import {
  ehEncarregado,
  ehP4,
  ehComandante
} from '../../../services/permissionService'

function texto(valor) {
  return String(valor ?? '').trim()
}

function formatarData(valor) {
  if (!valor) return ''
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return ''
  return data.toLocaleString('pt-BR')
}

function tempoPendente(valor) {
  if (!valor) return ''

  const data = new Date(valor)

  if (Number.isNaN(data.getTime())) {
    return ''
  }

  const agora = new Date()

  const diferencaMs =
    Math.max(
      0,
      agora.getTime() -
      data.getTime()
    )

  const minutos =
    Math.floor(
      diferencaMs /
      (1000 * 60)
    )

  const horas =
    Math.floor(
      diferencaMs /
      (1000 * 60 * 60)
    )

  const dias =
    Math.floor(
      diferencaMs /
      (1000 * 60 * 60 * 24)
    )

  if (dias > 0) {
    return `Pendente há ${dias} ${dias === 1 ? 'dia' : 'dias'}`
  }

  if (horas > 0) {
    return `Pendente há ${horas} ${horas === 1 ? 'hora' : 'horas'}`
  }

  if (minutos > 0) {
    return `Pendente há ${minutos} min`
  }

  return 'Registrada agora'
}

function ehRecebimentoUsuario(secao) {
  return secao?.key === 'recebimentos'
}

function normalizarOperacional(valor) {
  return String(valor ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

function ehCancelavelAguardandoUsuario(item, secao) {
  if (!ehRecebimentoUsuario(secao)) return false

  const status = normalizarOperacional(
    item?.status
  ).replace(/ /g, '_')

  return (
    status === 'AGUARDANDO_RECEBIMENTO'
  )
}

function ehRecebimentoP4(item, secao) {
  if (!ehRecebimentoUsuario(secao)) return false

  const status = normalizarOperacional(item?.status)
    .replace(/ /g, '_')

  const destino = normalizarOperacional(
    item?.destino_local ||
    item?.destino_nome ||
    item?.destino_codigo
  )

  const tipo = normalizarOperacional(
    item?.tipo_movimentacao ||
    item?.tipo
  )

  return (
    status === 'AGUARDANDO_RECEBIMENTO' &&
    (
      destino.includes('P4') ||
      destino.includes('DEPOSITO DO P4')
    ) &&
    (
      tipo.includes('TRANSFERENCIA PARA O P4') ||
      tipo.includes('DEVOLUCAO') ||
      tipo.includes('TRANSFERENCIA')
    )
  )
}

function ehTransferencia(secao) {
  return secao?.key === 'transferencias'
}

function ehTransferenciaHTEngine(item, secao) {
  if (!ehTransferencia(secao)) return false

  const dados =
    item?.dados ||
    item?.metadata?.dados_engine ||
    {}

  const modulo = normalizarOperacional(
    item?.modulo ||
    item?.categoria ||
    dados?.modulo ||
    dados?.categoria
  )

  const origemTransferencia = normalizarOperacional(
    item?.origem_transferencia
  )

  const destino = normalizarOperacional(
    item?.destino_codigo ||
    item?.destino_guardiao_codigo ||
    item?.destino_local ||
    item?.destino_nome ||
    dados?.guardiao_destino?.codigo ||
    dados?.guardiao_destino?.nome
  )

  return (
    modulo === 'HT' &&
    origemTransferencia === 'ENGINE_PATRIMONIAL' &&
    (
      destino === 'P4' ||
      destino.includes('COFRE DO P4') ||
      destino.includes('GUARDA DO P4')
    )
  )
}


function ehTransferenciaManutencaoMunicaoEngine(item, secao) {
  if (!ehTransferencia(secao)) return false

  const dados =
    item?.dados ||
    item?.metadata?.dados_engine ||
    {}

  const modulo = normalizarOperacional(
    item?.modulo ||
    item?.categoria ||
    dados?.modulo ||
    dados?.categoria
  )

  const origem = normalizarOperacional(
    item?.origem_codigo ||
    item?.origem_guardiao_codigo ||
    item?.local_origem ||
    dados?.guardiao_origem?.codigo ||
    dados?.guardiao_origem?.nome
  )

  const destino = normalizarOperacional(
    item?.destino_codigo ||
    item?.destino_guardiao_codigo ||
    item?.destino_local ||
    item?.destino_nome ||
    dados?.guardiao_destino?.codigo ||
    dados?.guardiao_destino?.nome
  )

  const manutencaoEmTransferencia =
    dados?.manutencao_em_transferencia === true ||
    dados?.transferencia_manutencao_municao === true

  return (
    modulo === 'MUNICAO' &&
    manutencaoEmTransferencia &&
    (
      origem === 'SVDD' ||
      origem.includes('COFRE DO SVDD') ||
      origem.includes('SERVICO DE DIA')
    ) &&
    (
      destino === 'P4' ||
      destino.includes('COFRE DO P4') ||
      destino.includes('GUARDA DO P4')
    )
  )
}

function ehAprovacao(secao) {
  return ['aprovacoes', 'aprovacoes-comandante'].includes(secao?.key)
}

function ehAprovacaoComandante(secao) {
  return secao?.key === 'aprovacoes-comandante'
}

function itemEhManutencaoExterna(item) {
  return normalizarOperacional(item?.origem_aprovacao) === 'MANUTENCAO_EXTERNA'
}


function itemEhTransferenciaMunicao(item) {
  return (
    normalizarOperacional(
      item?.origem_aprovacao
    ) === 'MUNICAO_TRANSFERENCIA' ||
    normalizarOperacional(
      item?.tipo_solicitacao
    ) === 'TRANSFERENCIA_MUNICAO'
  )
}


function itemEhTransferenciaTorniquete(item) {
  return (
    normalizarOperacional(
      item?.origem_aprovacao
    ) === 'TORNIQUETE_TRANSFERENCIA' ||
    normalizarOperacional(
      item?.tipo_solicitacao
    ) === 'TRANSFERENCIA_TORNIQUETE' ||
    normalizarOperacional(
      item?.modulo
    ) === 'TORNIQUETE'
  )
}


function itemEhTransferenciaTPD(item) {
  return (
    normalizarOperacional(
      item?.origem_aprovacao
    ) === 'TPD_TRANSFERENCIA' ||
    normalizarOperacional(
      item?.tipo_solicitacao
    ) === 'TRANSFERENCIA_TPD'
  )
}


function itemEhTransferenciaTaser(item) {
  const dados =
    item?.dados ||
    item?.metadata?.dados_engine ||
    {}

  return (
    normalizarOperacional(
      item?.origem_aprovacao
    ) === 'TASER_TRANSFERENCIA' ||
    normalizarOperacional(
      item?.tipo_solicitacao
    ) === 'TRANSFERENCIA_TASER' ||
    normalizarOperacional(
      item?.modulo ||
      item?.categoria ||
      dados?.modulo ||
      dados?.categoria
    ) === 'TASER'
  )
}


function itemEhRecebimentoPatrimonialSVDD(
  item,
  secao
) {
  if (!ehTransferencia(secao)) {
    return false
  }

  const categoria =
    normalizarOperacional(
      item?.categoria ||
      item?.modulo
    )

  const destino =
    normalizarOperacional(
      item?.destino_codigo ||
      item?.destino_nome
    )

  const categoriasPatrimoniais =
    new Set([
      'ARMA',
      'TPD',
      'TONFA',
      'CASSETETE',
      'TASER'
    ])

  if (
    !categoriasPatrimoniais.has(
      categoria
    )
  ) {
    return false
  }

  const vaiParaSVDD =
    destino === 'SVDD' ||
    destino.includes(
      'COFRE DO SVDD'
    )

  if (!vaiParaSVDD) {
    return false
  }

  /*
   * TPD e Taser só podem ser recebidos depois da aprovação do Cmt.
   * Os demais materiais patrimoniais mantêm o fluxo próprio já existente.
   */
  if (
    categoria === 'TPD' &&
    item?.metadata?.cmt_aprovado !== true
  ) {
    return false
  }

  if (categoria === 'TASER') {
    const dados =
      item?.dados ||
      item?.metadata?.dados_engine ||
      {}

    const exigeAprovacao =
      dados?.exige_aprovacao_cmt === true

    const aprovacao =
      normalizarOperacional(
        dados?.status_aprovacao_cmt
      )

    if (
      exigeAprovacao &&
      aprovacao !== 'APROVADA'
    ) {
      return false
    }
  }

  return true
}


function itemEhRecebimentoTaserSVDD(
  item,
  secao
) {
  if (!ehTransferencia(secao)) {
    return false
  }

  const dados =
    item?.dados ||
    item?.metadata?.dados_engine ||
    {}

  const modulo =
    normalizarOperacional(
      item?.modulo ||
      item?.categoria ||
      dados?.modulo ||
      dados?.categoria
    )

  const origem =
    normalizarOperacional(
      item?.origem_codigo ||
      item?.origem_nome ||
      dados?.guardiao_origem?.codigo ||
      dados?.guardiao_origem?.nome
    )

  const destino =
    normalizarOperacional(
      item?.destino_codigo ||
      item?.destino_nome ||
      dados?.guardiao_destino?.codigo ||
      dados?.guardiao_destino?.nome
    )

  const exigeAprovacao =
    dados?.exige_aprovacao_cmt === true

  const aprovado =
    !exigeAprovacao ||
    normalizarOperacional(
      dados?.status_aprovacao_cmt
    ) === 'APROVADA'

  return (
    modulo === 'TASER' &&
    (
      origem === 'P4' ||
      origem.includes('COFRE DO P4') ||
      origem.includes('GUARDA DO P4')
    ) &&
    (
      destino === 'SVDD' ||
      destino.includes('COFRE DO SVDD') ||
      destino.includes('SERVICO DE DIA')
    ) &&
    aprovado
  )
}


function itemEhRecebimentoTPDSVDD(
  item,
  secao
) {
  if (!ehTransferencia(secao)) {
    return false
  }

  const categoria =
    normalizarOperacional(
      item?.categoria ||
      item?.modulo
    )

  const origem =
    normalizarOperacional(
      item?.origem_codigo ||
      item?.origem_nome
    )

  const destino =
    normalizarOperacional(
      item?.destino_codigo ||
      item?.destino_nome
    )

  const aprovado =
    item?.metadata?.cmt_aprovado === true

  return (
    categoria === 'TPD' &&
    (
      origem === 'P4' ||
      origem.includes('COFRE P4') ||
      origem.includes('COFRE DO P4')
    ) &&
    (
      destino === 'SVDD' ||
      destino.includes('COFRE DO SVDD')
    ) &&
    aprovado
  )
}


function itemEhRecebimentoTorniquete(
  item,
  secao
) {
  if (!ehTransferencia(secao)) {
    return false
  }

  const status =
    normalizarOperacional(
      item?.status ||
      item?.status_movimentacao
    )
      .replace(/ /g, '_')

  const origem =
    normalizarOperacional(
      item?.origem_aprovacao
    )

  const tipoSolicitacao =
    normalizarOperacional(
      item?.tipo_solicitacao
    )

  const modulo =
    normalizarOperacional(
      item?.modulo ||
      item?.categoria
    )

  return (
    status ===
      'AGUARDANDO_RECEBIMENTO' &&
    (
      origem ===
        'TORNIQUETE_RECEBIMENTO' ||
      tipoSolicitacao ===
        'RECEBIMENTO_TORNIQUETE' ||
      modulo ===
        'TORNIQUETE'
    )
  )
}

function itemEhManutencaoMunicao(item) {
  return (
    normalizarOperacional(
      item?.origem_aprovacao
    ) === 'MUNICAO_MANUTENCAO' ||
    normalizarOperacional(
      item?.tipo_solicitacao
    ) === 'TRANSFERENCIA_MANUTENCAO_MUNICAO'
  )
}

function itemEhDescargaMunicao(item) {
  return (
    normalizarOperacional(
      item?.origem_aprovacao
    ) === 'MUNICAO_DESCARGA' ||
    normalizarOperacional(
      item?.tipo_solicitacao
    ) === 'DESCARGA_MANUTENCAO_MUNICAO'
  )
}

function itemEhDescargaColete(item) {
  const origem =
    normalizarOperacional(
      item?.origem_aprovacao
    )

  const tipo =
    normalizarOperacional(
      item?.tipo_solicitacao ||
      item?.modulo ||
      item?.tipo_patrimonio ||
      ''
    )

  return (
    origem ===
      'BAIXA_PATRIMONIAL' &&
    (
      tipo.includes(
        'DESCARGA_COLETE'
      ) ||
      tipo.includes(
        'COLETE BALISTICO'
      )
    )
  )
}

function ehManutencaoExterna(secao) {
  return ['manutencao-externa-acompanhamento', 'manutencao-externa-aprovacoes'].includes(secao?.key)
}

function ehNovidade(secao) {
  return ['novidades', 'novidades-p4', 'novidades-svdd'].includes(secao?.key)
}

function ehAlertaValidadeColete(
  item
) {
  const tipo =
    normalizarOperacional(
      item?.tipo_patrimonio ||
      item?.especie ||
      item?.especie_patrimonio ||
      item?.tipo_especifico ||
      ''
    )

  const titulo =
    normalizarOperacional(
      item?.titulo ||
      ''
    )

  const status =
    normalizarOperacional(
      item?.status ||
      ''
    )

  return (
    tipo.includes(
      'COLETE BALISTICO'
    ) &&
    !item?.descarga_pendente &&
    (
      titulo ===
        'VALIDADE PROXIMA' ||
      titulo ===
        'VENCIDO' ||
      status ===
        'ALERTA DE VALIDADE' ||
      status ===
        'VENCIDO'
    )
  )
}

function textoValidadeColete(
  item
) {
  if (
    !ehAlertaValidadeColete(
      item
    ) ||
    !item?.validade
  ) {
    return ''
  }

  const partes =
    String(
      item.validade
    )
      .slice(0, 10)
      .split('-')
      .map(Number)

  if (
    partes.length !== 3 ||
    partes.some(
      (valor) =>
        !Number.isFinite(
          valor
        )
    )
  ) {
    return ''
  }

  const validade =
    new Date(
      partes[0],
      partes[1] - 1,
      partes[2],
      12,
      0,
      0,
      0
    )

  const agora =
    new Date()

  const hoje =
    new Date(
      agora.getFullYear(),
      agora.getMonth(),
      agora.getDate(),
      12,
      0,
      0,
      0
    )

  const diferencaDias =
    Math.round(
      (
        validade.getTime() -
        hoje.getTime()
      ) /
      86400000
    )

  if (
    diferencaDias < 0
  ) {
    const dias =
      Math.abs(
        diferencaDias
      )

    return `Vencido há ${dias} ${
      dias === 1
        ? 'dia'
        : 'dias'
    }`
  }

  if (
    diferencaDias === 0
  ) {
    return 'Vence hoje'
  }

  return `Validade próxima • vence em ${diferencaDias} ${
    diferencaDias === 1
      ? 'dia'
      : 'dias'
  }`
}

function textoSituacaoNovidade(
  item
) {
  if (
    item?.descarga_pendente
  ) {
    return tempoPendente(
      item?.descarga_solicitada_em ||
      item?.created_at ||
      item?.updated_at
    )
  }

  if (
    ehAlertaValidadeColete(
      item
    )
  ) {
    return textoValidadeColete(
      item
    )
  }

  return tempoPendente(
    item?.created_at ||
    item?.updated_at
  )
}

function ehIndicadorPatrimonio(secao) {
  return ['nao-localizados', 'baixados'].includes(secao?.key)
}

function tituloItem(item, secao) {
  if (itemEhTransferenciaTaser(item)) {
    const dados =
      item?.dados ||
      item?.metadata?.dados_engine ||
      {}

    const identificacao =
      item?.patrimonio ||
      item?.numero_serie ||
      dados?.patrimonio ||
      dados?.numero_serie ||
      item?.metadata?.patrimonio?.identificacao ||
      'Taser'

    return `Taser — ${identificacao}`
  }

  if (ehRecebimentoUsuario(secao)) {
    return (
      item?.recebedor_nome ||
      item?.policial_nome ||
      'Usuário destinatário'
    )
  }

  if (ehTransferencia(secao)) {
    return item?.protocolo || `${item?.origem_codigo || 'Origem'} → ${item?.destino_codigo || 'Destino'}`
  }

  if (
    ehAprovacao(secao) &&
    itemEhTransferenciaTPD(item)
  ) {
    const metadata =
      item?.metadata &&
      typeof item.metadata === 'object'
        ? item.metadata
        : {}

    return [
      metadata?.descricao_tpd ||
        [
          item?.marca || metadata?.marca,
          item?.modelo || metadata?.modelo
        ].map(texto).filter(Boolean).join(' '),
      item?.origem_nome && item?.destino_nome
        ? `${item.origem_nome} → ${item.destino_nome}`
        : '',
      item?.protocolo
        ? `PROTOCOLO: ${item.protocolo}`
        : '',
      item?.solicitada_por_nome
        ? `SOLICITADO POR: ${item.solicitada_por_nome}`
        : ''
    ].map(texto).filter(Boolean).join(' • ')
  }

  if (
    ehAprovacao(secao) &&
    itemEhTransferenciaMunicao(item)
  ) {
    return `Munições — ${item?.calibre || 'calibre não informado'}`
  }


  if (
    ehAprovacao(secao) &&
    itemEhTransferenciaTPD(item)
  ) {
    const metadata =
      item?.metadata &&
      typeof item.metadata === 'object'
        ? item.metadata
        : {}

    const identificacao =
      item?.patrimonio ||
      item?.numero_serie ||
      metadata?.patrimonio_tpd ||
      metadata?.numero_serie_tpd ||
      metadata?.descricao_tpd ||
      'TPD'

    return `TPD — ${identificacao}`
  }

  if (
    ehAprovacao(secao) &&
    itemEhTransferenciaTorniquete(item)
  ) {
    return 'Torniquete — transferência'
  }

  if (
    ehAprovacao(secao) &&
    itemEhTransferenciaTorniquete(item)
  ) {
    return [
      Number(
        item?.quantidade_total ||
        item?.quantidade ||
        0
      ) > 0
        ? `${Number(
            item?.quantidade_total ||
            item?.quantidade ||
            0
          )} un.`
        : '',
      item?.origem_nome && item?.destino_nome
        ? `${item.origem_nome} → ${item.destino_nome}`
        : '',
      item?.solicitada_por_nome
        ? `SOLICITADO POR: ${item.solicitada_por_nome}`
        : '',
      item?.documento
        ? `DOCUMENTO: ${item.documento}`
        : '',
      item?.observacoes
    ].map(texto).filter(Boolean).join(' • ')
  }

  if (
    ehAprovacao(secao) &&
    itemEhManutencaoMunicao(item)
  ) {
    return `Manutenção de munições — ${item?.calibre || 'calibre não informado'}`
  }

  if (
    ehAprovacao(secao) &&
    itemEhDescargaMunicao(item)
  ) {
    return `Descarga de munições — ${item?.calibre || 'calibre não informado'}`
  }

  if (ehAprovacao(secao) && item?.origem_aprovacao === 'BAIXA_PATRIMONIAL') {
    return `Baixa de ${item?.modulo || 'patrimônio'} — ${item?.patrimonio || item?.numero_serie || 'item'}`
  }

  if (ehManutencaoExterna(secao) || itemEhManutencaoExterna(item)) {
    return item?.protocolo || `Manutenção externa — ${item?.destino_nome || 'destino não informado'}`
  }

  if (ehNovidade(secao)) {
    const identificador =
      item?.patrimonio ||
      item?.numero_patrimonio ||
      item?.numero_serie ||
      item?.identificador ||
      item?.referencia ||
      ''

    const patrimonio =
      [
        item?.especie ||
        item?.especie_patrimonio ||
        item?.tipo_especifico ||
        item?.tipo_patrimonio ||
        'Patrimônio',
        identificador
      ]
        .map(texto)
        .filter(Boolean)
        .join(' — ')

    return `${patrimonio} — ${item?.titulo || 'Novidade patrimonial'}`
  }

  if (ehIndicadorPatrimonio(secao)) {
    return (
      item?.identificador ||
      item?.patrimonio ||
      item?.numero_serie ||
      item?.descricao ||
      `${item?.tipo || 'Patrimônio'}`
    )
  }

  return (
    item?.titulo ||
    item?.tipo_movimentacao ||
    item?.tipo ||
    item?.descricao ||
    item?.protocolo ||
    item?.identificador ||
    item?.numero_patrimonio ||
    'Registro operacional'
  )
}

function resumirItens(item) {
  const itens = Array.isArray(item?.itens) ? item.itens : []
  if (itens.length === 0) return ''

  const descricoes = itens.map((registro) => {
    const nome =
      registro?.descricao ||
      registro?.tipo_patrimonio ||
      registro?.patrimonio ||
      'Material'
    const quantidade = Number(registro?.quantidade || 1)
    return `${nome}${quantidade > 1 ? ` (${quantidade})` : ''}`
  })

  return descricoes.join(', ')
}

function obterFotosNovidade(item) {
  const fotos =
    Array.isArray(item?.fotos)
      ? item.fotos
      : []

  if (fotos.length > 0) {
    return fotos
      .map((foto) => ({
        ...foto,
        foto_url:
          foto?.foto_url ||
          foto?.url ||
          null
      }))
      .filter(
        (foto) =>
          Boolean(foto?.foto_url)
      )
  }

  if (item?.foto_url) {
    return [
      {
        foto_url:
          item.foto_url,
        principal: true,
        ordem: 1
      }
    ]
  }

  return []
}


function obterFotosDescargaMunicao(item) {
  const dados =
    item?.dados &&
    typeof item.dados === 'object'
      ? item.dados
      : (
          item?.metadata?.dados_engine &&
          typeof item.metadata.dados_engine === 'object'
            ? item.metadata.dados_engine
            : {}
        )

  const fontes = [
    ...(Array.isArray(item?.fotos)
      ? item.fotos
      : []),
    ...(Array.isArray(dados?.fotos)
      ? dados.fotos
      : [])
  ]

  const porUrl =
    new Map()

  for (const foto of fontes) {
    const url =
      foto?.foto_url ||
      foto?.url ||
      null

    if (!url) {
      continue
    }

    porUrl.set(
      String(url),
      {
        ...foto,
        foto_url:
          url
      }
    )
  }

  const urls = [
    ...(Array.isArray(item?.foto_urls)
      ? item.foto_urls
      : []),
    ...(Array.isArray(dados?.foto_urls)
      ? dados.foto_urls
      : [])
  ]

  for (const url of urls) {
    const endereco =
      String(url || '').trim()

    if (!endereco) {
      continue
    }

    if (!porUrl.has(endereco)) {
      porUrl.set(
        endereco,
        {
          foto_url:
            endereco
        }
      )
    }
  }

  return Array.from(
    porUrl.values()
  )
}


function detalheItem(item, secao) {
  if (itemEhTransferenciaTaser(item)) {
    const dados =
      item?.dados ||
      item?.metadata?.dados_engine ||
      {}

    const equipamento =
      [
        item?.marca || dados?.marca,
        item?.modelo || dados?.modelo
      ]
        .map(texto)
        .filter(Boolean)
        .join(' ')

    const origem =
      item?.origem_nome ||
      item?.origem_codigo ||
      dados?.guardiao_origem?.nome ||
      dados?.guardiao_origem?.codigo ||
      'COFRE DO P4'

    const destino =
      item?.destino_nome ||
      item?.destino_codigo ||
      dados?.destino_nome ||
      dados?.guardiao_destino?.nome ||
      dados?.guardiao_destino?.codigo ||
      'DESTINO NÃO INFORMADO'

    const solicitante =
      item?.solicitada_por_nome ||
      item?.criado_por_nome ||
      item?.enviado_por_nome ||
      item?.metadata?.realizado_por?.nome ||
      'P4'

    return [
      equipamento,
      `${origem} → ${destino}`,
      `SOLICITADO POR: ${solicitante}`
    ]
      .map(texto)
      .filter(Boolean)
      .join(' • ')
  }

  if (ehIndicadorPatrimonio(secao)) {
    return [
      item?.tipo,
      item?.status_operacional || item?.status,
      item?.local_atual,
      item?.responsavel_atual_nome || item?.responsavel_nome
    ].map(texto).filter(Boolean).join(' • ')
  }

  if (ehNovidade(secao)) {
    return [
      item?.descricao,
      item?.providencia || item?.providencia_sugerida
        ? `PROVIDÊNCIA SUGERIDA: ${item?.providencia || item?.providencia_sugerida}`
        : '',
      item?.gravidade,
      item?.status,
      item?.registrado_por_nome
    ].map(texto).filter(Boolean).join(' • ')
  }

  if (
    ehAprovacao(secao) &&
    itemEhTransferenciaMunicao(item)
  ) {
    return [
      item?.quantidade_total
        ? `${item.quantidade_total} un.`
        : '',
      item?.origem_nome && item?.destino_nome
        ? `${item.origem_nome} → ${item.destino_nome}`
        : '',
      item?.solicitada_por_nome
        ? `SOLICITADO POR: ${item.solicitada_por_nome}`
        : '',
      item?.documento
        ? `DOCUMENTO: ${item.documento}`
        : '',
      item?.observacoes
    ].map(texto).filter(Boolean).join(' • ')
  }

  if (
    ehAprovacao(secao) &&
    itemEhManutencaoMunicao(item)
  ) {
    return [
      Number(item?.quantidade_total || item?.quantidade || 0) > 0
        ? `${Number(item?.quantidade_total || item?.quantidade || 0)} un.`
        : '',
      item?.origem_nome && item?.destino_nome
        ? `${item.origem_nome} → ${item.destino_nome}`
        : '',
      item?.solicitada_por_nome
        ? `SOLICITADO POR: ${item.solicitada_por_nome}`
        : '',
      item?.observacoes
    ].map(texto).filter(Boolean).join(' • ')
  }

  if (
    ehAprovacao(secao) &&
    itemEhDescargaMunicao(item)
  ) {
    return [
      Number(item?.quantidade_total || item?.quantidade || 0) > 0
        ? `${Number(item?.quantidade_total || item?.quantidade || 0)} un.`
        : '',
      item?.origem_nome
        ? `ORIGEM: ${item.origem_nome}`
        : 'ORIGEM: COFRE DO P4',
      item?.destino_nome
        ? `DESTINO FINAL: ${item.destino_nome}`
        : '',
      item?.motivo
        ? `MOTIVO: ${item.motivo}`
        : '',
      item?.solicitada_por_nome
        ? `SOLICITADO POR: ${item.solicitada_por_nome}`
        : '',
      item?.documento
        ? `DOCUMENTO: ${item.documento}`
        : '',
      item?.observacoes
    ].map(texto).filter(Boolean).join(' • ')
  }

  if (ehAprovacao(secao) && item?.origem_aprovacao === 'BAIXA_PATRIMONIAL') {
    return [
      item?.motivo,
      item?.solicitada_por_nome,
      item?.observacoes
    ].map(texto).filter(Boolean).join(' • ')
  }

  if (ehManutencaoExterna(secao)) {
    return [
      item?.destino_nome ? `DESTINO: ${item.destino_nome}` : '',
      item?.servico_solicitado || item?.motivo,
      item?.solicitada_por_nome ? `SOLICITADA POR: ${item.solicitada_por_nome}` : '',
      item?.status
    ].map(texto).filter(Boolean).join(' • ')
  }

  if (ehTransferencia(secao)) {
    const metadata = item?.metadata && typeof item.metadata === 'object' ? item.metadata : {}
    const material =
      metadata?.descricao_tpd ||
      metadata?.patrimonio_tpd ||
      metadata?.numero_serie_tpd ||
      metadata?.descricao_arma ||
      metadata?.patrimonio_arma ||
      item?.categoria ||
      'Patrimônio'

    return [
      material,
      item?.quantidade ? `${item.quantidade} un.` : '',
      item?.origem_nome && item?.destino_nome ? `${item.origem_nome} → ${item.destino_nome}` : '',
      item?.enviado_por_nome
    ].map(texto).filter(Boolean).join(' • ')
  }

  if (ehRecebimentoUsuario(secao)) {
    const materiais = resumirItens(item)
    const partes = [
      item?.recebedor_re ? `RE ${item.recebedor_re}` : '',
      materiais || 'Materiais aguardando confirmação',
      item?.origem_local && item?.destino_local
        ? `${item.origem_local} → ${item.destino_local}`
        : ''
    ].map(texto).filter(Boolean)

    return partes.join(' • ')
  }

  const partes = [
    item?.descricao,
    item?.status,
    item?.origem_local && item?.destino_local
      ? `${item.origem_local} → ${item.destino_local}`
      : item?.local_atual,
    item?.registrado_por_nome || item?.solicitante_nome
  ].map(texto).filter(Boolean)

  return [...new Set(partes)].join(' • ')
}


async function cancelarMunicoesVinculadasAoCarrinho(
  movimentacaoPrincipalId
) {
  if (!movimentacaoPrincipalId) {
    return {
      canceladas: 0
    }
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
    'sigmo_municoes_cancelar_por_movimentacao_principal',
    {
      p_token:
        token,

      p_movimentacao_principal_id:
        movimentacaoPrincipalId,

      p_motivo:
        'MOVIMENTAÇÃO PRINCIPAL CANCELADA PELO SETOR RESPONSÁVEL ANTES DO RECEBIMENTO PELO USUÁRIO.'
    }
  )

  if (error) {
    throw error
  }

  return (
    data && typeof data === 'object'
      ? data
      : {
          canceladas: 0
        }
  )
}


async function listarMunicoesVinculadasAosCarrinhos(
  movimentacaoIds
) {
  const ids =
    (movimentacaoIds || [])
      .map((id) =>
        String(id || '').trim()
      )
      .filter(Boolean)

  if (ids.length === 0) {
    return []
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
    'sigmo_municoes_listar_vinculadas_movimentacoes',
    {
      p_token:
        token,

      p_movimentacao_ids:
        ids
    }
  )

  if (error) {
    throw error
  }

  return Array.isArray(data)
    ? data
    : []
}



export default function PainelOperacional({ dados, carregando, user, onAtualizar, onAbrirRivViatura }) {
  const [decidindoManutencaoExternaId, setDecidindoManutencaoExternaId] = useState(null)
  const [decidindoMunicaoId, setDecidindoMunicaoId] = useState(null)
  const [decidindoTorniqueteId, setDecidindoTorniqueteId] = useState(null)
  const [decidindoTPDId, setDecidindoTPDId] = useState(null)
  const [aprovandoTodosTPDs, setAprovandoTodosTPDs] = useState(false)
  const [decidindoTaserId, setDecidindoTaserId] = useState(null)
  const [aprovandoTodosTasers, setAprovandoTodosTasers] = useState(false)
  const [recebendoTodosTPDs, setRecebendoTodosTPDs] = useState(false)
  const [novidadesVtr, setNovidadesVtr] = useState([])
  const [carregandoNovidadesVtr, setCarregandoNovidadesVtr] = useState(false)
  const [manutencoesVtr, setManutencoesVtr] = useState([])
  const [carregandoManutencoesVtr, setCarregandoManutencoesVtr] = useState(false)
  const [novidadeVtrAberta, setNovidadeVtrAberta] = useState(null)
  const [documentosVtr, setDocumentosVtr] = useState([])
  const [arquivoVtr, setArquivoVtr] = useState(null)
  const [salvandoCienciaVtr, setSalvandoCienciaVtr] = useState(false)
  const [formCienciaVtr, setFormCienciaVtr] = useState({
    providencia: '',
    observacao: '',
    documento: ''
  })

  const perfilVtr = ehEncarregado(user)
    ? 'SVDD'
    : ehP4(user)
    ? 'P4'
    : ehComandante(user)
    ? 'CMT'
    : null

  async function carregarNovidadesVtr() {
    if (!perfilVtr) {
      setNovidadesVtr([])
      return
    }

    try {
      setCarregandoNovidadesVtr(true)
      setNovidadesVtr(await listarNovidadesVtrFluxo())
    } catch (error) {
      console.error('Erro ao carregar novidades de VTR:', error)
    } finally {
      setCarregandoNovidadesVtr(false)
    }
  }

  async function carregarManutencoesVtr() {
    if (!perfilVtr) {
      setManutencoesVtr([])
      return
    }

    try {
      setCarregandoManutencoesVtr(true)

      const { data: ocorrencias, error: ocorrenciasError } = await supabase
        .from('sigmo_viaturas_riv_ocorrencias')
        .select(
          'id, viatura_id, tipo, titulo, descricao, resolvida, manutencao_status, manutencao_tipo, manutencao_execucao, providencia_atual, manutencao_oficina, manutencao_local, manutencao_os, manutencao_observacoes, quilometragem, created_at, updated_at'
        )
        .eq('tipo', 'MANUTENCAO')
        .eq('resolvida', false)
        .order('created_at', { ascending: false })

      if (ocorrenciasError) throw ocorrenciasError

      const idsViaturas = [
        ...new Set(
          (ocorrencias || [])
            .map((item) => item?.viatura_id)
            .filter(Boolean)
        )
      ]

      let viaturasPorId = new Map()

      if (idsViaturas.length > 0) {
        const { data: viaturas, error: viaturasError } = await supabase
          .from('sigmo_viaturas')
          .select('id, prefixo, placa, modelo, situacao')
          .in('id', idsViaturas)

        if (viaturasError) throw viaturasError

        viaturasPorId = new Map(
          (viaturas || []).map((viatura) => [String(viatura.id), viatura])
        )
      }

      setManutencoesVtr(
        (ocorrencias || []).map((item) => {
          const viatura = viaturasPorId.get(String(item.viatura_id)) || {}

          return {
            ...item,
            prefixo: viatura.prefixo || 'VTR',
            placa: viatura.placa || null,
            modelo: viatura.modelo || null,
            situacao_viatura: viatura.situacao || null,
            status: item.manutencao_status || 'AGUARDANDO_PROVIDENCIA',
            tipo_movimentacao: 'MANUTENÇÃO DE VTR',
            titulo_original: item.titulo,
            titulo: `${viatura.prefixo || 'VTR'} — ${item.titulo || 'MANUTENÇÃO'}`,
            descricao: [
              item.descricao,
              item.manutencao_execucao
                ? `EXECUÇÃO: ${String(item.manutencao_execucao).replaceAll('_', ' ')}`
                : '',
              item.manutencao_tipo
                ? `TIPO: ${String(item.manutencao_tipo).replaceAll('_', ' ')}`
                : '',
              item.providencia_atual
                ? `PROVIDÊNCIA: ${item.providencia_atual}`
                : ''
            ]
              .filter(Boolean)
              .join(' • ')
          }
        })
      )
    } catch (error) {
      console.error('Erro ao carregar manutenções de VTR:', error)
      setManutencoesVtr([])
    } finally {
      setCarregandoManutencoesVtr(false)
    }
  }

  useEffect(() => {
    carregarNovidadesVtr()
    carregarManutencoesVtr()
  }, [perfilVtr])

  const novidadesVtrExibidas = useMemo(() => {
    if (!perfilVtr) return []

    if (perfilVtr === 'SVDD') {
      return novidadesVtr.filter((item) =>
        String(item.fluxo_novidade_status || '') === 'PENDENTE_SVDD'
      )
    }

    if (perfilVtr === 'P4') {
      return novidadesVtr.filter((item) => {
        const status =
          String(
            item.fluxo_novidade_status || ''
          )

        return [
          'PENDENTE_SVDD',
          'PENDENTE_P4'
        ].includes(status)
      })
    }

    return novidadesVtr
  }, [novidadesVtr, perfilVtr])

  async function abrirNovidadeVtr(item) {
    setNovidadeVtrAberta(item)
    setFormCienciaVtr({ providencia: '', observacao: '', documento: '' })
    setArquivoVtr(null)
    try {
      setDocumentosVtr(await listarDocumentosNovidadeVtr(item.ocorrencia_id))
    } catch (error) {
      console.error('Erro ao carregar documentos da novidade de VTR:', error)
      setDocumentosVtr([])
    }
  }

  async function salvarCienciaVtr() {
    if (!novidadeVtrAberta || !perfilVtr || perfilVtr === 'CMT') return

    if (!formCienciaVtr.providencia.trim()) {
      window.alert('Informe a providência adotada.')
      return
    }

    try {
      setSalvandoCienciaVtr(true)

      await registrarCienciaProvidenciaVtr({
        ocorrenciaId: novidadeVtrAberta.ocorrencia_id,
        etapa: perfilVtr,
        providencia: formCienciaVtr.providencia.trim().toUpperCase(),
        observacao: formCienciaVtr.observacao.trim().toUpperCase(),
        documento: formCienciaVtr.documento.trim().toUpperCase(),
        user
      })

      if (arquivoVtr) {
        await enviarDocumentoNovidadeVtr({
          viaturaId: novidadeVtrAberta.viatura_id,
          ocorrenciaId: novidadeVtrAberta.ocorrencia_id,
          etapa: perfilVtr,
          arquivo: arquivoVtr,
          user
        })
      }

      setNovidadeVtrAberta(null)
      setDocumentosVtr([])
      setArquivoVtr(null)
      await carregarNovidadesVtr()

      if (typeof onAtualizar === 'function') {
        await onAtualizar()
      }
    } catch (error) {
      window.alert(error?.message || 'Não foi possível registrar a ciência/providência.')
    } finally {
      setSalvandoCienciaVtr(false)
    }
  }

  async function excluirDocumentoVtr(documento) {
    if (!window.confirm('Excluir este arquivo anexado? A exclusão do arquivo não apaga a trilha da providência.')) return

    try {
      await excluirDocumentoNovidadeVtr(documento)
      setDocumentosVtr(await listarDocumentosNovidadeVtr(novidadeVtrAberta.ocorrencia_id))
    } catch (error) {
      window.alert(error?.message || 'Não foi possível excluir o documento.')
    }
  }


  async function aprovarTransferenciaMunicaoNaCentral(
    item
  ) {
    const transferenciaId =
      item?.transferencia_id ||
      item?.id

    if (
      !transferenciaId ||
      decidindoMunicaoId
    ) {
      return
    }

    const confirmou =
      window.confirm(
        `Aprovar a transferência de ${Number(
          item?.quantidade_total ||
          0
        )} unidade(s) de ${
          item?.calibre ||
          'munição'
        }?\n\n${
          item?.origem_nome ||
          'COFRE DO P4'
        } → ${
          item?.destino_nome ||
          'COFRE DO SVDD'
        }`
      )

    if (!confirmou) {
      return
    }

    const token =
      loadSessionToken()

    if (!token) {
      window.alert(
        'Sessão SIGMO inválida ou expirada.'
      )
      return
    }

    try {
      setDecidindoMunicaoId(
        transferenciaId
      )

      const { error } =
        await supabase.rpc(
          'sigmo_municoes_aprovar_transferencia',
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

      setRegistroAberto(null)

      // Mantém a janela "Aprovações pendentes" aberta.
      // Remove somente a solicitação que acabou de ser aprovada;
      // o card/contadores da Central são recarregados logo em seguida.
      setSelecionado(
        (atual) => {
          if (!atual) {
            return atual
          }

          return {
            ...atual,

            itens:
              (atual.itens || []).filter(
                (registro) =>
                  String(
                    registro?.transferencia_id ||
                    registro?.id ||
                    ''
                  ) !==
                  String(
                    transferenciaId
                  )
              )
          }
        }
      )

      if (
        typeof onAtualizar ===
        'function'
      ) {
        await onAtualizar()
      }
    } catch (error) {
      window.alert(
        error?.message ||
        'Não foi possível aprovar a transferência de munições.'
      )
    } finally {
      setDecidindoMunicaoId(
        null
      )
    }
  }



  async function receberTransferenciaTaserNoSVDD(
    item,
    { semConfirmacao = false } = {}
  ) {
    const movimentacaoId =
      item?.movimentacao_id ||
      item?.transferencia_id ||
      item?.id

    if (
      !movimentacaoId ||
      recebendoId ||
      recusandoId ||
      recebendoTodosTPDs
    ) {
      return false
    }

    const dados =
      item?.dados ||
      item?.metadata?.dados_engine ||
      {}

    const identificacao =
      item?.patrimonio ||
      item?.numero_serie ||
      dados?.patrimonio ||
      dados?.numero_serie ||
      item?.metadata?.patrimonio?.identificacao ||
      'Taser'

    if (!semConfirmacao) {
      const confirmou =
        window.confirm(
          `Confirmar o recebimento da Taser ${identificacao} no COFRE DO SVDD?`
        )

      if (!confirmou) {
        return false
      }
    }

    try {
      setRecebendoId(
        movimentacaoId
      )

      await aceitarTransferenciaTaser({
        movimentacaoId,
        user
      })

      setRegistroAberto(
        null
      )

      setSelecionado(
        (atual) => {
          if (!atual) {
            return atual
          }

          const itensRestantes =
            (atual.itens || []).filter(
              (registro) =>
                String(
                  registro?.movimentacao_id ||
                  registro?.transferencia_id ||
                  registro?.id ||
                  ''
                ) !==
                String(
                  movimentacaoId
                )
            )

          return {
            ...atual,
            total:
              itensRestantes.length,
            itens:
              itensRestantes
          }
        }
      )

      if (
        typeof onAtualizar ===
        'function'
      ) {
        await onAtualizar()
      }

      return true
    } catch (error) {
      console.error(
        'Erro ao receber transferência de Taser no SVDD:',
        error
      )

      window.alert(
        error?.message ||
        'Não foi possível receber a Taser no SVDD.'
      )

      return false
    } finally {
      setRecebendoId(
        null
      )
    }
  }


  async function recusarTransferenciaTaserNoSVDD(
    item
  ) {
    const movimentacaoId =
      item?.movimentacao_id ||
      item?.transferencia_id ||
      item?.id

    if (
      !movimentacaoId ||
      recebendoId ||
      recusandoId ||
      recebendoTodosTPDs
    ) {
      return
    }

    const dados =
      item?.dados ||
      item?.metadata?.dados_engine ||
      {}

    const identificacao =
      item?.patrimonio ||
      item?.numero_serie ||
      dados?.patrimonio ||
      dados?.numero_serie ||
      item?.metadata?.patrimonio?.identificacao ||
      'Taser'

    const motivo =
      window.prompt(
        `Informe o motivo da recusa da Taser ${identificacao}:`
      )

    if (motivo === null) {
      return
    }

    const motivoNormalizado =
      String(
        motivo || ''
      )
        .trim()
        .toUpperCase()

    if (!motivoNormalizado) {
      window.alert(
        'Informe o motivo da recusa.'
      )
      return
    }

    const confirmou =
      window.confirm(
        `Recusar o recebimento da Taser ${identificacao}?\n\nO patrimônio permanecerá no COFRE DO P4.`
      )

    if (!confirmou) {
      return
    }

    try {
      setRecusandoId(
        movimentacaoId
      )

      await recusarTransferenciaTaser({
        movimentacaoId,
        motivo:
          `RECUSADA PELO SVDD: ${motivoNormalizado}`,
        user
      })

      setRegistroAberto(
        null
      )

      setSelecionado(
        (atual) => {
          if (!atual) {
            return atual
          }

          const itensRestantes =
            (atual.itens || []).filter(
              (registro) =>
                String(
                  registro?.movimentacao_id ||
                  registro?.transferencia_id ||
                  registro?.id ||
                  ''
                ) !==
                String(
                  movimentacaoId
                )
            )

          return {
            ...atual,
            total:
              itensRestantes.length,
            itens:
              itensRestantes
          }
        }
      )

      if (
        typeof onAtualizar ===
        'function'
      ) {
        await onAtualizar()
      }
    } catch (error) {
      console.error(
        'Erro ao recusar transferência de Taser no SVDD:',
        error
      )

      window.alert(
        error?.message ||
        'Não foi possível recusar a transferência da Taser.'
      )
    } finally {
      setRecusandoId(
        null
      )
    }
  }


  async function receberTransferenciaTPDNoSVDD(
    item,
    { semConfirmacao = false } = {}
  ) {
    const transferenciaId =
      item?.transferencia_id ||
      item?.id

    if (
      !transferenciaId ||
      recebendoId ||
      recusandoId ||
      recebendoTodosTPDs
    ) {
      return false
    }

    const metadata =
      item?.metadata &&
      typeof item.metadata === 'object'
        ? item.metadata
        : {}

    const identificacao =
      item?.patrimonio ||
      item?.numero_serie ||
      metadata?.patrimonio_tpd ||
      metadata?.numero_serie_tpd ||
      metadata?.descricao_tpd ||
      'TPD'

    if (!semConfirmacao) {
      const confirmou =
        window.confirm(
          `Confirmar o recebimento do TPD ${identificacao}?\n\n` +
          `${item?.origem_nome || 'COFRE DO P4'} → ${item?.destino_nome || 'COFRE DO SVDD'}`
        )

      if (!confirmou) {
        return false
      }
    }

    try {
      setRecebendoId(
        transferenciaId
      )

      await aceitarTransferencia({
        transferenciaId,
        user
      })

      setRegistroAberto(null)

      setSelecionado(
        (atual) => {
          if (!atual) {
            return atual
          }

          const itensRestantes =
            (atual.itens || []).filter(
              (registro) =>
                String(
                  registro?.transferencia_id ||
                  registro?.id ||
                  ''
                ) !==
                String(
                  transferenciaId
                )
            )

          return {
            ...atual,
            total:
              itensRestantes.length,
            itens:
              itensRestantes
          }
        }
      )

      if (
        typeof onAtualizar ===
        'function'
      ) {
        await onAtualizar()
      }

      return true
    } catch (error) {
      console.error(
        'Erro ao receber transferência de TPD no SVDD:',
        error
      )

      window.alert(
        error?.message ||
        'Não foi possível receber a transferência do TPD.'
      )

      return false
    } finally {
      setRecebendoId(
        null
      )
    }
  }


  async function recusarTransferenciaTPDNoSVDD(
    item
  ) {
    const transferenciaId =
      item?.transferencia_id ||
      item?.id

    if (
      !transferenciaId ||
      recebendoId ||
      recusandoId ||
      recebendoTodosTPDs
    ) {
      return
    }

    const metadata =
      item?.metadata &&
      typeof item.metadata === 'object'
        ? item.metadata
        : {}

    const identificacao =
      item?.patrimonio ||
      item?.numero_serie ||
      metadata?.patrimonio_tpd ||
      metadata?.numero_serie_tpd ||
      metadata?.descricao_tpd ||
      'TPD'

    const motivo =
      window.prompt(
        `Informe o motivo da recusa do TPD ${identificacao}:`
      )

    if (motivo === null) {
      return
    }

    const motivoNormalizado =
      String(
        motivo || ''
      )
        .trim()
        .toUpperCase()

    if (!motivoNormalizado) {
      window.alert(
        'Informe o motivo da recusa.'
      )
      return
    }

    const confirmou =
      window.confirm(
        `Recusar o recebimento do TPD ${identificacao}?\n\n` +
        'O TPD permanecerá no COFRE DO P4.'
      )

    if (!confirmou) {
      return
    }

    try {
      setRecusandoId(
        transferenciaId
      )

      await recusarTransferencia({
        transferenciaId,
        motivoRecusa:
          `RECUSADA PELO SVDD: ${motivoNormalizado}`,
        user
      })

      setRegistroAberto(null)

      setSelecionado(
        (atual) => {
          if (!atual) {
            return atual
          }

          const itensRestantes =
            (atual.itens || []).filter(
              (registro) =>
                String(
                  registro?.transferencia_id ||
                  registro?.id ||
                  ''
                ) !==
                String(
                  transferenciaId
                )
            )

          return {
            ...atual,
            total:
              itensRestantes.length,
            itens:
              itensRestantes
          }
        }
      )

      if (
        typeof onAtualizar ===
        'function'
      ) {
        await onAtualizar()
      }
    } catch (error) {
      console.error(
        'Erro ao recusar transferência de TPD no SVDD:',
        error
      )

      window.alert(
        error?.message ||
        'Não foi possível recusar a transferência do TPD.'
      )
    } finally {
      setRecusandoId(
        null
      )
    }
  }


  async function receberTodosNoSVDD() {
    if (
      recebendoTodosTPDs ||
      recebendoId ||
      recusandoId
    ) {
      return
    }

    const itensRecebiveis =
      (selecionado?.itens || [])
        .filter(
          (item) =>
            itemEhRecebimentoPatrimonialSVDD(
              item,
              selecionado
            )
        )

    if (itensRecebiveis.length === 0) {
      window.alert(
        'Não há materiais compatíveis liberados para recebimento.'
      )
      return
    }

    const confirmou =
      window.confirm(
        `Confirmar o recebimento de ${itensRecebiveis.length} material(is)?\n\n` +
        'Cada item será recebido conforme o fluxo patrimonial já definido para sua categoria.'
      )

    if (!confirmou) {
      return
    }

    try {
      setRecebendoTodosTPDs(
        true
      )

      const recebidos = []
      const falhas = []

      for (const item of itensRecebiveis) {
        const transferenciaId =
          item?.transferencia_id ||
          item?.id

        if (!transferenciaId) {
          continue
        }

        try {
          if (
            itemEhRecebimentoTaserSVDD(
              item,
              selecionado
            )
          ) {
            await aceitarTransferenciaTaser({
              movimentacaoId:
                transferenciaId,
              user
            })
          } else {
            await aceitarTransferencia({
              transferenciaId,
              user
            })
          }

          recebidos.push(
            String(
              transferenciaId
            )
          )
        } catch (error) {
          falhas.push({
            item,
            error
          })
        }
      }

      setRegistroAberto(null)

      setSelecionado(
        (atual) => {
          if (!atual) {
            return atual
          }

          const itensRestantes =
            (atual.itens || []).filter(
              (registro) =>
                !recebidos.includes(
                  String(
                    registro?.transferencia_id ||
                    registro?.id ||
                    ''
                  )
                )
            )

          return {
            ...atual,
            total:
              itensRestantes.length,
            itens:
              itensRestantes
          }
        }
      )

      if (
        typeof onAtualizar ===
        'function'
      ) {
        await onAtualizar()
      }

      if (falhas.length > 0) {
        const descricoes =
          falhas
            .slice(0, 5)
            .map(({ item, error }) => {
              const categoria =
                item?.categoria ||
                item?.modulo ||
                'MATERIAL'

              const identificacao =
                item?.patrimonio ||
                item?.numero_serie ||
                item?.metadata?.patrimonio_tpd ||
                item?.metadata?.numero_serie_tpd ||
                item?.metadata?.descricao_arma ||
                item?.metadata?.patrimonio_arma ||
                item?.protocolo ||
                ''

              return `• ${categoria}${identificacao ? ` — ${identificacao}` : ''}: ${error?.message || 'falha no recebimento'}`
            })
            .join('\n')

        window.alert(
          `${recebidos.length} material(is) recebido(s).\n` +
          `${falhas.length} item(ns) não foram recebidos e permaneceram na lista.\n\n` +
          descricoes
        )
      }
    } catch (error) {
      console.error(
        'Erro ao receber materiais em lote no SVDD:',
        error
      )

      window.alert(
        error?.message ||
        'Não foi possível concluir o recebimento em lote.'
      )

      if (
        typeof onAtualizar ===
        'function'
      ) {
        await onAtualizar()
      }
    } finally {
      setRecebendoTodosTPDs(
        false
      )
    }
  }


  async function aprovarTransferenciaTaserNaCentral(
    item,
    { semConfirmacao = false } = {}
  ) {
    const movimentacaoId =
      item?.movimentacao_id ||
      item?.transferencia_id ||
      item?.id

    if (
      !movimentacaoId ||
      decidindoTaserId ||
      aprovandoTodosTasers
    ) {
      return false
    }

    const dados =
      item?.dados ||
      item?.metadata?.dados_engine ||
      {}

    const identificacao =
      item?.patrimonio ||
      item?.numero_serie ||
      dados?.patrimonio ||
      dados?.numero_serie ||
      item?.metadata?.patrimonio?.identificacao ||
      'Taser'

    const destino =
      item?.destino_nome ||
      item?.destino_codigo ||
      dados?.destino_nome ||
      dados?.guardiao_destino?.nome ||
      dados?.guardiao_destino?.codigo ||
      'destino informado'

    if (!semConfirmacao) {
      const confirmou =
        window.confirm(
          `Aprovar a movimentação da Taser ${identificacao}?\n\nDestino: ${destino}`
        )

      if (!confirmou) {
        return false
      }
    }

    try {
      setDecidindoTaserId(
        movimentacaoId
      )

      await decidirTransferenciaTaserCmt({
        movimentacaoId,
        decisao:
          'APROVAR',
        observacoes:
          'APROVADA PELO COMANDANTE DE CIA NA CENTRAL OPERACIONAL.',
        user
      })

      setRegistroAberto(
        null
      )

      setSelecionado(
        (atual) => {
          if (!atual) {
            return atual
          }

          const itensRestantes =
            (atual.itens || []).filter(
              (registro) =>
                String(
                  registro?.movimentacao_id ||
                  registro?.transferencia_id ||
                  registro?.id ||
                  ''
                ) !==
                String(
                  movimentacaoId
                )
            )

          return {
            ...atual,
            total:
              itensRestantes.length,
            itens:
              itensRestantes
          }
        }
      )

      if (
        typeof onAtualizar ===
        'function'
      ) {
        await onAtualizar()
      }

      return true
    } catch (error) {
      console.error(
        'Erro ao aprovar movimentação de Taser:',
        error
      )

      window.alert(
        error?.message ||
        'Não foi possível aprovar a movimentação da Taser.'
      )

      return false
    } finally {
      setDecidindoTaserId(
        null
      )
    }
  }


  async function reprovarTransferenciaTaserNaCentral(
    item
  ) {
    const movimentacaoId =
      item?.movimentacao_id ||
      item?.transferencia_id ||
      item?.id

    if (
      !movimentacaoId ||
      decidindoTaserId ||
      aprovandoTodosTasers
    ) {
      return
    }

    const dados =
      item?.dados ||
      item?.metadata?.dados_engine ||
      {}

    const identificacao =
      item?.patrimonio ||
      item?.numero_serie ||
      dados?.patrimonio ||
      dados?.numero_serie ||
      item?.metadata?.patrimonio?.identificacao ||
      'Taser'

    const motivo =
      window.prompt(
        `Informe o motivo da reprovação da movimentação da Taser ${identificacao}:`
      )

    if (motivo === null) {
      return
    }

    const motivoNormalizado =
      String(
        motivo || ''
      )
        .trim()
        .toUpperCase()

    if (!motivoNormalizado) {
      window.alert(
        'Informe o motivo da reprovação.'
      )
      return
    }

    const confirmou =
      window.confirm(
        `Reprovar a movimentação da Taser ${identificacao}?\n\nO patrimônio permanecerá na origem.`
      )

    if (!confirmou) {
      return
    }

    try {
      setDecidindoTaserId(
        movimentacaoId
      )

      await decidirTransferenciaTaserCmt({
        movimentacaoId,
        decisao:
          'REPROVAR',
        observacoes:
          motivoNormalizado,
        user
      })

      setRegistroAberto(
        null
      )

      setSelecionado(
        (atual) => {
          if (!atual) {
            return atual
          }

          const itensRestantes =
            (atual.itens || []).filter(
              (registro) =>
                String(
                  registro?.movimentacao_id ||
                  registro?.transferencia_id ||
                  registro?.id ||
                  ''
                ) !==
                String(
                  movimentacaoId
                )
            )

          return {
            ...atual,
            total:
              itensRestantes.length,
            itens:
              itensRestantes
          }
        }
      )

      if (
        typeof onAtualizar ===
        'function'
      ) {
        await onAtualizar()
      }
    } catch (error) {
      console.error(
        'Erro ao reprovar movimentação de Taser:',
        error
      )

      window.alert(
        error?.message ||
        'Não foi possível reprovar a movimentação da Taser.'
      )
    } finally {
      setDecidindoTaserId(
        null
      )
    }
  }


  async function aprovarTodosTasersNaCentral() {
    if (
      aprovandoTodosTasers ||
      decidindoTaserId
    ) {
      return
    }

    const itensTaser =
      (selecionado?.itens || [])
        .filter(
          (item) =>
            itemEhTransferenciaTaser(
              item
            )
        )

    if (itensTaser.length === 0) {
      window.alert(
        'Não há movimentações de Taser aguardando aprovação.'
      )
      return
    }

    const confirmou =
      window.confirm(
        `Aprovar todas as ${itensTaser.length} movimentação(ões) de Taser pendente(s)?`
      )

    if (!confirmou) {
      return
    }

    try {
      setAprovandoTodosTasers(
        true
      )

      const aprovados =
        []

      const falhas =
        []

      for (const item of itensTaser) {
        const movimentacaoId =
          item?.movimentacao_id ||
          item?.transferencia_id ||
          item?.id

        if (!movimentacaoId) {
          continue
        }

        try {
          await decidirTransferenciaTaserCmt({
            movimentacaoId,
            decisao:
              'APROVAR',
            observacoes:
              'APROVADA EM LOTE PELO COMANDANTE DE CIA NA CENTRAL OPERACIONAL.',
            user
          })

          aprovados.push(
            String(
              movimentacaoId
            )
          )
        } catch (error) {
          falhas.push({
            item,
            error
          })
        }
      }

      setRegistroAberto(
        null
      )

      setSelecionado(
        (atual) => {
          if (!atual) {
            return atual
          }

          const itensRestantes =
            (atual.itens || []).filter(
              (registro) =>
                !aprovados.includes(
                  String(
                    registro?.movimentacao_id ||
                    registro?.transferencia_id ||
                    registro?.id ||
                    ''
                  )
                )
            )

          return {
            ...atual,
            total:
              itensRestantes.length,
            itens:
              itensRestantes
          }
        }
      )

      if (
        typeof onAtualizar ===
        'function'
      ) {
        await onAtualizar()
      }

      if (falhas.length > 0) {
        window.alert(
          `${aprovados.length} movimentação(ões) aprovada(s).\n${falhas.length} não puderam ser aprovadas e permaneceram na lista.`
        )
      }
    } catch (error) {
      console.error(
        'Erro ao aprovar Tasers em lote:',
        error
      )

      window.alert(
        error?.message ||
        'Não foi possível concluir a aprovação em lote dos Tasers.'
      )
    } finally {
      setAprovandoTodosTasers(
        false
      )
    }
  }


  async function aprovarTransferenciaTPDNaCentral(
    item,
    { semConfirmacao = false } = {}
  ) {
    const transferenciaId =
      item?.transferencia_id ||
      item?.id

    if (
      !transferenciaId ||
      decidindoTPDId ||
      aprovandoTodosTPDs
    ) {
      return false
    }

    const metadata =
      item?.metadata &&
      typeof item.metadata === 'object'
        ? item.metadata
        : {}

    const identificacao =
      item?.patrimonio ||
      item?.numero_serie ||
      metadata?.patrimonio_tpd ||
      metadata?.numero_serie_tpd ||
      metadata?.descricao_tpd ||
      'TPD'

    if (!semConfirmacao) {
      const confirmou =
        window.confirm(
          `Aprovar a transferência do TPD ${identificacao}?\n\n` +
          `${item?.origem_nome || 'COFRE DO P4'} → ${item?.destino_nome || 'COFRE DO SVDD'}\n\n` +
          'Após a aprovação, o TPD ficará liberado para recebimento pelo SVDD.'
        )

      if (!confirmou) {
        return false
      }
    }

    try {
      setDecidindoTPDId(
        transferenciaId
      )

      await aprovarTransferenciaTPDPeloCmt({
        transferenciaId,
        user
      })

      setRegistroAberto(null)

      setSelecionado(
        (atual) => {
          if (!atual) {
            return atual
          }

          return {
            ...atual,
            total: Math.max(
              0,
              Number(atual.total || 0) - 1
            ),
            itens:
              (atual.itens || []).filter(
                (registro) =>
                  String(
                    registro?.transferencia_id ||
                    registro?.id ||
                    ''
                  ) !==
                  String(
                    transferenciaId
                  )
              )
          }
        }
      )

      if (
        typeof onAtualizar ===
        'function'
      ) {
        await onAtualizar()
      }

      return true
    } catch (error) {
      console.error(
        'Erro ao aprovar transferência de TPD:',
        error
      )

      window.alert(
        error?.message ||
        'Não foi possível aprovar a transferência do TPD.'
      )

      return false
    } finally {
      setDecidindoTPDId(
        null
      )
    }
  }


  async function reprovarTransferenciaTPDNaCentral(
    item
  ) {
    const transferenciaId =
      item?.transferencia_id ||
      item?.id

    if (
      !transferenciaId ||
      decidindoTPDId ||
      aprovandoTodosTPDs
    ) {
      return
    }

    const metadata =
      item?.metadata &&
      typeof item.metadata === 'object'
        ? item.metadata
        : {}

    const identificacao =
      item?.patrimonio ||
      item?.numero_serie ||
      metadata?.patrimonio_tpd ||
      metadata?.numero_serie_tpd ||
      metadata?.descricao_tpd ||
      'TPD'

    const motivo =
      window.prompt(
        `Informe o motivo da reprovação da transferência do TPD ${identificacao}:`
      )

    if (motivo === null) {
      return
    }

    const motivoNormalizado =
      String(
        motivo || ''
      )
        .trim()
        .toUpperCase()

    if (!motivoNormalizado) {
      window.alert(
        'Informe o motivo da reprovação.'
      )
      return
    }

    const confirmou =
      window.confirm(
        `Reprovar a transferência do TPD ${identificacao}?\n\n` +
        'O TPD permanecerá no COFRE DO P4.'
      )

    if (!confirmou) {
      return
    }

    try {
      setDecidindoTPDId(
        transferenciaId
      )

      await recusarTransferencia({
        transferenciaId,
        motivoRecusa:
          `REPROVADA PELO CMT DE CIA: ${motivoNormalizado}`,
        user
      })

      setRegistroAberto(null)

      setSelecionado(
        (atual) => {
          if (!atual) {
            return atual
          }

          const itensRestantes =
            (atual.itens || []).filter(
              (registro) =>
                String(
                  registro?.transferencia_id ||
                  registro?.id ||
                  ''
                ) !==
                String(
                  transferenciaId
                )
            )

          return {
            ...atual,
            total:
              itensRestantes.length,
            itens:
              itensRestantes
          }
        }
      )

      if (
        typeof onAtualizar ===
        'function'
      ) {
        await onAtualizar()
      }
    } catch (error) {
      console.error(
        'Erro ao reprovar transferência de TPD:',
        error
      )

      window.alert(
        error?.message ||
        'Não foi possível reprovar a transferência do TPD.'
      )
    } finally {
      setDecidindoTPDId(
        null
      )
    }
  }


  async function aprovarTodosTPDsNaCentral() {
    if (
      aprovandoTodosTPDs ||
      decidindoTPDId
    ) {
      return
    }

    const itensTPD =
      (selecionado?.itens || [])
        .filter(
          (item) =>
            itemEhTransferenciaTPD(
              item
            )
        )

    if (itensTPD.length === 0) {
      window.alert(
        'Não há transferências de TPD aguardando aprovação.'
      )
      return
    }

    const confirmou =
      window.confirm(
        `Aprovar todas as ${itensTPD.length} transferência(ões) de TPD?\n\n` +
        'Após a aprovação, os TPDs ficarão liberados para recebimento pelo SVDD.'
      )

    if (!confirmou) {
      return
    }

    try {
      setAprovandoTodosTPDs(
        true
      )

      const aprovados = []

      for (const item of itensTPD) {
        const transferenciaId =
          item?.transferencia_id ||
          item?.id

        if (!transferenciaId) {
          continue
        }

        await aprovarTransferenciaTPDPeloCmt({
          transferenciaId,
          user
        })

        aprovados.push(
          String(
            transferenciaId
          )
        )
      }

      setRegistroAberto(null)

      setSelecionado(
        (atual) => {
          if (!atual) {
            return atual
          }

          const itensRestantes =
            (atual.itens || []).filter(
              (registro) =>
                !aprovados.includes(
                  String(
                    registro?.transferencia_id ||
                    registro?.id ||
                    ''
                  )
                )
            )

          return {
            ...atual,
            total:
              itensRestantes.length,
            itens:
              itensRestantes
          }
        }
      )

      if (
        typeof onAtualizar ===
        'function'
      ) {
        await onAtualizar()
      }
    } catch (error) {
      console.error(
        'Erro ao aprovar todas as transferências de TPD:',
        error
      )

      window.alert(
        error?.message ||
        'Não foi possível concluir a aprovação em lote dos TPDs.'
      )

      if (
        typeof onAtualizar ===
        'function'
      ) {
        await onAtualizar()
      }
    } finally {
      setAprovandoTodosTPDs(
        false
      )
    }
  }


  async function aprovarTransferenciaTorniqueteNaCentral(
    item
  ) {
    const transferenciaId =
      item?.transferencia_id ||
      item?.id

    if (
      !transferenciaId ||
      decidindoTorniqueteId
    ) {
      return
    }

    const quantidade =
      Number(
        item?.quantidade_total ||
        item?.quantidade ||
        0
      ) || 0

    const confirmou =
      window.confirm(
        `Aprovar a transferência de ${quantidade} torniquete(s)?\n\n${
          item?.origem_nome ||
          item?.origem_tipo ||
          'ORIGEM'
        } → ${
          item?.destino_nome ||
          item?.destino_tipo ||
          'DESTINO'
        }`
      )

    if (!confirmou) {
      return
    }

    const token =
      loadSessionToken()

    if (!token) {
      window.alert(
        'Sessão SIGMO inválida ou expirada.'
      )
      return
    }

    try {
      setDecidindoTorniqueteId(
        transferenciaId
      )

      const { error } =
        await supabase.rpc(
          'sigmo_torniquetes_aprovar_transferencia',
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

      setRegistroAberto(null)

      setSelecionado(
        (atual) => {
          if (!atual) {
            return atual
          }

          return {
            ...atual,

            itens:
              (atual.itens || []).filter(
                (registro) =>
                  String(
                    registro?.transferencia_id ||
                    registro?.id ||
                    ''
                  ) !==
                  String(
                    transferenciaId
                  )
              )
          }
        }
      )

      if (
        typeof onAtualizar ===
        'function'
      ) {
        await onAtualizar()
      }
    } catch (error) {
      console.error(
        'Erro ao aprovar transferência de torniquete:',
        error
      )

      window.alert(
        error?.message ||
        'Não foi possível aprovar a transferência de torniquete.'
      )
    } finally {
      setDecidindoTorniqueteId(
        null
      )
    }
  }


  async function reprovarTransferenciaTorniqueteNaCentral(
    item
  ) {
    const transferenciaId =
      item?.transferencia_id ||
      item?.id

    if (
      !transferenciaId ||
      decidindoTorniqueteId
    ) {
      return
    }

    const motivo =
      window.prompt(
        'Informe o motivo da reprovação da transferência de torniquete:'
      )

    if (motivo === null) {
      return
    }

    const motivoNormalizado =
      String(motivo || '')
        .trim()
        .toUpperCase()

    if (!motivoNormalizado) {
      window.alert(
        'Informe o motivo da reprovação.'
      )
      return
    }

    const confirmou =
      window.confirm(
        'Reprovar esta transferência de torniquete? O saldo permanecerá no setor de origem.'
      )

    if (!confirmou) {
      return
    }

    const token =
      loadSessionToken()

    if (!token) {
      window.alert(
        'Sessão SIGMO inválida ou expirada.'
      )
      return
    }

    try {
      setDecidindoTorniqueteId(
        transferenciaId
      )

      const { error } =
        await supabase.rpc(
          'sigmo_torniquetes_recusar_transferencia',
          {
            p_token:
              token,

            p_transferencia_id:
              transferenciaId,

            p_motivo:
              motivoNormalizado
          }
        )

      if (error) {
        throw error
      }

      setRegistroAberto(null)

      setSelecionado(
        (atual) => {
          if (!atual) {
            return atual
          }

          return {
            ...atual,

            itens:
              (atual.itens || []).filter(
                (registro) =>
                  String(
                    registro?.transferencia_id ||
                    registro?.id ||
                    ''
                  ) !==
                  String(
                    transferenciaId
                  )
              )
          }
        }
      )

      if (
        typeof onAtualizar ===
        'function'
      ) {
        await onAtualizar()
      }
    } catch (error) {
      console.error(
        'Erro ao reprovar transferência de torniquete:',
        error
      )

      window.alert(
        error?.message ||
        'Não foi possível reprovar a transferência de torniquete.'
      )
    } finally {
      setDecidindoTorniqueteId(
        null
      )
    }
  }


  async function aprovarManutencaoMunicaoNaCentral(
    item
  ) {
    const movimentacaoId =
      item?.movimentacao_id ||
      item?.id

    if (
      !movimentacaoId ||
      decidindoMunicaoId
    ) {
      return
    }

    const quantidade =
      Number(
        item?.quantidade_total ||
        item?.quantidade ||
        item?.dados?.quantidade ||
        0
      ) || 0

    const calibre =
      texto(
        item?.calibre ||
        item?.dados?.calibre ||
        ''
      )

    const confirmou =
      window.confirm(
        `Aprovar o encaminhamento de ${quantidade} munição(ões)${calibre ? ` ${calibre}` : ''} em manutenção do SVDD para o P4?\n\nApós esta aprovação, o P4 poderá confirmar o recebimento.`
      )

    if (!confirmou) {
      return
    }

    try {
      setDecidindoMunicaoId(
        movimentacaoId
      )

      const agora =
        new Date().toISOString()

      const dadosAtuais =
        item?.dados &&
        typeof item.dados === 'object'
          ? item.dados
          : {}

      const aprovadoPorNome =
        user?.nome_guerra ||
        user?.nome ||
        user?.nome_completo ||
        user?.email ||
        'COMANDANTE DE CIA'

      const {
        data,
        error
      } = await supabase
        .from(
          'sigmo_patrimonio_movimentacoes'
        )
        .update({
          aprovado_por:
            user?.id ||
            null,

          aprovado_por_nome:
            aprovadoPorNome,

          aprovado_em:
            agora,

          dados: {
            ...dadosAtuais,
            cmt_aprovado:
              true,
            cmt_aprovado_em:
              agora,
            cmt_aprovado_por_id:
              user?.id ||
              null,
            cmt_aprovado_por_nome:
              aprovadoPorNome,
            etapa_fluxo:
              'AGUARDANDO_RECEBIMENTO_P4'
          },

          atualizado_em:
            agora,

          updated_at:
            agora
        })
        .eq(
          'id',
          movimentacaoId
        )
        .eq(
          'status_movimentacao',
          'PENDENTE'
        )
        .select(
          'id, status_movimentacao, aprovado_em'
        )
        .maybeSingle()

      if (error) {
        throw error
      }

      if (!data?.id) {
        throw new Error(
          'Esta solicitação não está mais aguardando aprovação. Atualize a Central e confira a situação atual.'
        )
      }

      setRegistroAberto(
        null
      )

      setSelecionado(
        (atual) => {
          if (!atual) {
            return atual
          }

          return {
            ...atual,

            itens:
              (atual.itens || []).filter(
                (registro) =>
                  String(
                    registro?.movimentacao_id ||
                    registro?.id ||
                    ''
                  ) !==
                  String(
                    movimentacaoId
                  )
              )
          }
        }
      )

      if (
        typeof onAtualizar ===
        'function'
      ) {
        await onAtualizar()
      }
    } catch (error) {
      console.error(
        'Erro ao aprovar encaminhamento de manutenção de munição:',
        error
      )

      window.alert(
        error?.message ||
        'Não foi possível aprovar o encaminhamento de manutenção de munição.'
      )
    } finally {
      setDecidindoMunicaoId(
        null
      )
    }
  }


  async function reprovarManutencaoMunicaoNaCentral(
    item
  ) {
    const movimentacaoId =
      item?.movimentacao_id ||
      item?.id

    if (
      !movimentacaoId ||
      decidindoMunicaoId
    ) {
      return
    }

    const motivo =
      window.prompt(
        'Informe o motivo da reprovação do encaminhamento ao P4:'
      )

    if (motivo === null) {
      return
    }

    const motivoNormalizado =
      String(motivo || '')
        .trim()
        .toUpperCase()

    if (!motivoNormalizado) {
      window.alert(
        'Informe o motivo da reprovação.'
      )
      return
    }

    const confirmou =
      window.confirm(
        'Reprovar este encaminhamento de manutenção de munição?\n\nA munição permanecerá em manutenção sob responsabilidade do SVDD.'
      )

    if (!confirmou) {
      return
    }

    try {
      setDecidindoMunicaoId(
        movimentacaoId
      )

      await recusarTransferenciaManutencaoMunicao({
        movimentacaoId,
        motivo:
          `REPROVADA PELO CMT DE CIA: ${motivoNormalizado}`,
        user
      })

      setRegistroAberto(
        null
      )

      setSelecionado(
        (atual) => {
          if (!atual) {
            return atual
          }

          return {
            ...atual,

            itens:
              (atual.itens || []).filter(
                (registro) =>
                  String(
                    registro?.movimentacao_id ||
                    registro?.id ||
                    ''
                  ) !==
                  String(
                    movimentacaoId
                  )
              )
          }
        }
      )

      if (
        typeof onAtualizar ===
        'function'
      ) {
        await onAtualizar()
      }
    } catch (error) {
      console.error(
        'Erro ao reprovar encaminhamento de manutenção de munição:',
        error
      )

      window.alert(
        error?.message ||
        'Não foi possível reprovar o encaminhamento de manutenção de munição.'
      )
    } finally {
      setDecidindoMunicaoId(
        null
      )
    }
  }


  async function aprovarDescargaMunicaoNaCentral(
    item
  ) {
    const movimentacaoId =
      item?.movimentacao_id ||
      item?.id

    if (
      !movimentacaoId ||
      decidindoMunicaoId
    ) {
      return
    }

    const quantidade =
      Number(
        item?.quantidade_total ||
        item?.quantidade ||
        item?.dados?.quantidade ||
        0
      ) || 0

    const calibre =
      texto(
        item?.calibre ||
        item?.dados?.calibre ||
        ''
      )

    const confirmou =
      window.confirm(
        `Aprovar a descarga definitiva de ${quantidade} munição(ões)${calibre ? ` ${calibre}` : ''}?\n\nApós a aprovação, a quantidade será retirada da manutenção do P4 e registrada como descarga.`
      )

    if (!confirmou) {
      return
    }

    try {
      setDecidindoMunicaoId(
        movimentacaoId
      )

      await aprovarDescargaManutencaoMunicaoCmt({
        movimentacaoId,
        user
      })

      setRegistroAberto(
        null
      )

      setSelecionado(
        (atual) => {
          if (!atual) {
            return atual
          }

          return {
            ...atual,
            itens:
              (atual.itens || []).filter(
                (registro) =>
                  String(
                    registro?.movimentacao_id ||
                    registro?.id ||
                    ''
                  ) !==
                  String(
                    movimentacaoId
                  )
              )
          }
        }
      )

      if (
        typeof onAtualizar ===
        'function'
      ) {
        await onAtualizar()
      }
    } catch (error) {
      console.error(
        'Erro ao aprovar descarga de munição:',
        error
      )

      window.alert(
        error?.message ||
        'Não foi possível aprovar a descarga de munição.'
      )
    } finally {
      setDecidindoMunicaoId(
        null
      )
    }
  }


  async function reprovarDescargaMunicaoNaCentral(
    item
  ) {
    const movimentacaoId =
      item?.movimentacao_id ||
      item?.id

    if (
      !movimentacaoId ||
      decidindoMunicaoId
    ) {
      return
    }

    const motivo =
      window.prompt(
        'Informe o motivo da reprovação da descarga de munição:'
      )

    if (motivo === null) {
      return
    }

    const motivoNormalizado =
      String(
        motivo || ''
      )
        .trim()
        .toUpperCase()

    if (!motivoNormalizado) {
      window.alert(
        'Informe o motivo da reprovação.'
      )
      return
    }

    const confirmou =
      window.confirm(
        'Reprovar esta solicitação de descarga?\n\nA munição continuará em manutenção sob responsabilidade do P4.'
      )

    if (!confirmou) {
      return
    }

    try {
      setDecidindoMunicaoId(
        movimentacaoId
      )

      await recusarDescargaManutencaoMunicaoCmt({
        movimentacaoId,
        motivo:
          `REPROVADA PELO CMT DE CIA: ${motivoNormalizado}`,
        user
      })

      setRegistroAberto(
        null
      )

      setSelecionado(
        (atual) => {
          if (!atual) {
            return atual
          }

          return {
            ...atual,
            itens:
              (atual.itens || []).filter(
                (registro) =>
                  String(
                    registro?.movimentacao_id ||
                    registro?.id ||
                    ''
                  ) !==
                  String(
                    movimentacaoId
                  )
              )
          }
        }
      )

      if (
        typeof onAtualizar ===
        'function'
      ) {
        await onAtualizar()
      }
    } catch (error) {
      console.error(
        'Erro ao reprovar descarga de munição:',
        error
      )

      window.alert(
        error?.message ||
        'Não foi possível reprovar a descarga de munição.'
      )
    } finally {
      setDecidindoMunicaoId(
        null
      )
    }
  }


  async function decidirExterna(item, decisao) {
    if (!item?.id || decidindoManutencaoExternaId) return

    const aprovando = decisao === 'APROVAR'
    const mensagem = aprovando
      ? 'Aprovar o envio deste material para manutenção externa?'
      : 'Reprovar esta solicitação de manutenção externa?'

    if (!window.confirm(mensagem)) return

    let observacoes = null

    if (!aprovando) {
      observacoes = window.prompt('Informe o motivo da reprovação:') || ''
      if (!observacoes.trim()) return
    }

    try {
      setDecidindoManutencaoExternaId(item.id)

      await decidirManutencaoExterna({
        manutencaoExternaId: item.id,
        decisao,
        observacoes
      })

      setSelecionado(null)
      setRegistroAberto(null)

      if (typeof onAtualizar === 'function') {
        await onAtualizar()
      }
    } catch (error) {
      window.alert(
        error?.message ||
        'Não foi possível registrar a decisão da manutenção externa.'
      )
    } finally {
      setDecidindoManutencaoExternaId(null)
    }
  }

  async function decidirDescargaNaCentral(
    item,
    decisao
  ) {
    if (
      !item?.id ||
      decidindoDescargaId
    ) {
      return
    }

    const aprovando =
      decisao ===
      'APROVAR'

    if (aprovando) {
      const confirmou =
        window.confirm(
          `Aprovar a descarga definitiva do colete ${
            item?.patrimonio ||
            item?.numero_serie ||
            ''
          }?\n\nApós a aprovação, o colete será baixado e retirado do estoque ativo.`
        )

      if (!confirmou) {
        return
      }
    }

    let observacoes = ''

    if (!aprovando) {
      const resposta =
        window.prompt(
          'Informe o motivo da reprovação da descarga:'
        )

      if (resposta === null) {
        return
      }

      observacoes =
        String(
          resposta || ''
        )
          .trim()
          .toUpperCase()

      if (!observacoes) {
        window.alert(
          'Informe o motivo da reprovação.'
        )
        return
      }
    }

    try {
      setDecidindoDescargaId(
        item.id
      )

      await decidirDescargaColete({
        solicitacao:
          item,
        decisao,
        observacoes,
        user
      })

      setSelecionado(
        null
      )

      setRegistroAberto(
        null
      )

      if (
        typeof onAtualizar ===
        'function'
      ) {
        await onAtualizar()
      }
    } catch (error) {
      console.error(
        'Erro ao decidir descarga de colete:',
        error
      )

      window.alert(
        error?.message ||
        'Não foi possível registrar a decisão da descarga.'
      )
    } finally {
      setDecidindoDescargaId(
        null
      )
    }
  }

  const [selecionado, setSelecionado] = useState(null)
  const [registroAberto, setRegistroAberto] = useState(null)
  const [recebendoId, setRecebendoId] = useState(null)
  const [recusandoId, setRecusandoId] = useState(null)
  const [cancelandoId, setCancelandoId] = useState(null)

  const [
    decidindoDescargaId,
    setDecidindoDescargaId
  ] = useState(null)

  const [
    cancelandoDescargaId,
    setCancelandoDescargaId
  ] = useState(null)

  const [
    municoesVinculadas,
    setMunicoesVinculadas
  ] = useState({})

  const [
    carregandoMunicoesVinculadas,
    setCarregandoMunicoesVinculadas
  ] = useState(false)

  const [fotoAmpliada, setFotoAmpliada] = useState(null)
  const secoes = useMemo(
    () => [...(dados?.alertas ?? []), ...(dados?.indicadores ?? [])],
    [dados]
  )

  useEffect(() => {
    let ativo = true

    async function carregarMunicoesVinculadas() {
      if (
        selecionado?.key !==
        'recebimentos'
      ) {
        if (ativo) {
          setMunicoesVinculadas({})
        }
        return
      }

      const ids =
        (selecionado?.itens || [])
          .map((item) =>
            item?.id
          )
          .filter(Boolean)

      if (ids.length === 0) {
        if (ativo) {
          setMunicoesVinculadas({})
        }
        return
      }

      try {
        setCarregandoMunicoesVinculadas(
          true
        )

        const lista =
          await listarMunicoesVinculadasAosCarrinhos(
            ids
          )

        if (!ativo) {
          return
        }

        const agrupadas = {}

        for (const transferencia of lista) {
          const movimentacaoId =
            String(
              transferencia
                ?.movimentacao_principal_id ||
              ''
            )

          if (!movimentacaoId) {
            continue
          }

          if (!agrupadas[movimentacaoId]) {
            agrupadas[movimentacaoId] = []
          }

          agrupadas[movimentacaoId].push(
            transferencia
          )
        }

        setMunicoesVinculadas(
          agrupadas
        )
      } catch (error) {
        console.error(
          'Erro ao carregar munições vinculadas aos carrinhos:',
          error
        )

        if (ativo) {
          setMunicoesVinculadas({})
        }
      } finally {
        if (ativo) {
          setCarregandoMunicoesVinculadas(
            false
          )
        }
      }
    }

    carregarMunicoesVinculadas()

    return () => {
      ativo = false
    }
  }, [selecionado])

  function itemComMunicoesVinculadas(item) {
    if (!item?.id) {
      return item
    }

    const municoes =
      municoesVinculadas[
        String(item.id)
      ] || []

    if (municoes.length === 0) {
      return item
    }

    const itensMunicao =
      municoes.map(
        (transferencia) => ({
          id:
            `MUNICAO-${transferencia.transferencia_id}`,

          tipo_patrimonio:
            'MUNIÇÃO',

          descricao:
            `MUNIÇÃO ${transferencia.calibre || ''}`
              .trim(),

          quantidade:
            Number(
              transferencia
                ?.quantidade_total ||
              0
            ),

          status:
            transferencia?.status ||
            'PENDENTE',

          transferencia_municao_id:
            transferencia
              ?.transferencia_id,

          movimentacao_principal_id:
            transferencia
              ?.movimentacao_principal_id,

          eh_municao_quantitativa:
            true
        })
      )

    return {
      ...item,

      itens: [
        ...(Array.isArray(item?.itens)
          ? item.itens
          : []),
        ...itensMunicao
      ]
    }
  }

  const indicadoresExibidos = useMemo(() => {
    const indicadores = dados?.indicadores ?? []
    const perfil = normalizarOperacional(dados?.perfil || user?.perfil)

    if (perfil !== 'P4') return indicadores

    const resultado = []

    for (const card of indicadores) {
      if (card?.key !== 'novidades') {
        resultado.push(card)
        continue
      }

      const itens = Array.isArray(card?.itens) ? card.itens : []

      const pertenceAoSvdd = (item) => {
        const carga = normalizarOperacional(
          item?.carga_atual ||
          item?.responsabilidade_atual ||
          item?.responsavel_setor ||
          item?.setor_responsavel ||
          item?.local_atual ||
          item?.origem ||
          item?.origem_local ||
          item?.destino ||
          item?.destino_local
        )

        return (
          carga.includes('SVDD') ||
          carga.includes('SERVICO DE DIA') ||
          carga.includes('COFRE DO SVDD')
        )
      }

      const itensSvdd = itens.filter(pertenceAoSvdd)
      const itensP4 = itens.filter((item) => !pertenceAoSvdd(item))

      resultado.push(
        {
          ...card,
          key: 'novidades-p4',
          titulo: 'Novidades patrimoniais P4',
          total: itensP4.length,
          itens: itensP4
        },
        {
          ...card,
          key: 'novidades-svdd',
          titulo: 'Novidades patrimoniais SVDD',
          total: itensSvdd.length,
          itens: itensSvdd
        }
      )
    }

    return resultado
  }, [dados, user])

  function ehCancelavelDescargaColete(
    item,
    secao
  ) {
    if (
      !ehP4(user) ||
      !ehNovidade(secao)
    ) {
      return false
    }

    const tipo =
      normalizarOperacional(
        item?.tipo_patrimonio ||
        item?.especie ||
        item?.especie_patrimonio ||
        ''
      )

    const status =
      normalizarOperacional(
        item?.status ||
        ''
      )

    return (
      tipo.includes(
        'COLETE BALISTICO'
      ) &&
      Boolean(
        item?.descarga_pendente
      ) &&
      Boolean(
        item?.descarga_solicitacao_id
      ) &&
      (
        status.includes(
          'AGUARDANDO APROVACAO'
        ) ||
        Boolean(
          item?.descarga_pendente
        )
      )
    )
  }

  async function cancelarSolicitacaoDescargaColete(
    item
  ) {
    const solicitacaoId =
      item?.descarga_solicitacao_id

    if (
      !solicitacaoId ||
      !ehP4(user) ||
      cancelandoDescargaId
    ) {
      return
    }

    const motivo =
      window.prompt(
        'Informe o motivo do cancelamento da solicitação de descarga:'
      )

    if (motivo === null) {
      return
    }

    const motivoNormalizado =
      String(
        motivo || ''
      )
        .trim()
        .toUpperCase()

    if (!motivoNormalizado) {
      window.alert(
        'Informe o motivo do cancelamento.'
      )
      return
    }

    const confirmou =
      window.confirm(
        'Cancelar esta solicitação de descarga?\n\n' +
        'A solicitação permanecerá registrada no histórico como CANCELADA e o colete não será baixado.'
      )

    if (!confirmou) {
      return
    }

    const agora =
      new Date()
        .toISOString()

    const canceladoPor =
      user?.nome_guerra ||
      user?.nome ||
      user?.nome_completo ||
      user?.email ||
      'P4'

    try {
      setCancelandoDescargaId(
        solicitacaoId
      )

      const {
        data,
        error
      } = await supabase
        .from(
          'sigmo_patrimonio_baixas'
        )
        .update({
          status:
            'CANCELADA',

          decisao_observacoes:
            `SOLICITAÇÃO DE DESCARGA CANCELADA PELO P4. MOTIVO: ${motivoNormalizado}`,

          decidida_em:
            agora,

          decidida_por_nome:
            canceladoPor,

          updated_at:
            agora
        })
        .eq(
          'id',
          solicitacaoId
        )
        .eq(
          'status',
          'AGUARDANDO_APROVACAO'
        )
        .select(
          'id, status'
        )
        .maybeSingle()

      if (error) {
        throw error
      }

      if (!data?.id) {
        throw new Error(
          'A solicitação não está mais aguardando aprovação. Atualize a Central e confira a situação atual.'
        )
      }

      setRegistroAberto(
        null
      )

      setSelecionado(
        null
      )

      if (
        typeof onAtualizar ===
        'function'
      ) {
        await onAtualizar()
      }
    } catch (error) {
      console.error(
        'Erro ao cancelar solicitação de descarga de colete:',
        error
      )

      window.alert(
        error?.message ||
        'Não foi possível cancelar a solicitação de descarga.'
      )
    } finally {
      setCancelandoDescargaId(
        null
      )
    }
  }

  async function cancelarAguardandoRecebimento(item) {
    if (!item?.id || cancelandoId || recebendoId) return

    const confirmou = window.confirm(
      'Cancelar esta movimentação antes do recebimento pelo usuário?\n\n' +
      'A movimentação permanecerá registrada no histórico como cancelada.'
    )

    if (!confirmou) return

    try {
      setCancelandoId(item.id)

      /*
       * A munição quantitativa usa uma transferência própria, mas
       * permanece vinculada ao mesmo carrinho pelo
       * movimentacao_principal_id. Cancelamos primeiro a reserva de
       * munição para impedir saldo "fantasma" no SVDD.
       */
      await cancelarMunicoesVinculadasAoCarrinho(
        item.id
      )

      await cancelarMovimentacao({
        movimentacao_id: item.id,
        usuario: user,
        observacao:
          'MOVIMENTAÇÃO CANCELADA PELO SETOR RESPONSÁVEL ANTES DO RECEBIMENTO PELO USUÁRIO.'
      })

      setSelecionado(null)
      setRegistroAberto(null)

      if (typeof onAtualizar === 'function') {
        await onAtualizar()
      }
    } catch (error) {
      console.error(
        'Erro ao cancelar movimentação aguardando recebimento:',
        error
      )

      window.alert(
        error?.message ||
        'Não foi possível cancelar a movimentação.'
      )
    } finally {
      setCancelandoId(null)
    }
  }

  async function receberTransferenciaTorniqueteNaCentral(
    item
  ) {
    const transferenciaId =
      item?.transferencia_id ||
      item?.id

    if (
      !transferenciaId ||
      recebendoId
    ) {
      return
    }

    const quantidade =
      Number(
        item?.quantidade_total ||
        item?.quantidade ||
        0
      ) || 0

    const origem =
      item?.origem_nome ||
      item?.origem_codigo ||
      item?.origem_tipo ||
      'ORIGEM'

    const destino =
      item?.destino_nome ||
      item?.destino_codigo ||
      item?.destino_tipo ||
      'DESTINO'

    const confirmou =
      window.confirm(
        `Confirmar o recebimento de ${quantidade} torniquete(s)?\n\n${origem} → ${destino}\n\nApós a confirmação, o saldo será efetivado no setor de destino.`
      )

    if (!confirmou) {
      return
    }

    const token =
      loadSessionToken()

    if (!token) {
      window.alert(
        'Sessão SIGMO inválida ou expirada.'
      )
      return
    }

    try {
      setRecebendoId(
        transferenciaId
      )

      const { error } =
        await supabase.rpc(
          'sigmo_torniquetes_receber_transferencia',
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

      setRegistroAberto(null)

      setSelecionado(
        (atual) => {
          if (!atual) {
            return atual
          }

          return {
            ...atual,
            itens:
              (atual.itens || []).filter(
                (registro) =>
                  String(
                    registro?.transferencia_id ||
                    registro?.id ||
                    ''
                  ) !==
                  String(
                    transferenciaId
                  )
              )
          }
        }
      )

      if (
        typeof onAtualizar ===
        'function'
      ) {
        await onAtualizar()
      }

      window.alert(
        `Recebimento confirmado: ${quantidade} torniquete(s).`
      )
    } catch (error) {
      console.error(
        'Erro ao receber transferência de torniquete:',
        error
      )

      window.alert(
        error?.message ||
        'Não foi possível confirmar o recebimento do torniquete.'
      )
    } finally {
      setRecebendoId(
        null
      )
    }
  }


  async function receberTransferenciaHTNoP4(item) {
    if (!item?.id || recebendoId || recusandoId) return

    const confirmou = window.confirm(
      'Confirmar o recebimento deste HT no P4?'
    )

    if (!confirmou) return

    try {
      setRecebendoId(item.id)

      await aceitarTransferenciaHT({
        movimentacaoId: item.id,
        user
      })

      setSelecionado(null)
      setRegistroAberto(null)

      if (typeof onAtualizar === 'function') {
        await onAtualizar()
      }
    } catch (error) {
      console.error(
        'Erro ao receber transferência de HT no P4:',
        error
      )

      window.alert(
        error?.message ||
        'Não foi possível receber a transferência do HT no P4.'
      )
    } finally {
      setRecebendoId(null)
    }
  }

  async function recusarTransferenciaHTNoP4(item) {
    if (!item?.id || recebendoId || recusandoId) return

    const motivo = window.prompt(
      'Informe o motivo da recusa da transferência:'
    )

    if (motivo === null) return
    if (!motivo.trim()) {
      window.alert('Informe o motivo da recusa.')
      return
    }

    const confirmou = window.confirm(
      'Confirmar a recusa desta transferência de HT? O material permanecerá sob responsabilidade do SVDD.'
    )

    if (!confirmou) return

    try {
      setRecusandoId(item.id)

      await recusarTransferenciaHT({
        movimentacaoId: item.id,
        motivo: motivo.trim().toUpperCase(),
        user
      })

      setSelecionado(null)
      setRegistroAberto(null)

      if (typeof onAtualizar === 'function') {
        await onAtualizar()
      }
    } catch (error) {
      console.error(
        'Erro ao recusar transferência de HT no P4:',
        error
      )

      window.alert(
        error?.message ||
        'Não foi possível recusar a transferência do HT.'
      )
    } finally {
      setRecusandoId(null)
    }
  }


  async function receberTransferenciaManutencaoMunicaoNoP4(item) {
    if (!item?.id || recebendoId || recusandoId) return

    const dados =
      item?.dados ||
      item?.metadata?.dados_engine ||
      {}

    const quantidade =
      Number(
        item?.quantidade ||
        dados?.quantidade ||
        0
      ) || 0

    const calibre =
      texto(
        item?.calibre ||
        dados?.calibre ||
        ''
      )

    const confirmou = window.confirm(
      `Confirmar o recebimento de ${quantidade || ''} munição(ões)${calibre ? ` ${calibre}` : ''} em manutenção no P4?`
    )

    if (!confirmou) return

    try {
      setRecebendoId(item.id)

      await aceitarTransferenciaManutencaoMunicao({
        movimentacaoId:
          item.id,
        user
      })

      setSelecionado(null)
      setRegistroAberto(null)

      if (typeof onAtualizar === 'function') {
        await onAtualizar()
      }
    } catch (error) {
      console.error(
        'Erro ao receber transferência de manutenção de munição no P4:',
        error
      )

      window.alert(
        error?.message ||
        'Não foi possível receber a manutenção de munição no P4.'
      )
    } finally {
      setRecebendoId(null)
    }
  }

  async function recusarTransferenciaManutencaoMunicaoNoP4(item) {
    if (!item?.id || recebendoId || recusandoId) return

    const motivo = window.prompt(
      'Informe o motivo da recusa da manutenção de munição:'
    )

    if (motivo === null) return

    if (!motivo.trim()) {
      window.alert(
        'Informe o motivo da recusa.'
      )
      return
    }

    const confirmou = window.confirm(
      'Confirmar a recusa desta transferência? A munição permanecerá em manutenção sob responsabilidade do SVDD.'
    )

    if (!confirmou) return

    try {
      setRecusandoId(item.id)

      await recusarTransferenciaManutencaoMunicao({
        movimentacaoId:
          item.id,
        motivo:
          motivo.trim().toUpperCase(),
        user
      })

      setSelecionado(null)
      setRegistroAberto(null)

      if (typeof onAtualizar === 'function') {
        await onAtualizar()
      }
    } catch (error) {
      console.error(
        'Erro ao recusar transferência de manutenção de munição:',
        error
      )

      window.alert(
        error?.message ||
        'Não foi possível recusar a transferência de manutenção de munição.'
      )
    } finally {
      setRecusandoId(null)
    }
  }

  async function receberNoP4(item) {
    if (!item?.id || recebendoId) return

    const confirmou = window.confirm(
      'Confirmar o recebimento desta devolução no P4?'
    )

    if (!confirmou) return

    try {
      setRecebendoId(item.id)

      await confirmarRecebimentoMovimentacao({
        movimentacao_id: item.id,
        recebedor: user,
        observacao:
          'Recebimento confirmado pelo P4 na Central Operacional.'
      })

      const origem = normalizarOperacional(
        item?.origem_local
      )

      if (origem === 'CARGA PERMANENTE') {
        await finalizarDevolucaoCargaP4({
          itens: item?.itens || []
        })
      }

      setSelecionado(null)
      setRegistroAberto(null)

      if (typeof onAtualizar === 'function') {
        await onAtualizar()
      }
    } catch (error) {
      console.error(
        'Erro ao confirmar recebimento no P4:',
        error
      )

      window.alert(
        error?.message ||
        'Não foi possível confirmar o recebimento no P4.'
      )
    } finally {
      setRecebendoId(null)
    }
  }

  if (carregando && !dados) {
    return <section className="central-operacional-loading">Carregando situação operacional...</section>
  }

  return (
    <>
      <section className="central-prioridades">
        <header className="central-section-header">
          <div>
            <span className="central-section-eyebrow">Situação operacional</span>
            <h2>Pendências e ações</h2>
            <p>Visão consolidada das ocorrências que exigem acompanhamento.</p>
          </div>
          {dados?.perfil && <span className="central-perfil-chip">{dados.perfil}</span>}
        </header>

        <div className="central-operacional-grid central-operacional-grid-principal">
          {(dados?.alertas ?? []).map((card) => (
            <button
              type="button"
              key={card.key}
              className={`central-operacional-card central-operacional-card-${card.tom || 'neutro'}`}
              onClick={() => { setSelecionado(card); setRegistroAberto(null) }}
            >
              <div className="central-card-topo">
                <span>{card.titulo}</span>
                {card.total > 0 && <b className="central-card-alerta">Pendente</b>}
              </div>
              <strong>{card.total}</strong>
              <small>{card.total > 0 ? 'Abrir pendências' : 'Nenhuma pendência'}</small>
            </button>
          ))}
        </div>

        <div className="central-operacional-grid central-operacional-grid-secundario">
          {perfilVtr && (
            <button
              type="button"
              className="central-operacional-card central-operacional-card-secundario"
              onClick={() => {
                setSelecionado(null)
                if (novidadesVtrExibidas.length === 1) {
                  abrirNovidadeVtr(novidadesVtrExibidas[0])
                } else {
                  setSelecionado({
                    key: 'novidades-vtr',
                    titulo: 'Novidades de VTR',
                    total: novidadesVtrExibidas.length,
                    itens: novidadesVtrExibidas
                  })
                }
              }}
            >
              <div className="central-card-topo">
                <span>Novidades de VTR</span>
              </div>
              <strong>{carregandoNovidadesVtr ? '…' : novidadesVtrExibidas.length}</strong>
              <small>
                {perfilVtr === 'CMT'
                  ? 'Visão consolidada'
                  : novidadesVtrExibidas.length > 0
                  ? 'Aguardando ciência'
                  : 'Sem pendências'}
              </small>
            </button>
          )}

          {perfilVtr && (
            <button
              type="button"
              className="central-operacional-card central-operacional-card-secundario"
              onClick={() => {
                setSelecionado({
                  key: 'manutencoes-vtr',
                  titulo: 'Manutenções de VTR',
                  total: manutencoesVtr.length,
                  itens: manutencoesVtr
                })
                setRegistroAberto(null)
              }}
            >
              <div className="central-card-topo">
                <span>Manutenções de VTR</span>
                {manutencoesVtr.length > 0 && (
                  <b className="central-card-alerta">Em andamento</b>
                )}
              </div>
              <strong>{carregandoManutencoesVtr ? '…' : manutencoesVtr.length}</strong>
              <small>
                {manutencoesVtr.length > 0
                  ? 'Acompanhar manutenções'
                  : 'Sem manutenção aberta'}
              </small>
            </button>
          )}

          {indicadoresExibidos.map((card) => (
            <button
              type="button"
              key={card.key}
              className="central-operacional-card central-operacional-card-secundario"
              onClick={() => { setSelecionado(card); setRegistroAberto(null) }}
            >
              <div className="central-card-topo">
                <span>{card.titulo}</span>
              </div>
              <strong>{card.total}</strong>
              <small>{card.total > 0 ? 'Ver detalhes' : 'Sem registros'}</small>
            </button>
          ))}
        </div>
      </section>

      {novidadeVtrAberta && (
        <div className="central-modal-backdrop" onMouseDown={() => setNovidadeVtrAberta(null)}>
          <section
            className="central-modal"
            onMouseDown={(event) => event.stopPropagation()}
            style={{ maxWidth: 980 }}
          >
            <header className="central-modal-header">
              <div>
                <span className="central-section-eyebrow">Novidade de VTR</span>
                <h3>
                  {novidadeVtrAberta.prefixo || 'VTR'} — {novidadeVtrAberta.titulo || 'Novidade'}
                </h3>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                  justifyContent: 'flex-end'
                }}
              >
                {novidadeVtrAberta?.viatura_id &&
                  typeof onAbrirRivViatura === 'function' && (
                    <button
                      type="button"
                      className="central-button central-button-primary"
                      onClick={() => {
                        const viaturaId =
                          novidadeVtrAberta.viatura_id

                        setNovidadeVtrAberta(null)
                        setSelecionado(null)
                        setRegistroAberto(null)
                        onAbrirRivViatura(viaturaId)
                      }}
                    >
                      Abrir VTR / Ir para RIV
                    </button>
                  )}

                <button
                  type="button"
                  className="central-link-button"
                  onClick={() => setNovidadeVtrAberta(null)}
                >
                  Fechar
                </button>
              </div>
            </header>

            <div className="central-modal-body">
              <section className="central-registro-detalhes" style={{ display: 'grid', gap: 12 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <span>CONSTATAÇÃO</span>
                  <strong>{novidadeVtrAberta.descricao || 'Sem descrição.'}</strong>
                </div>
                <div>
                  <span>Constatada por</span>
                  <strong>
                    {novidadeVtrAberta.constatada_por_nome || novidadeVtrAberta.criado_por_nome || 'Não informado'}
                    {novidadeVtrAberta.constatada_por_re ? ` • RE ${novidadeVtrAberta.constatada_por_re}` : ''}
                  </strong>
                </div>
                <div>
                  <span>Data / hora da constatação</span>
                  <strong>{formatarData(novidadeVtrAberta.constatada_em || novidadeVtrAberta.created_at)}</strong>
                </div>
                <div>
                  <span>Documento da constatação</span>
                  <strong>{novidadeVtrAberta.documento_constatacao || 'Não informado'}</strong>
                </div>
                <div>
                  <span>Condição atual</span>
                  <strong>{String(novidadeVtrAberta.disponibilidade_vtr || 'NAO_AVALIADA').replaceAll('_', ' ')}</strong>
                </div>
                {novidadeVtrAberta.observacao_condicao_vtr && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span>Observação operacional</span>
                    <strong>{novidadeVtrAberta.observacao_condicao_vtr}</strong>
                  </div>
                )}
              </section>

              <section style={{ marginTop: 18 }}>
                <h4>Providências do SVDD</h4>
                {novidadeVtrAberta.svdd_ciencia_em ? (
                  <div className="central-registro-detalhes">
                    <div><span>Recebido por</span><strong>{novidadeVtrAberta.svdd_usuario_nome || '—'}{novidadeVtrAberta.svdd_usuario_re ? ` • RE ${novidadeVtrAberta.svdd_usuario_re}` : ''}</strong></div>
                    <div><span>Ciência em</span><strong>{formatarData(novidadeVtrAberta.svdd_ciencia_em)}</strong></div>
                    <div><span>Documento</span><strong>{novidadeVtrAberta.svdd_documento || '—'}</strong></div>
                    <div><span>Providência</span><strong>{novidadeVtrAberta.svdd_providencia || '—'}</strong></div>
                    {novidadeVtrAberta.svdd_observacao && <div className="central-registro-itens"><span>Observação</span><strong>{novidadeVtrAberta.svdd_observacao}</strong></div>}
                  </div>
                ) : (
                  <div className="central-empty">Aguardando ciência do Encarregado do SVDD.</div>
                )}
              </section>

              <section style={{ marginTop: 18 }}>
                <h4>Providências do P4</h4>
                {novidadeVtrAberta.p4_ciencia_em ? (
                  <div className="central-registro-detalhes">
                    <div><span>Recebido por</span><strong>{novidadeVtrAberta.p4_usuario_nome || '—'}{novidadeVtrAberta.p4_usuario_re ? ` • RE ${novidadeVtrAberta.p4_usuario_re}` : ''}</strong></div>
                    <div><span>Ciência em</span><strong>{formatarData(novidadeVtrAberta.p4_ciencia_em)}</strong></div>
                    <div><span>Documento</span><strong>{novidadeVtrAberta.p4_documento || '—'}</strong></div>
                    <div><span>Providência</span><strong>{novidadeVtrAberta.p4_providencia || '—'}</strong></div>
                    {novidadeVtrAberta.p4_observacao && <div className="central-registro-itens"><span>Observação</span><strong>{novidadeVtrAberta.p4_observacao}</strong></div>}
                  </div>
                ) : (
                  <div className="central-empty">
                    {novidadeVtrAberta.svdd_ciencia_em
                      ? 'Aguardando ciência do P4.'
                      : 'O registro chegará ao P4 após a ciência do SVDD.'}
                  </div>
                )}
              </section>

              {documentosVtr.length > 0 && (
                <section style={{ marginTop: 18 }}>
                  <h4>Documentos anexados</h4>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {documentosVtr.map((doc) => (
                      <div
                        key={doc.id}
                        style={{
                          display: 'flex',
                          gap: 8,
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 10,
                          border: '1px solid #dbe4ee',
                          borderRadius: 8
                        }}
                      >
                        <div>
                          <strong>{doc.nome_arquivo}</strong>
                          <small style={{ display: 'block' }}>{doc.etapa}</small>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <a className="central-detalhe-button" href={doc.url} target="_blank" rel="noreferrer">Visualizar</a>
                          <a className="central-detalhe-button" href={doc.url} download={doc.nome_arquivo}>Baixar</a>
                          {(perfilVtr === doc.etapa || perfilVtr === 'CMT') && (
                            <button type="button" className="central-detalhe-button" onClick={() => excluirDocumentoVtr(doc)}>Excluir</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {perfilVtr !== 'CMT' &&
                ((perfilVtr === 'SVDD' && !novidadeVtrAberta.svdd_ciencia_em) ||
                 (perfilVtr === 'P4' && novidadeVtrAberta.svdd_ciencia_em && !novidadeVtrAberta.p4_ciencia_em)) && (
                <section style={{ marginTop: 20 }}>
                  <h4>{perfilVtr === 'SVDD' ? 'Tomar ciência — SVDD' : 'Tomar ciência — P4'}</h4>

                  <div className="central-registro-detalhes" style={{ marginTop: 10 }}>
                    <label style={{ gridColumn: '1 / -1' }}>
                      <span>Providência *</span>
                      <textarea
                        rows={3}
                        value={formCienciaVtr.providencia}
                        onChange={(event) => setFormCienciaVtr((atual) => ({ ...atual, providencia: event.target.value.toUpperCase() }))}
                        placeholder="Informe a providência adotada."
                      />
                    </label>

                    <label>
                      <span>Documento / referência</span>
                      <input
                        value={formCienciaVtr.documento}
                        onChange={(event) => setFormCienciaVtr((atual) => ({ ...atual, documento: event.target.value.toUpperCase() }))}
                        placeholder="Ex.: MEMORANDO Nº 123/2026"
                      />
                    </label>

                    <label>
                      <span>Anexar documento</span>
                      <input type="file" accept=".pdf,image/*" onChange={(event) => setArquivoVtr(event.target.files?.[0] || null)} />
                    </label>

                    <label style={{ gridColumn: '1 / -1' }}>
                      <span>Observação</span>
                      <textarea
                        rows={3}
                        value={formCienciaVtr.observacao}
                        onChange={(event) => setFormCienciaVtr((atual) => ({ ...atual, observacao: event.target.value.toUpperCase() }))}
                        placeholder="Observações complementares."
                      />
                    </label>
                  </div>

                  <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="central-button central-button-primary"
                      disabled={salvandoCienciaVtr}
                      onClick={salvarCienciaVtr}
                    >
                      {salvandoCienciaVtr ? 'Salvando...' : 'Tomar ciência e registrar providência'}
                    </button>
                  </div>
                </section>
              )}

              {perfilVtr === 'CMT' && (
                <div className="central-empty" style={{ marginTop: 20 }}>
                  Visão consolidada do Comandante de Cia. Nenhuma ciência obrigatória é exigida nesta etapa.
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {selecionado && (
        <div className="central-modal-backdrop" onMouseDown={() => setSelecionado(null)}>
          <section className="central-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header className="central-modal-header">
              <div>
                <span className="central-section-eyebrow">Central Operacional</span>
                <h3>{selecionado.titulo}</h3>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10
                }}
              >
                {ehAprovacaoComandante(
                  selecionado
                ) &&
                  ehComandante(
                    user
                  ) &&
                  (selecionado?.itens || []).some(
                    (item) =>
                      itemEhTransferenciaTaser(
                        item
                      )
                  ) && (
                    <button
                      type="button"
                      className="central-button central-button-primary"
                      disabled={
                        aprovandoTodosTasers ||
                        Boolean(
                          decidindoTaserId
                        )
                      }
                      onClick={
                        aprovarTodosTasersNaCentral
                      }
                    >
                      {aprovandoTodosTasers
                        ? 'Aprovando Tasers...'
                        : 'Aprovar todos os Tasers'}
                    </button>
                  )}

                {ehAprovacaoComandante(
                  selecionado
                ) &&
                  ehComandante(
                    user
                  ) &&
                  (selecionado?.itens || []).some(
                    (item) =>
                      itemEhTransferenciaTPD(
                        item
                      )
                  ) && (
                    <button
                      type="button"
                      className="central-button central-button-primary"
                      disabled={
                        aprovandoTodosTPDs ||
                        Boolean(
                          decidindoTPDId
                        )
                      }
                      onClick={
                        aprovarTodosTPDsNaCentral
                      }
                    >
                      {aprovandoTodosTPDs
                        ? 'Aprovando todos...'
                        : 'Aprovar todos os TPDs'}
                    </button>
                  )}

                {ehTransferencia(
                  selecionado
                ) &&
                  ehEncarregado(
                    user
                  ) &&
                  (selecionado?.itens || []).some(
                    (item) =>
                      itemEhRecebimentoPatrimonialSVDD(
                        item,
                        selecionado
                      )
                  ) && (
                    <button
                      type="button"
                      className="central-button central-button-primary"
                      disabled={
                        recebendoTodosTPDs ||
                        Boolean(
                          recebendoId
                        ) ||
                        Boolean(
                          recusandoId
                        )
                      }
                      onClick={
                        receberTodosNoSVDD
                      }
                    >
                      {recebendoTodosTPDs
                        ? 'Recebendo todos...'
                        : 'Receber todos'}
                    </button>
                  )}

                <button
                  type="button"
                  className="central-link-button"
                  onClick={() =>
                    setSelecionado(null)
                  }
                >
                  Fechar
                </button>
              </div>
            </header>

            <div className="central-modal-body">
              {selecionado?.key === 'recebimentos' &&
                carregandoMunicoesVinculadas && (
                  <div
                    className="central-empty"
                    style={{
                      marginBottom: 10
                    }}
                  >
                    Carregando munições vinculadas...
                  </div>
                )}

              {(selecionado.itens ?? []).length === 0 ? (
                <div className="central-empty">Nenhum registro pendente nesta situação.</div>
              ) : (
                (selecionado.itens ?? []).map((item, index) => (
                  <article className="central-registro-operacional" key={item?.id || `${selecionado.key}-${index}`}>
                    <div className="central-registro-conteudo">
                      <strong>{tituloItem(itemComMunicoesVinculadas(item), selecionado)}</strong>
                      <p>{detalheItem(itemComMunicoesVinculadas(item), selecionado) || 'Sem informações complementares.'}</p>

                      {ehNovidade(selecionado) && (
                        <div
                          style={{
                            marginTop: '6px',
                            fontWeight: 800,
                            color:
                              ehAlertaValidadeColete(
                                item
                              )
                                ? normalizarOperacional(
                                    item?.titulo ||
                                    item?.status ||
                                    ''
                                  ).includes(
                                    'VENCIDO'
                                  )
                                  ? '#dc2626'
                                  : '#b54708'
                                : '#dc2626'
                          }}
                        >
                          {textoSituacaoNovidade(
                            item
                          )}
                        </div>
                      )}

                      {registroAberto === (item?.id || index) && (
                        <div className="central-registro-detalhes">
                          {ehIndicadorPatrimonio(selecionado) ? (
                            <>
                              <div><span>Tipo</span><strong>{item?.tipo || 'Não informado'}</strong></div>
                              <div><span>Status</span><strong>{item?.status_operacional || item?.status || 'Não informado'}</strong></div>
                              <div><span>Patrimônio</span><strong>{item?.patrimonio || item?.identificador || 'Não informado'}</strong></div>
                              <div><span>Nº de série</span><strong>{item?.numero_serie || 'Não informado'}</strong></div>
                              <div><span>Local atual</span><strong>{item?.local_atual || 'Sem localização'}</strong></div>
                              <div><span>Responsável</span><strong>{item?.responsavel_atual_nome || item?.responsavel_nome || 'Não informado'}</strong></div>
                            </>
                          ) : (
                            ehAprovacaoComandante(
                              selecionado
                            ) &&
                            itemEhTransferenciaTPD(
                              item
                            )
                          ) ? (
                            <>
                              <div>
                                <span>Tipo</span>
                                <strong>Transferência de TPD</strong>
                              </div>

                              <div>
                                <span>Patrimônio / Série</span>
                                <strong>
                                  {item?.patrimonio ||
                                    item?.numero_serie ||
                                    item?.metadata?.patrimonio_tpd ||
                                    item?.metadata?.numero_serie_tpd ||
                                    'Não informado'}
                                </strong>
                              </div>

                              <div>
                                <span>Equipamento</span>
                                <strong>
                                  {item?.metadata?.descricao_tpd ||
                                    [
                                      item?.marca ||
                                        item?.metadata?.marca,
                                      item?.modelo ||
                                        item?.metadata?.modelo
                                    ]
                                      .filter(Boolean)
                                      .join(' ') ||
                                    'TPD'}
                                </strong>
                              </div>

                              <div>
                                <span>Origem</span>
                                <strong>
                                  {item?.origem_nome ||
                                    item?.origem_codigo ||
                                    'COFRE DO P4'}
                                </strong>
                              </div>

                              <div>
                                <span>Destino</span>
                                <strong>
                                  {item?.destino_nome ||
                                    item?.destino_codigo ||
                                    'COFRE DO SVDD'}
                                </strong>
                              </div>

                              <div>
                                <span>Protocolo</span>
                                <strong>
                                  {item?.protocolo ||
                                    'Não informado'}
                                </strong>
                              </div>

                              <div>
                                <span>Solicitado por</span>
                                <strong>
                                  {item?.solicitada_por_nome ||
                                    item?.criado_por_nome ||
                                    item?.enviado_por_nome ||
                                    'P4'}
                                </strong>
                              </div>

                              <div>
                                <span>Data da solicitação</span>
                                <strong>
                                  {formatarData(
                                    item?.solicitada_em ||
                                    item?.created_at
                                  ) ||
                                    'Não informada'}
                                </strong>
                              </div>
                            </>
                          ) : itemEhTransferenciaTaser(
                            item
                          ) ? (
                            <>
                              <div>
                                <span>Material</span>
                                <strong>Taser</strong>
                              </div>

                              <div>
                                <span>Tipo da operação</span>
                                <strong>
                                  {String(
                                    item?.dados?.tipo_operacao_taser ||
                                    item?.metadata?.dados_engine?.tipo_operacao_taser ||
                                    item?.tipo_movimentacao ||
                                    item?.tipo ||
                                    'TRANSFERÊNCIA'
                                  ).replaceAll('_', ' ')}
                                </strong>
                              </div>

                              <div>
                                <span>Identificação</span>
                                <strong>
                                  {item?.patrimonio ||
                                    item?.numero_serie ||
                                    item?.dados?.patrimonio ||
                                    item?.dados?.numero_serie ||
                                    item?.metadata?.dados_engine?.patrimonio ||
                                    item?.metadata?.dados_engine?.numero_serie ||
                                    item?.metadata?.patrimonio?.identificacao ||
                                    'Não informada'}
                                </strong>
                              </div>

                              <div>
                                <span>Marca / Modelo</span>
                                <strong>
                                  {[
                                    item?.marca ||
                                      item?.dados?.marca ||
                                      item?.metadata?.dados_engine?.marca,
                                    item?.modelo ||
                                      item?.dados?.modelo ||
                                      item?.metadata?.dados_engine?.modelo
                                  ]
                                    .map(texto)
                                    .filter(Boolean)
                                    .join(' ') ||
                                    'Não informado'}
                                </strong>
                              </div>

                              <div>
                                <span>Origem</span>
                                <strong>
                                  {item?.origem_nome ||
                                    item?.origem_codigo ||
                                    item?.dados?.guardiao_origem?.nome ||
                                    item?.metadata?.dados_engine?.guardiao_origem?.nome ||
                                    'COFRE DO P4'}
                                </strong>
                              </div>

                              <div>
                                <span>Destino</span>
                                <strong>
                                  {item?.destino_nome ||
                                    item?.destino_codigo ||
                                    item?.dados?.destino_nome ||
                                    item?.dados?.guardiao_destino?.nome ||
                                    item?.metadata?.dados_engine?.destino_nome ||
                                    item?.metadata?.dados_engine?.guardiao_destino?.nome ||
                                    'Não informado'}
                                </strong>
                              </div>

                              <div>
                                <span>Protocolo</span>
                                <strong>
                                  {item?.protocolo ||
                                    'Não informado'}
                                </strong>
                              </div>

                              <div>
                                <span>Solicitado por</span>
                                <strong>
                                  {item?.solicitada_por_nome ||
                                    item?.criado_por_nome ||
                                    item?.enviado_por_nome ||
                                    item?.metadata?.realizado_por?.nome ||
                                    'P4'}
                                </strong>
                              </div>

                              <div>
                                <span>Data da solicitação</span>
                                <strong>
                                  {formatarData(
                                    item?.solicitada_em ||
                                    item?.created_at
                                  ) ||
                                    'Não informada'}
                                </strong>
                              </div>

                              <div className="central-registro-itens">
                                <span>Observações / Documento</span>
                                <strong>
                                  {item?.observacoes ||
                                    item?.documento ||
                                    item?.dados?.observacoes_transferencia ||
                                    item?.metadata?.dados_engine?.observacoes_transferencia ||
                                    item?.observacao ||
                                    item?.metadata?.movimentacao?.observacao ||
                                    'Não informado'}
                                </strong>
                              </div>
                            </>
                          ) : (
                            ehAprovacaoComandante(
                              selecionado
                            ) &&
                            itemEhTransferenciaTorniquete(
                              item
                            )
                          ) ? (
                            <>
                              <div>
                                <span>Tipo</span>
                                <strong>
                                  Transferência de Torniquete
                                </strong>
                              </div>

                              <div>
                                <span>Quantidade</span>
                                <strong>
                                  {Number(
                                    item?.quantidade_total ||
                                    item?.quantidade ||
                                    0
                                  )} un.
                                </strong>
                              </div>

                              <div>
                                <span>Origem</span>
                                <strong>
                                  {item?.origem_nome ||
                                    item?.origem_tipo ||
                                    'Não informada'}
                                </strong>
                              </div>

                              <div>
                                <span>Destino</span>
                                <strong>
                                  {item?.destino_nome ||
                                    item?.destino_tipo ||
                                    'Não informado'}
                                </strong>
                              </div>

                              <div>
                                <span>Solicitado por</span>
                                <strong>
                                  {item?.solicitada_por_nome ||
                                    item?.criado_por_nome ||
                                    'Não informado'}
                                </strong>
                              </div>

                              <div>
                                <span>Data da solicitação</span>
                                <strong>
                                  {formatarData(
                                    item?.solicitada_em ||
                                    item?.created_at
                                  ) ||
                                    'Não informada'}
                                </strong>
                              </div>

                              <div>
                                <span>Documento</span>
                                <strong>
                                  {item?.documento ||
                                    'Não informado'}
                                </strong>
                              </div>

                              {item?.observacoes && (
                                <div className="central-registro-itens">
                                  <span>Observações</span>
                                  <strong>
                                    {item.observacoes}
                                  </strong>
                                </div>
                              )}
                            </>
                          ) : (
                            ehAprovacaoComandante(
                              selecionado
                            ) &&
                            itemEhDescargaMunicao(
                              item
                            )
                          ) ? (
                            <>
                              <div>
                                <span>Tipo</span>
                                <strong>
                                  Descarga de Munição
                                </strong>
                              </div>

                              <div>
                                <span>Calibre</span>
                                <strong>
                                  {item?.calibre ||
                                    item?.dados?.calibre ||
                                    'Não informado'}
                                </strong>
                              </div>

                              <div>
                                <span>Quantidade</span>
                                <strong>
                                  {Number(
                                    item?.quantidade_total ||
                                    item?.quantidade ||
                                    item?.dados?.quantidade ||
                                    0
                                  )} un.
                                </strong>
                              </div>

                              <div>
                                <span>Origem</span>
                                <strong>
                                  {item?.origem_nome ||
                                    'COFRE DO P4'}
                                </strong>
                              </div>

                              <div>
                                <span>Destino final</span>
                                <strong>
                                  {item?.destino_nome ||
                                    item?.dados?.destino_final ||
                                    'Não informado'}
                                </strong>
                              </div>

                              <div>
                                <span>Solicitado por</span>
                                <strong>
                                  {item?.solicitada_por_nome ||
                                    'P4'}
                                </strong>
                              </div>

                              <div>
                                <span>Data da solicitação</span>
                                <strong>
                                  {formatarData(
                                    item?.solicitada_em ||
                                    item?.created_at
                                  ) ||
                                    'Não informada'}
                                </strong>
                              </div>

                              <div>
                                <span>Documento</span>
                                <strong>
                                  {item?.documento ||
                                    item?.dados?.documento ||
                                    'Não informado'}
                                </strong>
                              </div>

                              <div className="central-registro-itens">
                                <span>Motivo</span>
                                <strong>
                                  {item?.motivo ||
                                    item?.dados?.motivo_descarga ||
                                    'Não informado'}
                                </strong>
                              </div>

                              {(item?.observacoes ||
                                item?.dados?.observacoes) && (
                                <div className="central-registro-itens">
                                  <span>Observações</span>
                                  <strong>
                                    {item?.observacoes ||
                                      item?.dados?.observacoes}
                                  </strong>
                                </div>
                              )}

                              {obterFotosDescargaMunicao(item).length > 0 && (
                                <div
                                  className="central-registro-itens"
                                  style={{
                                    gridColumn:
                                      '1 / -1'
                                  }}
                                >
                                  <span>Fotos anexadas</span>

                                  <div
                                    style={{
                                      display:
                                        'grid',
                                      gridTemplateColumns:
                                        'repeat(auto-fit, minmax(120px, 160px))',
                                      gap:
                                        12,
                                      marginTop:
                                        8
                                    }}
                                  >
                                    {obterFotosDescargaMunicao(item).map(
                                      (foto, fotoIndex) => (
                                        <button
                                          key={
                                            foto?.id ||
                                            foto?.foto_url ||
                                            fotoIndex
                                          }
                                          type="button"
                                          onClick={() =>
                                            setFotoAmpliada({
                                              ...foto,
                                              indice:
                                                fotoIndex + 1,
                                              contexto:
                                                'DESCARGA DE MUNIÇÃO'
                                            })
                                          }
                                          title="Clique para ampliar a foto"
                                          style={{
                                            display:
                                              'block',
                                            width:
                                              '100%',
                                            padding:
                                              0,
                                            borderRadius:
                                              12,
                                            overflow:
                                              'hidden',
                                            border:
                                              '1px solid rgba(255,255,255,.18)',
                                            background:
                                              'rgba(255,255,255,.04)',
                                            cursor:
                                              'zoom-in'
                                          }}
                                        >
                                          <img
                                            src={
                                              foto.foto_url
                                            }
                                            alt={`Foto ${fotoIndex + 1} da descarga de munição`}
                                            style={{
                                              display:
                                                'block',
                                              width:
                                                '100%',
                                              height:
                                                120,
                                              objectFit:
                                                'cover'
                                            }}
                                          />
                                        </button>
                                      )
                                    )}
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            ehAprovacaoComandante(
                              selecionado
                            ) &&
                            itemEhDescargaColete(
                              item
                            )
                          ) ? (
                            <>
                              <div>
                                <span>Tipo</span>
                                <strong>
                                  Descarga de Colete Balístico
                                </strong>
                              </div>

                              <div>
                                <span>Patrimônio</span>
                                <strong>
                                  {item?.patrimonio ||
                                    'Não informado'}
                                </strong>
                              </div>

                              <div>
                                <span>Nº de série</span>
                                <strong>
                                  {item?.numero_serie ||
                                    'Não informado'}
                                </strong>
                              </div>

                              <div>
                                <span>Status</span>
                                <strong>
                                  {item?.status ||
                                    'AGUARDANDO_APROVACAO'}
                                </strong>
                              </div>

                              <div>
                                <span>Solicitado por</span>
                                <strong>
                                  {item?.solicitada_por_nome ||
                                    'P4'}
                                </strong>
                              </div>

                              <div>
                                <span>Data da solicitação</span>
                                <strong>
                                  {formatarData(
                                    item?.solicitada_em ||
                                    item?.created_at
                                  ) ||
                                    'Não informada'}
                                </strong>
                              </div>

                              <div className="central-registro-itens">
                                <span>Motivo</span>
                                <strong>
                                  {item?.motivo ||
                                    item?.observacoes ||
                                    'Não informado'}
                                </strong>
                              </div>

                              <div>
                                <span>Situação anterior</span>
                                <strong>
                                  {[
                                    item?.status_anterior,
                                    item?.local_anterior
                                  ]
                                    .filter(Boolean)
                                    .join(' • ') ||
                                    'Não informada'}
                                </strong>
                              </div>
                            </>
                          ) : ehNovidade(selecionado) ? (
                            <>
                              <div><span>Tipo de patrimônio</span><strong>{item?.especie || item?.especie_patrimonio || item?.tipo_especifico || item?.tipo_patrimonio || 'Não informado'}</strong></div>
                              <div><span>Patrimônio / Nº de série</span><strong>{item?.patrimonio || item?.numero_patrimonio || item?.numero_serie || item?.identificador || item?.referencia || 'Não informado'}</strong></div>
                              <div><span>Ocorrência</span><strong>{item?.titulo || 'Novidade patrimonial'}</strong></div>
                              <div><span>Gravidade</span><strong>{item?.gravidade || 'Não informada'}</strong></div>
                              <div><span>Status</span><strong>{item?.status || 'Registrada'}</strong></div>
                              <div><span>Registrado por</span><strong>{item?.registrado_por_nome || 'Não informado'}</strong></div>
                              <div><span>Data / hora</span><strong>{formatarData(item?.created_at)}</strong></div>
                              <div>
                                <span>
                                  {item?.descarga_pendente
                                    ? 'Tempo aguardando aprovação'
                                    : ehAlertaValidadeColete(
                                        item
                                      )
                                    ? 'Situação da validade'
                                    : 'Tempo aguardando providência'}
                                </span>

                                <strong
                                  style={{
                                    color:
                                      ehAlertaValidadeColete(
                                        item
                                      )
                                        ? normalizarOperacional(
                                            item?.titulo ||
                                            item?.status ||
                                            ''
                                          ).includes(
                                            'VENCIDO'
                                          )
                                          ? '#dc2626'
                                          : '#b54708'
                                        : '#dc2626',
                                    fontWeight:
                                      800
                                  }}
                                >
                                  {textoSituacaoNovidade(
                                    item
                                  ) ||
                                    'Não informado'}
                                </strong>
                              </div>
                              <div className="central-registro-itens"><span>Descrição</span><strong>{item?.descricao || 'Sem descrição.'}</strong></div>
                              {(item?.providencia || item?.providencia_sugerida) && (
                                <div className="central-registro-itens"><span>Providência sugerida</span><strong>{item?.providencia || item?.providencia_sugerida}</strong></div>
                              )}

                              {obterFotosNovidade(item).length > 0 && (
                                <div
                                  className="central-registro-itens"
                                  style={{
                                    gridColumn:
                                      '1 / -1'
                                  }}
                                >
                                  <span>Fotos anexadas</span>

                                  <div
                                    style={{
                                      display:
                                        'grid',
                                      gridTemplateColumns:
                                        'repeat(auto-fit, minmax(120px, 160px))',
                                      gap: 12,
                                      marginTop: 8
                                    }}
                                  >
                                    {obterFotosNovidade(item).map(
                                      (foto, fotoIndex) => (
                                        <button
                                          key={
                                            foto?.id ||
                                            foto?.foto_url ||
                                            fotoIndex
                                          }
                                          type="button"
                                          onClick={() =>
                                            setFotoAmpliada({
                                              ...foto,
                                              indice:
                                                fotoIndex + 1,
                                              contexto:
                                                'NOVIDADE'
                                            })
                                          }
                                          title="Clique para ampliar a foto"
                                          style={{
                                            display:
                                              'block',
                                            width:
                                              '100%',
                                            padding:
                                              0,
                                            borderRadius:
                                              12,
                                            overflow:
                                              'hidden',
                                            border:
                                              '1px solid rgba(255,255,255,.18)',
                                            background:
                                              'rgba(255,255,255,.04)',
                                            cursor:
                                              'zoom-in'
                                          }}
                                        >
                                          <img
                                            src={
                                              foto.foto_url
                                            }
                                            alt={`Foto ${fotoIndex + 1} da novidade`}
                                            style={{
                                              display:
                                                'block',
                                              width:
                                                '100%',
                                              height:
                                                120,
                                              objectFit:
                                                'cover'
                                            }}
                                          />
                                        </button>
                                      )
                                    )}
                                  </div>
                                </div>
                              )}
                            </>
                          ) : selecionado?.key === 'manutencoes-vtr' ? (
                            <>
                              <div>
                                <span>Viatura</span>
                                <strong>{item?.prefixo || 'Não informada'}</strong>
                              </div>
                              <div>
                                <span>Situação da VTR</span>
                                <strong>{String(item?.situacao_viatura || '—').replaceAll('_', ' ')}</strong>
                              </div>
                              <div>
                                <span>Status da manutenção</span>
                                <strong>{String(item?.manutencao_status || 'AGUARDANDO_PROVIDENCIA').replaceAll('_', ' ')}</strong>
                              </div>
                              <div>
                                <span>Execução</span>
                                <strong>{String(item?.manutencao_execucao || '—').replaceAll('_', ' ')}</strong>
                              </div>
                              <div>
                                <span>Tipo</span>
                                <strong>{String(item?.manutencao_tipo || 'AINDA NÃO CLASSIFICADA').replaceAll('_', ' ')}</strong>
                              </div>
                              <div>
                                <span>Quilometragem</span>
                                <strong>
                                  {item?.quilometragem != null
                                    ? `${Number(item.quilometragem).toLocaleString('pt-BR')} km`
                                    : 'Não informada'}
                                </strong>
                              </div>
                              <div className="central-registro-itens">
                                <span>Providência atual</span>
                                <strong>{item?.providencia_atual || 'Aguardando definição'}</strong>
                              </div>
                              {(item?.manutencao_oficina || item?.manutencao_local) && (
                                <div className="central-registro-itens">
                                  <span>Local / oficina</span>
                                  <strong>{item?.manutencao_oficina || item?.manutencao_local}</strong>
                                </div>
                              )}
                              {item?.manutencao_os && (
                                <div className="central-registro-itens">
                                  <span>OS / documento</span>
                                  <strong>{item.manutencao_os}</strong>
                                </div>
                              )}
                              {item?.manutencao_observacoes && (
                                <div className="central-registro-itens">
                                  <span>Observações / serviço</span>
                                  <strong>{item.manutencao_observacoes}</strong>
                                </div>
                              )}
                            </>
                          ) : itemEhManutencaoExterna(item) ? (
                            <>
                              <div><span>Status</span><strong>{item?.status || 'Não informado'}</strong></div>
                              <div><span>Solicitado por</span><strong>{item?.solicitada_por_nome || 'Não informado'}</strong></div>
                              <div><span>Assistência / destino</span><strong>{item?.destino_nome || 'Não informado'}</strong></div>
                              <div><span>Tipo de destino</span><strong>{item?.destino_tipo || 'Não informado'}</strong></div>
                              <div><span>Contato</span><strong>{item?.destino_contato || 'Não informado'}</strong></div>
                              <div><span>Previsão de retorno</span><strong>{formatarData(item?.previsao_retorno) || 'Não informada'}</strong></div>
                              <div className="central-registro-itens"><span>Motivo</span><strong>{item?.motivo || 'Não informado'}</strong></div>
                              <div className="central-registro-itens"><span>Serviço solicitado</span><strong>{item?.servico_solicitado || 'Não informado'}</strong></div>
                              {item?.observacoes_saida && (
                                <div className="central-registro-itens"><span>Observações</span><strong>{item.observacoes_saida}</strong></div>
                              )}
                            </>
                          ) : (
                            <>
                              <div><span>Status</span><strong>{item?.status || 'Não informado'}</strong></div>
                              <div><span>Tipo</span><strong>{item?.tipo_movimentacao || item?.tipo || item?.categoria || 'Não informado'}</strong></div>
                              <div><span>Solicitante</span><strong>{item?.solicitante_nome || item?.enviado_por_nome || 'Não informado'}</strong></div>
                              <div><span>Destinatário</span><strong>{item?.recebedor_nome || item?.destino_codigo || item?.destino_nome || 'Não informado'}</strong></div>
                              <div><span>Origem</span><strong>{item?.origem_local || item?.origem_nome || item?.origem_codigo || 'Não informada'}</strong></div>
                              <div><span>Destino</span><strong>{item?.destino_local || item?.destino_nome || item?.destino_codigo || 'Não informado'}</strong></div>
                            </>
                          )}
                          {Array.isArray(
                            itemComMunicoesVinculadas(item)?.itens
                          ) &&
                            itemComMunicoesVinculadas(item).itens.length > 0 && (
                            <div className="central-registro-itens">
                              <span>Materiais</span>

                              {itemComMunicoesVinculadas(item).itens.map(
                                (registro, itemIndex) => (
                                  <strong
                                    key={
                                      registro?.id ||
                                      itemIndex
                                    }
                                  >
                                    {registro?.descricao ||
                                      registro?.tipo_patrimonio ||
                                      'Material'}

                                    {Number(
                                      registro?.quantidade ||
                                      1
                                    ) > 1
                                      ? ` — ${registro.quantidade} un.`
                                      : ''}
                                  </strong>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="central-registro-acoes">
                      <time>{formatarData(item?.created_at || item?.updated_at)}</time>
                      <button
                        type="button"
                        className="central-detalhe-button"
                        onClick={() => setRegistroAberto(
                          registroAberto === (item?.id || index) ? null : (item?.id || index)
                        )}
                      >
                        {registroAberto === (item?.id || index) ? 'Ocultar' : 'Ver detalhes'}
                      </button>
                      {selecionado?.key === 'novidades-vtr' && (
                        <button
                          type="button"
                          className="central-button central-button-primary"
                          onClick={() => abrirNovidadeVtr(item)}
                        >
                          Abrir novidade
                        </button>
                      )}

                      {ehCancelavelDescargaColete(
                        item,
                        selecionado
                      ) && (
                        <button
                          type="button"
                          className="central-detalhe-button"
                          disabled={
                            Boolean(
                              cancelandoDescargaId
                            )
                          }
                          onClick={() =>
                            cancelarSolicitacaoDescargaColete(
                              item
                            )
                          }
                          style={{
                            borderColor:
                              '#dc2626',
                            color:
                              '#dc2626',
                            fontWeight:
                              800
                          }}
                        >
                          {cancelandoDescargaId ===
                          item?.descarga_solicitacao_id
                            ? 'Cancelando solicitação...'
                            : 'Cancelar solicitação de descarga'}
                        </button>
                      )}

                      {ehCancelavelAguardandoUsuario(item, selecionado) && (
                        <button
                          type="button"
                          className="central-detalhe-button"
                          disabled={Boolean(cancelandoId) || Boolean(recebendoId)}
                          onClick={() => cancelarAguardandoRecebimento(item)}
                          style={{
                            borderColor: '#dc2626',
                            color: '#dc2626',
                            fontWeight: 800
                          }}
                        >
                          {cancelandoId === item.id
                            ? 'Cancelando...'
                            : 'Cancelar movimentação'}
                        </button>
                      )}

                      {ehRecebimentoP4(item, selecionado) && (
                        <button
                          type="button"
                          className="central-button central-button-primary"
                          disabled={Boolean(recebendoId) || Boolean(cancelandoId)}
                          onClick={() => receberNoP4(item)}
                        >
                          {recebendoId === item.id
                            ? 'Recebendo...'
                            : 'Receber'}
                        </button>
                      )}

                      {itemEhRecebimentoTaserSVDD(
                        item,
                        selecionado
                      ) &&
                        ehEncarregado(
                          user
                        ) && (
                          <>
                            <button
                              type="button"
                              className="central-detalhe-button"
                              disabled={
                                Boolean(
                                  recebendoId
                                ) ||
                                Boolean(
                                  recusandoId
                                ) ||
                                recebendoTodosTPDs
                              }
                              onClick={() =>
                                recusarTransferenciaTaserNoSVDD(
                                  item
                                )
                              }
                              style={{
                                borderColor:
                                  '#dc2626',
                                color:
                                  '#dc2626',
                                fontWeight:
                                  800
                              }}
                            >
                              {recusandoId ===
                              (
                                item?.movimentacao_id ||
                                item?.transferencia_id ||
                                item?.id
                              )
                                ? 'Recusando...'
                                : 'Recusar'}
                            </button>

                            <button
                              type="button"
                              className="central-button central-button-primary"
                              disabled={
                                Boolean(
                                  recebendoId
                                ) ||
                                Boolean(
                                  recusandoId
                                ) ||
                                recebendoTodosTPDs
                              }
                              onClick={() =>
                                receberTransferenciaTaserNoSVDD(
                                  item
                                )
                              }
                            >
                              {recebendoId ===
                              (
                                item?.movimentacao_id ||
                                item?.transferencia_id ||
                                item?.id
                              )
                                ? 'Recebendo...'
                                : 'Receber'}
                            </button>
                          </>
                        )}

                      {itemEhRecebimentoTPDSVDD(
                        item,
                        selecionado
                      ) &&
                        ehEncarregado(
                          user
                        ) && (
                          <>
                            <button
                              type="button"
                              className="central-detalhe-button"
                              disabled={
                                Boolean(
                                  recebendoId
                                ) ||
                                Boolean(
                                  recusandoId
                                ) ||
                                recebendoTodosTPDs
                              }
                              onClick={() =>
                                recusarTransferenciaTPDNoSVDD(
                                  item
                                )
                              }
                              style={{
                                borderColor:
                                  '#dc2626',
                                color:
                                  '#dc2626',
                                fontWeight:
                                  800
                              }}
                            >
                              {recusandoId ===
                              (
                                item?.transferencia_id ||
                                item?.id
                              )
                                ? 'Recusando...'
                                : 'Recusar'}
                            </button>

                            <button
                              type="button"
                              className="central-button central-button-primary"
                              disabled={
                                Boolean(
                                  recebendoId
                                ) ||
                                Boolean(
                                  recusandoId
                                ) ||
                                recebendoTodosTPDs
                              }
                              onClick={() =>
                                receberTransferenciaTPDNoSVDD(
                                  item
                                )
                              }
                            >
                              {recebendoId ===
                              (
                                item?.transferencia_id ||
                                item?.id
                              )
                                ? 'Recebendo...'
                                : 'Receber'}
                            </button>
                          </>
                        )}

                      {itemEhRecebimentoTorniquete(
                        item,
                        selecionado
                      ) && (
                        <button
                          type="button"
                          className="central-button central-button-primary"
                          disabled={
                            Boolean(recebendoId)
                          }
                          onClick={() =>
                            receberTransferenciaTorniqueteNaCentral(
                              item
                            )
                          }
                        >
                          {recebendoId ===
                          (
                            item?.transferencia_id ||
                            item?.id
                          )
                            ? 'Recebendo...'
                            : 'Receber'}
                        </button>
                      )}

                      {ehTransferenciaHTEngine(item, selecionado) &&
                        normalizarOperacional(
                          user?.perfil_efetivo ||
                          user?.perfil ||
                          user?.role ||
                          user?.tipo_perfil
                        ) === 'P4' && (
                        <>
                          <button
                            type="button"
                            className="central-detalhe-button"
                            disabled={
                              Boolean(recebendoId) ||
                              Boolean(recusandoId) ||
                              Boolean(cancelandoId)
                            }
                            onClick={() => recusarTransferenciaHTNoP4(item)}
                            style={{
                              borderColor: '#dc2626',
                              color: '#dc2626',
                              fontWeight: 800
                            }}
                          >
                            {recusandoId === item.id
                              ? 'Recusando...'
                              : 'Recusar'}
                          </button>

                          <button
                            type="button"
                            className="central-button central-button-primary"
                            disabled={
                              Boolean(recebendoId) ||
                              Boolean(recusandoId) ||
                              Boolean(cancelandoId)
                            }
                            onClick={() => receberTransferenciaHTNoP4(item)}
                          >
                            {recebendoId === item.id
                              ? 'Recebendo...'
                              : 'Receber'}
                          </button>
                        </>
                      )}


                      {ehTransferenciaManutencaoMunicaoEngine(
                        item,
                        selecionado
                      ) &&
                        normalizarOperacional(
                          user?.perfil_efetivo ||
                          user?.perfil ||
                          user?.role ||
                          user?.tipo_perfil
                        ) === 'P4' && (
                        <>
                          <button
                            type="button"
                            className="central-detalhe-button"
                            disabled={
                              Boolean(recebendoId) ||
                              Boolean(recusandoId) ||
                              Boolean(cancelandoId)
                            }
                            onClick={() =>
                              recusarTransferenciaManutencaoMunicaoNoP4(
                                item
                              )
                            }
                            style={{
                              borderColor:
                                '#dc2626',
                              color:
                                '#dc2626',
                              fontWeight:
                                800
                            }}
                          >
                            {recusandoId === item.id
                              ? 'Recusando...'
                              : 'Recusar'}
                          </button>

                          <button
                            type="button"
                            className="central-button central-button-primary"
                            disabled={
                              Boolean(recebendoId) ||
                              Boolean(recusandoId) ||
                              Boolean(cancelandoId)
                            }
                            onClick={() =>
                              receberTransferenciaManutencaoMunicaoNoP4(
                                item
                              )
                            }
                          >
                            {recebendoId === item.id
                              ? 'Recebendo...'
                              : 'Receber'}
                          </button>
                        </>
                      )}

                      {ehAprovacaoComandante(
                        selecionado
                      ) &&
                        itemEhManutencaoMunicao(
                          item
                        ) &&
                        ehComandante(
                          user
                        ) && (
                          <>
                            <button
                              type="button"
                              className="central-detalhe-button"
                              disabled={
                                Boolean(
                                  decidindoMunicaoId
                                )
                              }
                              onClick={() =>
                                reprovarManutencaoMunicaoNaCentral(
                                  item
                                )
                              }
                              style={{
                                borderColor:
                                  '#dc2626',
                                color:
                                  '#dc2626',
                                fontWeight:
                                  800
                              }}
                            >
                              {decidindoMunicaoId ===
                              (
                                item?.movimentacao_id ||
                                item?.id
                              )
                                ? 'Processando...'
                                : 'Reprovar'}
                            </button>

                            <button
                              type="button"
                              className="central-button central-button-primary"
                              disabled={
                                Boolean(
                                  decidindoMunicaoId
                                )
                              }
                              onClick={() =>
                                aprovarManutencaoMunicaoNaCentral(
                                  item
                                )
                              }
                            >
                              {decidindoMunicaoId ===
                              (
                                item?.movimentacao_id ||
                                item?.id
                              )
                                ? 'Aprovando...'
                                : 'Aprovar'}
                            </button>
                          </>
                        )}

                      {ehAprovacaoComandante(
                        selecionado
                      ) &&
                        itemEhDescargaMunicao(
                          item
                        ) &&
                        ehComandante(
                          user
                        ) && (
                          <>
                            <button
                              type="button"
                              className="central-detalhe-button"
                              disabled={
                                Boolean(
                                  decidindoMunicaoId
                                )
                              }
                              onClick={() =>
                                reprovarDescargaMunicaoNaCentral(
                                  item
                                )
                              }
                              style={{
                                borderColor:
                                  '#dc2626',
                                color:
                                  '#dc2626',
                                fontWeight:
                                  800
                              }}
                            >
                              {decidindoMunicaoId ===
                              (
                                item?.movimentacao_id ||
                                item?.id
                              )
                                ? 'Processando...'
                                : 'Reprovar'}
                            </button>

                            <button
                              type="button"
                              className="central-button central-button-primary"
                              disabled={
                                Boolean(
                                  decidindoMunicaoId
                                )
                              }
                              onClick={() =>
                                aprovarDescargaMunicaoNaCentral(
                                  item
                                )
                              }
                            >
                              {decidindoMunicaoId ===
                              (
                                item?.movimentacao_id ||
                                item?.id
                              )
                                ? 'Aprovando...'
                                : 'Aprovar descarga'}
                            </button>
                          </>
                        )}

                      {ehAprovacaoComandante(
                        selecionado
                      ) &&
                        itemEhTransferenciaTaser(
                          item
                        ) &&
                        ehComandante(
                          user
                        ) && (
                          <>
                            <button
                              type="button"
                              className="central-detalhe-button"
                              disabled={
                                Boolean(
                                  decidindoTaserId
                                ) ||
                                aprovandoTodosTasers
                              }
                              onClick={() =>
                                reprovarTransferenciaTaserNaCentral(
                                  item
                                )
                              }
                              style={{
                                borderColor:
                                  '#dc2626',
                                color:
                                  '#dc2626',
                                fontWeight:
                                  800
                              }}
                            >
                              {decidindoTaserId ===
                              (
                                item?.movimentacao_id ||
                                item?.transferencia_id ||
                                item?.id
                              )
                                ? 'Processando...'
                                : 'Reprovar'}
                            </button>

                            <button
                              type="button"
                              className="central-button central-button-primary"
                              disabled={
                                Boolean(
                                  decidindoTaserId
                                ) ||
                                aprovandoTodosTasers
                              }
                              onClick={() =>
                                aprovarTransferenciaTaserNaCentral(
                                  item
                                )
                              }
                            >
                              {decidindoTaserId ===
                              (
                                item?.movimentacao_id ||
                                item?.transferencia_id ||
                                item?.id
                              )
                                ? 'Aprovando...'
                                : 'Aprovar'}
                            </button>
                          </>
                        )}

                      {ehAprovacaoComandante(
                        selecionado
                      ) &&
                        itemEhTransferenciaTPD(
                          item
                        ) &&
                        ehComandante(
                          user
                        ) && (
                          <>
                            <button
                              type="button"
                              className="central-detalhe-button"
                            disabled={
                              Boolean(
                                decidindoTPDId
                              ) ||
                              aprovandoTodosTPDs
                            }
                            onClick={() =>
                              reprovarTransferenciaTPDNaCentral(
                                item
                              )
                            }
                            style={{
                              borderColor:
                                '#dc2626',
                              color:
                                '#dc2626',
                              fontWeight:
                                800
                            }}
                          >
                            {decidindoTPDId ===
                            (
                              item?.transferencia_id ||
                              item?.id
                            )
                              ? 'Processando...'
                              : 'Reprovar'}
                          </button>

                          <button
                            type="button"
                            className="central-button central-button-primary"
                            disabled={
                              Boolean(
                                decidindoTPDId
                              ) ||
                              aprovandoTodosTPDs
                            }
                            onClick={() =>
                              aprovarTransferenciaTPDNaCentral(
                                item
                              )
                            }
                          >
                            {decidindoTPDId ===
                            (
                              item?.transferencia_id ||
                              item?.id
                            )
                              ? 'Aprovando...'
                              : 'Aprovar'}
                            </button>
                          </>
                        )}

                      {ehAprovacaoComandante(
                        selecionado
                      ) &&
                        itemEhTransferenciaTorniquete(
                          item
                        ) &&
                        ehComandante(
                          user
                        ) && (
                          <>
                            <button
                              type="button"
                              className="central-detalhe-button"
                              disabled={
                                Boolean(
                                  decidindoTorniqueteId
                                )
                              }
                              onClick={() =>
                                reprovarTransferenciaTorniqueteNaCentral(
                                  item
                                )
                              }
                              style={{
                                borderColor:
                                  '#dc2626',
                                color:
                                  '#dc2626',
                                fontWeight:
                                  800
                              }}
                            >
                              {decidindoTorniqueteId ===
                              (
                                item?.transferencia_id ||
                                item?.id
                              )
                                ? 'Processando...'
                                : 'Reprovar'}
                            </button>

                            <button
                              type="button"
                              className="central-button central-button-primary"
                              disabled={
                                Boolean(
                                  decidindoTorniqueteId
                                )
                              }
                              onClick={() =>
                                aprovarTransferenciaTorniqueteNaCentral(
                                  item
                                )
                              }
                            >
                              {decidindoTorniqueteId ===
                              (
                                item?.transferencia_id ||
                                item?.id
                              )
                                ? 'Aprovando...'
                                : 'Aprovar'}
                            </button>
                          </>
                        )}

                      {ehAprovacaoComandante(
                        selecionado
                      ) &&
                        itemEhTransferenciaMunicao(
                          item
                        ) &&
                        ehComandante(
                          user
                        ) && (
                          <button
                            type="button"
                            className="central-button central-button-primary"
                            disabled={
                              Boolean(
                                decidindoMunicaoId
                              )
                            }
                            onClick={() =>
                              aprovarTransferenciaMunicaoNaCentral(
                                item
                              )
                            }
                          >
                            {decidindoMunicaoId ===
                            (
                              item?.transferencia_id ||
                              item?.id
                            )
                              ? 'Aprovando...'
                              : 'Aprovar'}
                          </button>
                        )}

                      {ehAprovacaoComandante(
                        selecionado
                      ) &&
                        itemEhDescargaColete(
                          item
                        ) &&
                        ehComandante(
                          user
                        ) && (
                          <>
                            <button
                              type="button"
                              className="central-detalhe-button"
                              disabled={
                                Boolean(
                                  decidindoDescargaId
                                )
                              }
                              onClick={() =>
                                decidirDescargaNaCentral(
                                  item,
                                  'REPROVAR'
                                )
                              }
                              style={{
                                borderColor:
                                  '#dc2626',
                                color:
                                  '#dc2626',
                                fontWeight:
                                  800
                              }}
                            >
                              {decidindoDescargaId ===
                              item.id
                                ? 'Processando...'
                                : 'Reprovar'}
                            </button>

                            <button
                              type="button"
                              className="central-button central-button-primary"
                              disabled={
                                Boolean(
                                  decidindoDescargaId
                                )
                              }
                              onClick={() =>
                                decidirDescargaNaCentral(
                                  item,
                                  'APROVAR'
                                )
                              }
                            >
                              {decidindoDescargaId ===
                              item.id
                                ? 'Processando...'
                                : 'Aprovar descarga'}
                            </button>
                          </>
                        )}

                      {ehAprovacaoComandante(selecionado) && itemEhManutencaoExterna(item) && (
                        <>
                          <button
                            type="button"
                            className="central-detalhe-button"
                            disabled={Boolean(decidindoManutencaoExternaId)}
                            onClick={() => decidirExterna(item, 'REPROVAR')}
                            style={{
                              borderColor: '#dc2626',
                              color: '#dc2626',
                              fontWeight: 800
                            }}
                          >
                            {decidindoManutencaoExternaId === item.id
                              ? 'Processando...'
                              : 'Reprovar'}
                          </button>

                          <button
                            type="button"
                            className="central-button central-button-primary"
                            disabled={Boolean(decidindoManutencaoExternaId)}
                            onClick={() => decidirExterna(item, 'APROVAR')}
                          >
                            {decidindoManutencaoExternaId === item.id
                              ? 'Processando...'
                              : 'Aprovar'}
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {fotoAmpliada?.foto_url && (
        <div
          className="central-modal-backdrop"
          style={{
            zIndex: 10050
          }}
          onMouseDown={() =>
            setFotoAmpliada(null)
          }
        >
          <section
            className="central-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
            style={{
              width:
                'min(980px, calc(100vw - 48px))',
              maxHeight:
                'calc(100vh - 48px)'
            }}
          >
            <header className="central-modal-header">
              <div>
                <span className="central-section-eyebrow">
                  FOTO ANEXADA
                </span>
                <h3>
                  {fotoAmpliada.contexto
                    ? `${fotoAmpliada.contexto} — `
                    : ''}
                  Foto {fotoAmpliada.indice || 1}
                </h3>
              </div>

              <button
                type="button"
                className="central-link-button"
                onClick={() =>
                  setFotoAmpliada(null)
                }
              >
                Fechar
              </button>
            </header>

            <div
              className="central-modal-body"
              style={{
                display:
                  'grid',
                placeItems:
                  'center',
                padding:
                  18,
                background:
                  '#08111f'
              }}
            >
              <img
                src={fotoAmpliada.foto_url}
                alt={`Foto ${fotoAmpliada.indice || 1} anexada`}
                style={{
                  display:
                    'block',
                  maxWidth:
                    '100%',
                  maxHeight:
                    '72vh',
                  width:
                    'auto',
                  height:
                    'auto',
                  objectFit:
                    'contain',
                  borderRadius:
                    14
                }}
              />
            </div>
          </section>
        </div>
      )}
    </>
  )
}
