import {
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  listarArmasCargaPessoal,
  solicitarDevolucaoCargaAoP4,
  solicitarDevolucaoColeteAoP4
} from '../../services/cargaPessoalService'

import {
  supabase
} from '../../services/supabaseClient'

import {
  registrarMovimentacao,
  TIPOS_MOVIMENTACAO
} from '../../services/patrimonioMovimentacaoService'

import {
  loadSessionToken
} from '../../services/authService'

import './CargaPessoal.css'

function texto(valor, fallback = 'Não informado') {
  const v = String(valor ?? '').trim()
  return v || fallback
}

function nomeArma(arma) {
  return [
    arma?.especie,
    arma?.marca,
    arma?.modelo,
    arma?.calibre
  ]
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .join(' ')
}


function formatarData(valor) {
  if (!valor) return 'Não informado'

  const data = new Date(
    `${String(valor).slice(0, 10)}T12:00:00`
  )

  if (Number.isNaN(data.getTime())) {
    return 'Não informado'
  }

  return data.toLocaleDateString('pt-BR')
}

function formatarModelagem(valor) {
  const v = String(valor || '')
    .trim()
    .toUpperCase()

  if (v === 'PADRAO') {
    return 'PADRÃO'
  }

  return v || 'Não informado'
}


async function listarMunicoesCargaPessoal(user) {
  const reBase =
    String(
      user?.re ||
      user?.policial_re ||
      ''
    )
      .replace(/\D/g, '')
      .slice(0, 6)

  if (reBase.length !== 6) {
    return []
  }

  const {
    data,
    error
  } = await supabase
    .from('sigmo_municoes_carga_permanente_policial')
    .select(
      'calibre, lote_id, numero_lote, fabricante, policial_id, policial_re, policial_nome, quantidade_em_posse, primeira_retirada, ultima_retirada, devolucao_prevista, municao_id'
    )
    .ilike(
      'policial_re',
      `${reBase}%`
    )
    .gt(
      'quantidade_em_posse',
      0
    )
    .order(
      'calibre',
      {
        ascending: true
      }
    )

  if (error) {
    throw error
  }

  return (data || [])
    .filter(
      (item) =>
        String(
          item?.policial_re ||
          ''
        )
          .replace(/\D/g, '')
          .slice(0, 6) ===
        reBase
    )
    .map(
      (item) => ({
        ...item,
        quantidade_em_posse:
          Number(
            item?.quantidade_em_posse ||
            0
          )
      })
    )
}

async function listarColetesCargaPessoal(user) {
  const policialId =
    user?.id ||
    user?.policial_id ||
    user?.id_policial ||
    null

  if (!policialId) {
    return []
  }

  const {
    data,
    error
  } = await supabase
    .from('sigmo_patrimonios')
    .select(
      'id, referencia_id, numero_patrimonio, numero_serie, status, local_atual, responsavel_atual_id, responsavel_atual_nome, dados'
    )
    .eq('tipo', 'colete_balistico')
    .eq('status', 'CARGA')
    .eq('local_atual', 'CARGA PERMANENTE')
    .eq('responsavel_atual_id', policialId)
    .eq('ativo', true)
    .order('numero_patrimonio', {
      ascending: true
    })

  if (error) {
    throw error
  }

  return (data || []).map((item) => {
    const dados =
      item?.dados &&
      typeof item.dados === 'object'
        ? item.dados
        : {}

    return {
      ...dados,
      patrimonio_id: item.id,
      referencia_id: item.referencia_id,
      patrimonio:
        item.numero_patrimonio ||
        dados.patrimonio ||
        null,
      numero_serie:
        item.numero_serie ||
        dados.numero_serie ||
        null,
      status:
        item.status ||
        dados.status ||
        'CARGA',
      local_atual:
        item.local_atual ||
        dados.local_atual ||
        'CARGA PERMANENTE',
      responsavel_atual_id:
        item.responsavel_atual_id ||
        null,
      responsavel_atual_nome:
        item.responsavel_atual_nome ||
        null
    }
  })
}


async function listarTasersCargaPessoal(user) {
  const policialId =
    user?.id ||
    user?.policial_id ||
    user?.id_policial ||
    null

  const reBase =
    String(
      user?.re ||
      user?.policial_re ||
      ''
    )
      .replace(/\D/g, '')
      .slice(0, 6)

  if (!policialId && reBase.length !== 6) {
    return []
  }

  /*
   * 1) Fonte principal: Engine Patrimonial corretamente vinculada
   *    ao policial por responsavel_atual_id.
   */
  let registrosDiretos = []

  if (policialId) {
    const {
      data,
      error
    } = await supabase
      .from('sigmo_patrimonios')
      .select(
        'id, referencia_id, numero_patrimonio, numero_serie, status, local_atual, responsavel_atual_id, responsavel_atual_nome, dados'
      )
      .eq('tipo', 'taser')
      .eq('status', 'CARGA')
      .eq('local_atual', 'CARGA PERMANENTE')
      .eq('responsavel_atual_id', policialId)
      .eq('ativo', true)
      .order(
        'numero_patrimonio',
        {
          ascending: true
        }
      )

    if (error) {
      throw error
    }

    registrosDiretos =
      data || []
  }

  /*
   * 2) Compatibilidade com cargas Taser já efetivadas antes da
   *    correção de responsavel_atual_id.
   *
   *    Só considera movimentação que:
   *    - é CARGA_PERMANENTE;
   *    - pertence ao TASER;
   *    - corresponde ao RE logado;
   *    - NÃO é uma solicitação nova aguardando aprovação do Cmt;
   *    - e cujo patrimônio já está, de fato, em CARGA PERMANENTE.
   */
  let idsPatrimonioLegado =
    []

  if (reBase.length === 6) {
    const {
      data: movimentos,
      error: movimentosError
    } = await supabase
      .from('sigmo_patrimonio_movimentacoes')
      .select(
        'id, patrimonio_id, status_movimentacao, tipo_movimentacao, recebedor_re, dados, metadata, created_at'
      )
      .eq(
        'tipo_movimentacao',
        'CARGA_PERMANENTE'
      )
      .eq(
        'status_movimentacao',
        'PENDENTE'
      )
      .ilike(
        'recebedor_re',
        `${reBase}%`
      )
      .order(
        'created_at',
        {
          ascending: false
        }
      )

    if (movimentosError) {
      throw movimentosError
    }

    idsPatrimonioLegado =
      (movimentos || [])
        .filter(
          (movimento) => {
            const dados =
              movimento?.dados ||
              movimento?.metadata?.dados_engine ||
              {}

            const modulo =
              String(
                dados?.modulo ||
                dados?.categoria ||
                ''
              )
                .trim()
                .toUpperCase()

            const exigeAprovacao =
              dados?.exige_aprovacao_cmt === true

            return (
              modulo === 'TASER' &&
              !exigeAprovacao
            )
          }
        )
        .map(
          (movimento) =>
            movimento?.patrimonio_id
        )
        .filter(Boolean)
  }

  let registrosLegado =
    []

  if (idsPatrimonioLegado.length > 0) {
    const idsDiretos =
      new Set(
        registrosDiretos.map(
          (item) =>
            String(item.id)
        )
      )

    const idsFaltantes =
      [
        ...new Set(
          idsPatrimonioLegado.map(String)
        )
      ]
        .filter(
          (id) =>
            !idsDiretos.has(id)
        )

    if (idsFaltantes.length > 0) {
      const {
        data,
        error
      } = await supabase
        .from('sigmo_patrimonios')
        .select(
          'id, referencia_id, numero_patrimonio, numero_serie, status, local_atual, responsavel_atual_id, responsavel_atual_nome, dados'
        )
        .in(
          'id',
          idsFaltantes
        )
        .eq(
          'tipo',
          'taser'
        )
        .eq(
          'status',
          'CARGA'
        )
        .eq(
          'local_atual',
          'CARGA PERMANENTE'
        )
        .eq(
          'ativo',
          true
        )

      if (error) {
        throw error
      }

      registrosLegado =
        data || []
    }
  }

  const registros =
    [
      ...registrosDiretos,
      ...registrosLegado
    ]

  if (registros.length === 0) {
    return []
  }

  const referencias =
    registros
      .map(
        (item) =>
          item?.referencia_id
      )
      .filter(Boolean)

  let tasersPorId =
    new Map()

  if (referencias.length > 0) {
    const {
      data: tasers,
      error: tasersError
    } = await supabase
      .from('sigmo_tasers')
      .select(
        'id, patrimonio, numero_serie, marca, modelo, tipo_taser, unidade, foto_url'
      )
      .in(
        'id',
        referencias
      )

    if (tasersError) {
      throw tasersError
    }

    tasersPorId =
      new Map(
        (tasers || []).map(
          (item) => [
            String(item.id),
            item
          ]
        )
      )
  }

  return registros.map(
    (item) => {
      const dados =
        item?.dados &&
        typeof item.dados === 'object'
          ? item.dados
          : {}

      const taser =
        tasersPorId.get(
          String(
            item?.referencia_id ||
            ''
          )
        ) || {}

      return {
        ...dados,
        ...taser,

        patrimonio_id:
          item.id,

        referencia_id:
          item.referencia_id,

        patrimonio:
          item.numero_patrimonio ||
          taser.patrimonio ||
          dados.patrimonio ||
          item.numero_serie ||
          taser.numero_serie ||
          null,

        numero_serie:
          item.numero_serie ||
          taser.numero_serie ||
          dados.numero_serie ||
          null,

        marca:
          taser.marca ||
          dados.marca ||
          null,

        modelo:
          taser.modelo ||
          dados.modelo ||
          null,

        tipo_taser:
          taser.tipo_taser ||
          dados.tipo_taser ||
          null,

        status:
          item.status ||
          dados.status ||
          'CARGA',

        local_atual:
          item.local_atual ||
          dados.local_atual ||
          'CARGA PERMANENTE',

        responsavel_atual_id:
          item.responsavel_atual_id ||
          policialId ||
          null,

        responsavel_atual_nome:
          item.responsavel_atual_nome ||
          dados.equipe_vinculada ||
          user?.nome_guerra ||
          user?.nome ||
          user?.nome_completo ||
          null,

        responsavel_re:
          dados.responsavel_re ||
          dados.carga_policial_re ||
          reBase ||
          null
      }
    }
  )
}


async function solicitarDevolucaoTaserAoP4({
  taser,
  user
}) {
  const patrimonioId =
    taser?.patrimonio_id ||
    null

  if (!patrimonioId) {
    throw new Error(
      'Patrimônio central da Taser não localizado.'
    )
  }

  const {
    data: pendencias,
    error: pendenciasError
  } = await supabase
    .from(
      'sigmo_patrimonio_movimentacoes'
    )
    .select(
      'id, tipo_movimentacao, status_movimentacao, dados, metadata'
    )
    .eq(
      'patrimonio_id',
      patrimonioId
    )
    .eq(
      'status_movimentacao',
      'PENDENTE'
    )

  if (pendenciasError) {
    throw pendenciasError
  }

  const jaExisteDevolucao =
    (pendencias || []).some(
      (item) => {
        const dados =
          item?.dados ||
          item?.metadata?.dados_engine ||
          {}

        const modulo =
          String(
            dados?.modulo ||
            dados?.categoria ||
            ''
          )
            .trim()
            .toUpperCase()

        const tipoOperacao =
          String(
            dados?.tipo_operacao_taser ||
            ''
          )
            .trim()
            .toUpperCase()

        return (
          modulo === 'TASER' &&
          tipoOperacao === 'DEVOLUCAO_CARGA_P4'
        )
      }
    )

  if (jaExisteDevolucao) {
    throw new Error(
      'Esta Taser já possui uma devolução pendente para o P4.'
    )
  }

  const reBase =
    String(
      user?.re ||
      user?.policial_re ||
      taser?.responsavel_re ||
      ''
    )
      .replace(/\D/g, '')
      .slice(0, 6)

  const nomeUsuario =
    user?.nome_guerra ||
    user?.nome ||
    user?.nome_completo ||
    taser?.responsavel_atual_nome ||
    'POLICIAL'

  const usuarioId =
    user?.id ||
    user?.policial_id ||
    user?.id_policial ||
    taser?.responsavel_atual_id ||
    null

  /*
   * registrarMovimentacao atualiza o patrimônio imediatamente.
   * Para uma devolução pendente isso não pode acontecer.
   * Então registramos a intenção e restauramos a guarda atual
   * até o P4 confirmar fisicamente o recebimento.
   */
  const resultado =
    await registrarMovimentacao({
      patrimonioId,

      tipo:
        TIPOS_MOVIMENTACAO.TRANSFERENCIA,

      statusNovo:
        'RESERVA',

      localDestino:
        'COFRE DO P4',

      companhiaDestino:
        taser?.unidade ||
        '5ª CIA',

      motivo:
        'DEVOLUCAO_CARGA_PERMANENTE',

      observacao:
        `Devolução de Taser ${taser?.numero_serie || taser?.patrimonio || ''} solicitada pelo policial.`,

      dados: {
        modulo:
          'TASER',

        categoria:
          'TASER',

        taser_id:
          taser?.referencia_id ||
          taser?.id ||
          null,

        referencia_id:
          taser?.referencia_id ||
          taser?.id ||
          null,

        patrimonio:
          taser?.patrimonio ||
          null,

        numero_serie:
          taser?.numero_serie ||
          null,

        marca:
          taser?.marca ||
          null,

        modelo:
          taser?.modelo ||
          null,

        quantidade:
          1,

        status_movimentacao:
          'PENDENTE',

        tipo_operacao_taser:
          'DEVOLUCAO_CARGA_P4',

        origem_codigo:
          reBase ||
          usuarioId ||
          'POLICIAL',

        origem_nome:
          nomeUsuario,

        destino_codigo:
          'P4',

        destino_nome:
          'COFRE DO P4',

        local_origem:
          'CARGA PERMANENTE',

        local_destino:
          'COFRE DO P4',

        policial_id:
          usuarioId,

        policial_re:
          reBase ||
          null,

        policial_nome:
          nomeUsuario,

        guardiao_origem: {
          tipo:
            'POLICIAL',

          id:
            usuarioId,

          codigo:
            reBase ||
            usuarioId ||
            'POLICIAL',

          nome:
            nomeUsuario,

          re:
            reBase ||
            null
        },

        guardiao_destino: {
          tipo:
            'SETOR',

          id:
            null,

          codigo:
            'P4',

          nome:
            'COFRE DO P4',

          re:
            null
        }
      },

      user
    })

  /*
   * Mantém a carga ativa até o recebimento físico pelo P4.
   */
  const {
    data: patrimonioAtual,
    error: patrimonioBuscaError
  } = await supabase
    .from(
      'sigmo_patrimonios'
    )
    .select(
      'dados'
    )
    .eq(
      'id',
      patrimonioId
    )
    .single()

  if (patrimonioBuscaError) {
    throw patrimonioBuscaError
  }

  const dadosPatrimonio =
    patrimonioAtual?.dados &&
    typeof patrimonioAtual.dados === 'object'
      ? patrimonioAtual.dados
      : {}

  const {
    error: restaurarError
  } = await supabase
    .from(
      'sigmo_patrimonios'
    )
    .update({
      status:
        'CARGA',

      local_atual:
        'CARGA PERMANENTE',

      responsavel_atual_id:
        usuarioId,

      responsavel_atual_nome:
        nomeUsuario,

      dados: {
        ...dadosPatrimonio,

        carga_policial_re:
          reBase ||
          null,

        carga_policial_nome:
          nomeUsuario,

        devolucao_taser_pendente:
          true,

        devolucao_taser_movimentacao_id:
          resultado?.movimentacao?.id ||
          null
      },

      updated_at:
        new Date().toISOString()
    })
    .eq(
      'id',
      patrimonioId
    )

  if (restaurarError) {
    throw restaurarError
  }

  return resultado?.movimentacao || null
}

export default function CargaPessoal({
  user
}) {
  const [armas, setArmas] = useState([])
  const [coletes, setColetes] = useState([])
  const [municoes, setMunicoes] = useState([])
  const [tasers, setTasers] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [devolvendoId, setDevolvendoId] = useState(null)

  async function carregar() {
    try {
      setLoading(true)
      setErro('')

      const [
        listaArmas,
        listaColetes,
        listaMunicoes,
        listaTasers
      ] = await Promise.all([
        listarArmasCargaPessoal(user),
        listarColetesCargaPessoal(user),
        listarMunicoesCargaPessoal(user),
        listarTasersCargaPessoal(user)
      ])

      setArmas(listaArmas || [])
      setColetes(listaColetes || [])
      setMunicoes(listaMunicoes || [])
      setTasers(listaTasers || [])
    } catch (error) {
      console.error(
        'Erro ao carregar carga pessoal:',
        error
      )

      setArmas([])
      setColetes([])
      setMunicoes([])
      setTasers([])
      setErro(
        error?.message ||
        'Não foi possível carregar sua carga pessoal.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [user])

  const nomeUsuario = useMemo(
    () =>
      user?.nome_guerra ||
      user?.nome ||
      user?.nome_completo ||
      'Policial',
    [user]
  )

  async function devolverAoP4(arma) {
    const identificacao =
      arma?.numero_serie ||
      arma?.patrimonio ||
      'esta arma'

    const confirmou = window.confirm(
      `Confirma a devolução de ${identificacao} ao P4?\n\nA arma continuará vinculada à sua carga até a movimentação ser recebida pelo P4.`
    )

    if (!confirmou) return

    try {
      setDevolvendoId(arma.id)
      setErro('')
      setMensagem('')

      await solicitarDevolucaoCargaAoP4({
        arma,
        user
      })

      setMensagem(
        'Devolução enviada ao P4. A arma permanecerá na sua carga até o recebimento ser confirmado.'
      )
    } catch (error) {
      console.error(
        'Erro ao solicitar devolução ao P4:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível solicitar a devolução ao P4.'
      )
    } finally {
      setDevolvendoId(null)
    }
  }



  async function devolverMunicaoAoP4(municao) {
    const quantidade =
      Math.max(
        0,
        Math.trunc(
          Number(
            municao?.quantidade_em_posse ||
            0
          )
        )
      )

    if (quantidade <= 0) {
      setErro(
        'Não há munição disponível para devolução.'
      )
      return
    }

    const confirmou = window.confirm(
      `Confirma a devolução de ${quantidade} unidade(s) de ${texto(
        municao?.calibre,
        'munição'
      )} ao P4?\n\nA carga continuará vinculada a você até o recebimento ser confirmado.`
    )

    if (!confirmou) return

    const idDevolucao =
      `MUNICAO-${municao?.lote_id || municao?.calibre || 'CARGA'}`

    try {
      setDevolvendoId(idDevolucao)
      setErro('')
      setMensagem('')

      const token =
        loadSessionToken()

      if (!token) {
        throw new Error(
          'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
        )
      }

      const municaoId =
        municao?.municao_id ||
        null

      if (!municaoId) {
        throw new Error(
          'Não foi possível identificar a munição para devolução.'
        )
      }

      const {
        error
      } = await supabase.rpc(
        'sigmo_municoes_solicitar_devolucao',
        {
          p_token:
            token,

          p_municao_id:
            municaoId,

          p_quantidade:
            quantidade,

          p_observacoes:
            'DEVOLUÇÃO DE CARGA PERMANENTE AO P4'
        }
      )

      if (error) {
        throw error
      }

      setMensagem(
        `Devolução de ${quantidade} unidade(s) de ${texto(
          municao?.calibre,
          'munição'
        )} solicitada com sucesso. A carga permanecerá vinculada até o recebimento ser confirmado.`
      )

      await carregar()
    } catch (error) {
      console.error(
        'Erro ao solicitar devolução da munição:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível solicitar a devolução da munição.'
      )
    } finally {
      setDevolvendoId(null)
    }
  }


  async function devolverTaserAoP4(taser) {
    const identificacao =
      taser?.patrimonio ||
      taser?.numero_serie ||
      'esta Taser'

    const confirmou =
      window.confirm(
        `Confirma a devolução de ${identificacao} ao P4?\n\nA Taser continuará vinculada à sua carga até o P4 confirmar o recebimento físico.`
      )

    if (!confirmou) {
      return
    }

    const idDevolucao =
      `TASER-${taser?.patrimonio_id || taser?.referencia_id || taser?.numero_serie || 'CARGA'}`

    try {
      setDevolvendoId(
        idDevolucao
      )

      setErro('')
      setMensagem('')

      await solicitarDevolucaoTaserAoP4({
        taser,
        user
      })

      setMensagem(
        'Devolução da Taser enviada ao P4. O equipamento continuará na sua carga até o recebimento ser confirmado.'
      )

      await carregar()
    } catch (error) {
      console.error(
        'Erro ao solicitar devolução da Taser ao P4:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível solicitar a devolução da Taser ao P4.'
      )
    } finally {
      setDevolvendoId(
        null
      )
    }
  }


  async function devolverColeteAoP4(colete) {
    const identificacao =
      colete?.patrimonio ||
      colete?.numero_serie ||
      'este colete'

    const confirmou = window.confirm(
      `Confirma a devolução de ${identificacao} ao P4?\n\nO colete continuará vinculado à sua carga até a movimentação ser recebida pelo P4.`
    )

    if (!confirmou) return

    const idDevolucao =
      colete?.patrimonio_id ||
      colete?.referencia_id ||
      colete?.patrimonio

    try {
      setDevolvendoId(idDevolucao)
      setErro('')
      setMensagem('')

      await solicitarDevolucaoColeteAoP4({
        colete,
        user
      })

      setMensagem(
        'Devolução do colete enviada ao P4. O material permanecerá na sua carga até o recebimento ser confirmado.'
      )
    } catch (error) {
      console.error(
        'Erro ao solicitar devolução do colete ao P4:',
        error
      )

      setErro(
        error?.message ||
        'Não foi possível solicitar a devolução do colete ao P4.'
      )
    } finally {
      setDevolvendoId(null)
    }
  }

  return (
    <main className="carga-pessoal-page">
      <header className="carga-pessoal-header">
        <div>
          <span>CARGA PESSOAL</span>
          <h1>Materiais vinculados a você</h1>
          <p>
            Consulte equipamentos de carga permanente
            vinculados ao seu cadastro funcional.
          </p>
        </div>

        <div className="carga-pessoal-user">
          <small>RESPONSÁVEL</small>
          <strong>{nomeUsuario}</strong>
          {user?.re && (
            <span>RE {user.re}</span>
          )}
        </div>
      </header>

      <section className="carga-pessoal-resumo">
        <article>
          <span>Armas em carga</span>
          <strong>{armas.length}</strong>
          <small>Carga permanente ativa</small>
        </article>

        <article>
          <span>Outros equipamentos</span>
          <strong>
            {coletes.length + tasers.length}
          </strong>
          <small>
            Coletes balísticos e Tasers em carga
          </small>
        </article>

        <article>
          <span>Munições em carga</span>
          <strong>
            {municoes.reduce(
              (total, item) =>
                total +
                Number(
                  item?.quantidade_em_posse ||
                  0
                ),
              0
            )}
          </strong>
          <small>Carga permanente ativa</small>
        </article>

        <article>
          <span>Tasers em carga</span>
          <strong>{tasers.length}</strong>
          <small>Carga permanente ativa</small>
        </article>

        <article>
          <span>Fardamento</span>
          <strong>—</strong>
          <small>
            Histórico de entrega será integrado depois
          </small>
        </article>
      </section>

      {erro && (
        <div className="carga-pessoal-erro">
          {erro}
        </div>
      )}

      {mensagem && (
        <div className="carga-pessoal-sucesso">
          {mensagem}
        </div>
      )}

      <section className="carga-pessoal-painel">
        <div className="carga-pessoal-painel-titulo">
          <div>
            <span>ARMAS</span>
            <h2>Carga permanente</h2>
          </div>

          <button
            type="button"
            onClick={carregar}
            disabled={loading}
          >
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>

        {loading ? (
          <div className="carga-pessoal-vazio">
            Carregando sua carga pessoal...
          </div>
        ) : armas.length === 0 ? (
          <div className="carga-pessoal-vazio">
            Nenhuma arma em carga permanente vinculada
            ao seu cadastro.
          </div>
        ) : (
          <div className="carga-pessoal-grid">
            {armas.map((arma) => (
              <article
                className="carga-pessoal-card"
                key={arma.id}
              >
                <div className="carga-pessoal-card-topo">
                  <div className="carga-pessoal-icone">
                    ▰
                  </div>

                  <div>
                    <span>
                      {texto(arma.especie, 'ARMA')}
                    </span>
                    <h3>
                      {nomeArma(arma) || 'Arma'}
                    </h3>
                  </div>

                  <b>CARGA</b>
                </div>

                <dl>
                  <div>
                    <dt>Patrimônio</dt>
                    <dd>
                      {texto(
                        arma.patrimonio,
                        arma.numero_serie
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Nº de série</dt>
                    <dd>
                      {texto(arma.numero_serie)}
                    </dd>
                  </div>

                  <div>
                    <dt>Acabamento</dt>
                    <dd>
                      {texto(arma.acabamento)}
                    </dd>
                  </div>

                  <div>
                    <dt>Situação</dt>
                    <dd>CARGA PERMANENTE</dd>
                  </div>
                </dl>

                <footer className="carga-pessoal-card-footer">
                  <span>
                    Este item permanece bloqueado para
                    edição enquanto estiver em carga.
                  </span>

                  <button
                    type="button"
                    className="carga-pessoal-devolver"
                    onClick={() => devolverAoP4(arma)}
                    disabled={devolvendoId === arma.id}
                  >
                    {devolvendoId === arma.id
                      ? 'Enviando...'
                      : 'Devolver ao P4'}
                  </button>
                </footer>
              </article>
            ))}
          </div>
        )}

      <section className="carga-pessoal-painel">
        <div className="carga-pessoal-painel-titulo">
          <div>
            <span>MUNIÇÕES</span>
            <h2>Carga permanente</h2>
          </div>

          <button
            type="button"
            onClick={carregar}
            disabled={loading}
          >
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>

        {loading ? (
          <div className="carga-pessoal-vazio">
            Carregando munições...
          </div>
        ) : municoes.length === 0 ? (
          <div className="carga-pessoal-vazio">
            Nenhuma munição em carga permanente vinculada
            ao seu RE.
          </div>
        ) : (
          <div className="carga-pessoal-grid">
            {municoes.map((municao) => (
              <article
                className="carga-pessoal-card"
                key={
                  `${municao.lote_id || 'SEM-LOTE'}-${municao.calibre}`
                }
              >
                <div className="carga-pessoal-card-topo">
                  <div className="carga-pessoal-icone">
                    ▥
                  </div>

                  <div>
                    <span>MUNIÇÃO</span>
                    <h3>
                      {texto(
                        municao.calibre,
                        'Calibre não informado'
                      )}
                    </h3>
                  </div>

                  <b>CARGA</b>
                </div>

                <dl>
                  <div>
                    <dt>Quantidade</dt>
                    <dd>
                      {Number(
                        municao.quantidade_em_posse ||
                        0
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Lote</dt>
                    <dd>
                      {texto(
                        municao.numero_lote
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Fabricante</dt>
                    <dd>
                      {texto(
                        municao.fabricante
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>RE vinculado</dt>
                    <dd>
                      {texto(
                        municao.policial_re
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Primeira retirada</dt>
                    <dd>
                      {formatarData(
                        municao.primeira_retirada
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Situação</dt>
                    <dd>
                      CARGA PERMANENTE
                    </dd>
                  </div>
                </dl>

                <footer className="carga-pessoal-card-footer">
                  <span>
                    Munição vinculada à sua carga permanente
                    pelo P4.
                  </span>

                  <button
                    type="button"
                    className="carga-pessoal-devolver"
                    onClick={() =>
                      devolverMunicaoAoP4(
                        municao
                      )
                    }
                    disabled={
                      devolvendoId ===
                      `MUNICAO-${municao?.lote_id || municao?.calibre || 'CARGA'}`
                    }
                  >
                    {devolvendoId ===
                    `MUNICAO-${municao?.lote_id || municao?.calibre || 'CARGA'}`
                      ? 'Enviando...'
                      : 'Devolver ao P4'}
                  </button>
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="carga-pessoal-painel">
        <div className="carga-pessoal-painel-titulo">
          <div>
            <span>TASER</span>
            <h2>Carga permanente</h2>
          </div>

          <button
            type="button"
            onClick={carregar}
            disabled={loading}
          >
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>

        {loading ? (
          <div className="carga-pessoal-vazio">
            Carregando Tasers...
          </div>
        ) : tasers.length === 0 ? (
          <div className="carga-pessoal-vazio">
            Nenhum Taser em carga permanente vinculado
            ao seu cadastro.
          </div>
        ) : (
          <div className="carga-pessoal-grid">
            {tasers.map((taser) => (
              <article
                className="carga-pessoal-card"
                key={
                  taser.patrimonio_id ||
                  taser.referencia_id ||
                  taser.patrimonio
                }
              >
                <div className="carga-pessoal-card-topo">
                  <div className="carga-pessoal-icone">
                    ⚡
                  </div>

                  <div>
                    <span>TASER</span>

                    <h3>
                      {[
                        texto(
                          taser.marca,
                          ''
                        ),
                        texto(
                          taser.modelo,
                          ''
                        )
                      ]
                        .filter(Boolean)
                        .join(' ') ||
                        'Taser'}
                    </h3>
                  </div>

                  <b>CARGA</b>
                </div>

                <dl>
                  <div>
                    <dt>Patrimônio</dt>
                    <dd>
                      {texto(
                        taser.patrimonio,
                        taser.numero_serie
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Nº de série</dt>
                    <dd>
                      {texto(
                        taser.numero_serie
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Marca</dt>
                    <dd>
                      {texto(
                        taser.marca
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Modelo</dt>
                    <dd>
                      {texto(
                        taser.modelo
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Situação</dt>
                    <dd>
                      CARGA PERMANENTE
                    </dd>
                  </div>
                </dl>

                <footer className="carga-pessoal-card-footer">
                  <span>
                    Taser vinculado à sua carga permanente pelo P4.
                  </span>

                  <button
                    type="button"
                    className="carga-pessoal-devolver"
                    onClick={() =>
                      devolverTaserAoP4(
                        taser
                      )
                    }
                    disabled={
                      devolvendoId ===
                      `TASER-${taser?.patrimonio_id || taser?.referencia_id || taser?.numero_serie || 'CARGA'}`
                    }
                  >
                    {devolvendoId ===
                    `TASER-${taser?.patrimonio_id || taser?.referencia_id || taser?.numero_serie || 'CARGA'}`
                      ? 'Enviando...'
                      : 'Devolver ao P4'}
                  </button>
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="carga-pessoal-painel">
        <div className="carga-pessoal-painel-titulo">
          <div>
            <span>COLETE BALÍSTICO</span>
            <h2>Carga permanente</h2>
          </div>

          <button
            type="button"
            onClick={carregar}
            disabled={loading}
          >
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>

        {loading ? (
          <div className="carga-pessoal-vazio">
            Carregando coletes...
          </div>
        ) : coletes.length === 0 ? (
          <div className="carga-pessoal-vazio">
            Nenhum colete balístico em carga permanente
            vinculado ao seu cadastro.
          </div>
        ) : (
          <div className="carga-pessoal-grid">
            {coletes.map((colete) => (
              <article
                className="carga-pessoal-card"
                key={
                  colete.patrimonio_id ||
                  colete.referencia_id ||
                  colete.patrimonio
                }
              >
                <div className="carga-pessoal-card-topo">
                  <div className="carga-pessoal-icone">
                    🦺
                  </div>

                  <div>
                    <span>
                      COLETE BALÍSTICO
                    </span>

                    <h3>
                      {[
                        texto(
                          colete.fabricante,
                          ''
                        ),
                        texto(
                          colete.nivel_protecao,
                          ''
                        )
                      ]
                        .filter(Boolean)
                        .join(' ') ||
                        'Colete balístico'}
                    </h3>
                  </div>

                  <b>CARGA</b>
                </div>

                <dl>
                  <div>
                    <dt>Patrimônio</dt>
                    <dd>
                      {texto(
                        colete.patrimonio
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Nº de série</dt>
                    <dd>
                      {texto(
                        colete.numero_serie
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Lote</dt>
                    <dd>
                      {texto(
                        colete.numero_lote
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Sexo</dt>
                    <dd>
                      {texto(
                        colete.sexo
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Tamanho</dt>
                    <dd>
                      {[
                        texto(
                          colete.tamanho,
                          ''
                        ),
                        formatarModelagem(
                          colete.modelagem
                        )
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </dd>
                  </div>

                  <div>
                    <dt>Nível</dt>
                    <dd>
                      {texto(
                        colete.nivel_protecao
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Validade</dt>
                    <dd>
                      {formatarData(
                        colete.validade
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Situação</dt>
                    <dd>
                      CARGA PERMANENTE
                    </dd>
                  </div>
                </dl>

                <footer className="carga-pessoal-card-footer">
                  <span>
                    Colete balístico vinculado à sua carga
                    individual pelo P4.
                  </span>

                  <button
                    type="button"
                    className="carga-pessoal-devolver"
                    onClick={() =>
                      devolverColeteAoP4(colete)
                    }
                    disabled={
                      devolvendoId ===
                      (
                        colete?.patrimonio_id ||
                        colete?.referencia_id ||
                        colete?.patrimonio
                      )
                    }
                  >
                    {devolvendoId ===
                    (
                      colete?.patrimonio_id ||
                      colete?.referencia_id ||
                      colete?.patrimonio
                    )
                      ? 'Enviando...'
                      : 'Devolver ao P4'}
                  </button>
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>
      </section>
    </main>
  )
}
