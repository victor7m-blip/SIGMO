import {
  supabase
} from './supabaseClient'

const TAMANHOS = [
  'P',
  'M',
  'G',
  'GG',
  'XG'
]

function normalizarTamanho(valor) {
  const tamanho =
    String(valor || '')
      .trim()
      .toUpperCase()

  if (
    !TAMANHOS.includes(
      tamanho
    )
  ) {
    throw new Error(
      'Tamanho de colete refletivo inválido.'
    )
  }

  return tamanho
}

function normalizarQuantidade(valor) {
  const quantidade =
    Number(valor)

  if (
    !Number.isInteger(
      quantidade
    ) ||
    quantidade <= 0
  ) {
    throw new Error(
      'Informe uma quantidade inteira maior que zero.'
    )
  }

  return quantidade
}

function normalizarUsuarioId(user) {
  return (
    user?.user_id ||
    user?.usuario_id ||
    null
  )
}

function normalizarUsuarioNome(user) {
  return (
    user?.nome_guerra ||
    user?.nome ||
    user?.name ||
    null
  )
}

function ordenarEstoque(lista) {
  const ordem =
    new Map(
      TAMANHOS.map(
        (tamanho, indice) => [
          tamanho,
          indice
        ]
      )
    )

  return [
    ...(Array.isArray(lista)
      ? lista
      : [])
  ].sort(
    (a, b) =>
      (ordem.get(
        String(
          a?.tamanho ||
          ''
        ).toUpperCase()
      ) ?? 99) -
      (ordem.get(
        String(
          b?.tamanho ||
          ''
        ).toUpperCase()
      ) ?? 99)
  )
}

export async function listarEstoqueColetesRefletivos() {
  const {
    data,
    error
  } =
    await supabase
      .from(
        'sigmo_coletes_refletivos'
      )
      .select(
        [
          'id',
          'tamanho',
          'quantidade_total',
          'quantidade_p4',
          'quantidade_svdd',
          'quantidade_em_servico',
          'quantidade_manutencao',
          'quantidade_manutencao_p4',
          'quantidade_baixada',
          'status_operacional',
          'local_atual',
          'observacoes',
          'ativo',
          'criado_em',
          'atualizado_em'
        ].join(', ')
      )
      .eq(
        'ativo',
        true
      )

  if (error) {
    throw error
  }

  return ordenarEstoque(
    data || []
  )
}

export async function registrarEntradaColeteRefletivoP4({
  tamanho,
  quantidade,
  observacoes = '',
  user
}) {
  const tamanhoNormalizado =
    normalizarTamanho(
      tamanho
    )

  const quantidadeNormalizada =
    normalizarQuantidade(
      quantidade
    )

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_colete_refletivo_entrada_p4',
    {
      p_tamanho:
        tamanhoNormalizado,

      p_quantidade:
        quantidadeNormalizada,

      p_usuario_id:
        normalizarUsuarioId(
          user
        ),

      p_usuario_nome:
        normalizarUsuarioNome(
          user
        ),

      p_observacoes:
        String(
          observacoes ||
          ''
        )
          .trim() ||
        null
    }
  )

  if (error) {
    throw new Error(
      error?.message ||
      'Não foi possível registrar a entrada de Colete Refletivo no P4.'
    )
  }

  return data
}


export async function listarHistoricoColetesRefletivos({
  limite = 100,
  tamanho = null
} = {}) {
  let consulta =
    supabase
      .from(
        'sigmo_coletes_refletivos_movimentacoes'
      )
      .select('*')
      .order(
        'criado_em',
        {
          ascending: false
        }
      )
      .limit(
        Number(limite) ||
        100
      )

  if (
    tamanho &&
    String(tamanho)
      .trim()
      .toUpperCase() !==
      'TODOS'
  ) {
    consulta =
      consulta.eq(
        'tamanho',
        normalizarTamanho(
          tamanho
        )
      )
  }

  const {
    data,
    error
  } =
    await consulta

  if (error) {
    throw error
  }

  return data || []
}

export async function listarTransferenciasPendentesColetesRefletivos({
  origem = null,
  destino = null
} = {}) {
  let consulta =
    supabase
      .from(
        'sigmo_coletes_refletivos_movimentacoes'
      )
      .select('*')
      .eq(
        'status',
        'PENDENTE_RECEBIMENTO'
      )
      .in(
        'tipo_movimentacao',
        [
          'TRANSFERENCIA_P4_SVDD',
          'TRANSFERENCIA_SVDD_P4'
        ]
      )
      .order(
        'criado_em',
        {
          ascending: false
        }
      )

  if (origem) {
    consulta =
      consulta.eq(
        'origem',
        String(origem)
          .trim()
          .toUpperCase()
      )
  }

  if (destino) {
    consulta =
      consulta.eq(
        'destino',
        String(destino)
          .trim()
          .toUpperCase()
      )
  }

  const {
    data,
    error
  } =
    await consulta

  if (error) {
    throw error
  }

  return data || []
}

export async function solicitarTransferenciaColeteRefletivo({
  tamanho,
  quantidade,
  origem,
  destino,
  user,
  observacoes = ''
}) {
  const {
    data,
    error
  } =
    await supabase.rpc(
      'sigmo_colete_refletivo_solicitar_transferencia',
      {
        p_tamanho:
          normalizarTamanho(
            tamanho
          ),

        p_quantidade:
          normalizarQuantidade(
            quantidade
          ),

        p_origem:
          String(origem || '')
            .trim()
            .toUpperCase(),

        p_destino:
          String(destino || '')
            .trim()
            .toUpperCase(),

        p_usuario_id:
          normalizarUsuarioId(
            user
          ),

        p_usuario_nome:
          normalizarUsuarioNome(
            user
          ),

        p_observacoes:
          String(
            observacoes ||
            ''
          )
            .trim()
            .toUpperCase() ||
          null
      }
    )

  if (error) {
    throw error
  }

  return data
}

export async function transferirColeteRefletivoParaSvdd({
  tamanho,
  quantidade,
  user,
  observacoes = ''
}) {
  return solicitarTransferenciaColeteRefletivo({
    tamanho,
    quantidade,
    origem: 'P4',
    destino: 'SVDD',
    user,
    observacoes
  })
}

export async function devolverColeteRefletivoAoP4({
  tamanho,
  quantidade,
  user,
  observacoes = ''
}) {
  return solicitarTransferenciaColeteRefletivo({
    tamanho,
    quantidade,
    origem: 'SVDD',
    destino: 'P4',
    user,
    observacoes
  })
}

export async function receberTransferenciaColeteRefletivo({
  movimentacaoId,
  user
}) {
  if (!movimentacaoId) {
    throw new Error(
      'Movimentação não identificada.'
    )
  }

  const {
    data,
    error
  } =
    await supabase.rpc(
      'sigmo_colete_refletivo_receber_transferencia',
      {
        p_movimentacao_id:
          movimentacaoId,

        p_usuario_id:
          normalizarUsuarioId(
            user
          ),

        p_usuario_nome:
          normalizarUsuarioNome(
            user
          )
      }
    )

  if (error) {
    throw error
  }

  return data
}

export async function cancelarTransferenciaColeteRefletivo({
  movimentacaoId,
  user,
  motivo = ''
}) {
  if (!movimentacaoId) {
    throw new Error(
      'Movimentação não identificada.'
    )
  }

  const motivoNormalizado =
    String(
      motivo ||
      ''
    )
      .trim()
      .toUpperCase()

  if (!motivoNormalizado) {
    throw new Error(
      'Informe o motivo do cancelamento.'
    )
  }

  const {
    data,
    error
  } =
    await supabase.rpc(
      'sigmo_colete_refletivo_cancelar_transferencia',
      {
        p_movimentacao_id:
          movimentacaoId,

        p_usuario_id:
          normalizarUsuarioId(
            user
          ),

        p_usuario_nome:
          normalizarUsuarioNome(
            user
          ),

        p_motivo:
          motivoNormalizado
      }
    )

  if (error) {
    throw error
  }

  return data
}


export async function listarManutencoesPendentesColeteRefletivoP4() {
  const {
    data,
    error
  } =
    await supabase
      .from(
        'sigmo_coletes_refletivos_movimentacoes'
      )
      .select('*')
      .eq(
        'tipo_movimentacao',
        'MANUTENCAO_SVDD_P4'
      )
      .eq(
        'status',
        'PENDENTE_RECEBIMENTO'
      )
      .order(
        'criado_em',
        {
          ascending: false
        }
      )

  if (error) {
    throw error
  }

  return data || []
}


export async function encaminharManutencaoColeteRefletivoAoP4({
  coleteRefletivoId,
  quantidade,
  user,
  observacoes = ''
}) {
  if (!coleteRefletivoId) {
    throw new Error(
      'Colete Refletivo não identificado.'
    )
  }

  const {
    data,
    error
  } =
    await supabase.rpc(
      'sigmo_colete_refletivo_encaminhar_manutencao_p4',
      {
        p_colete_refletivo_id:
          coleteRefletivoId,

        p_quantidade:
          normalizarQuantidade(
            quantidade
          ),

        p_usuario_id:
          normalizarUsuarioId(
            user
          ),

        p_usuario_nome:
          normalizarUsuarioNome(
            user
          ),

        p_observacoes:
          String(
            observacoes ||
            ''
          )
            .trim()
            .toUpperCase() ||
          null
      }
    )

  if (error) {
    throw new Error(
      error?.message ||
      'Não foi possível encaminhar o Colete Refletivo em manutenção ao P4.'
    )
  }

  return data
}


export async function receberManutencaoColeteRefletivoP4({
  movimentacaoId,
  user
}) {
  if (!movimentacaoId) {
    throw new Error(
      'Movimentação de manutenção não identificada.'
    )
  }

  const {
    data,
    error
  } =
    await supabase.rpc(
      'sigmo_colete_refletivo_receber_manutencao_p4',
      {
        p_movimentacao_id:
          movimentacaoId,

        p_usuario_id:
          normalizarUsuarioId(
            user
          ),

        p_usuario_nome:
          normalizarUsuarioNome(
            user
          )
      }
    )

  if (error) {
    throw new Error(
      error?.message ||
      'Não foi possível receber e baixar o Colete Refletivo danificado no P4.'
    )
  }

  return data
}


export async function cancelarEncaminhamentoManutencaoColeteRefletivo({
  movimentacaoId,
  user,
  motivo = ''
}) {
  if (!movimentacaoId) {
    throw new Error(
      'Movimentação de manutenção não identificada.'
    )
  }

  const motivoNormalizado =
    String(
      motivo ||
      ''
    )
      .trim()
      .toUpperCase()

  if (!motivoNormalizado) {
    throw new Error(
      'Informe o motivo do cancelamento.'
    )
  }

  const {
    data,
    error
  } =
    await supabase.rpc(
      'sigmo_colete_refletivo_cancelar_manutencao_p4',
      {
        p_movimentacao_id:
          movimentacaoId,

        p_usuario_id:
          normalizarUsuarioId(
            user
          ),

        p_usuario_nome:
          normalizarUsuarioNome(
            user
          ),

        p_motivo:
          motivoNormalizado
      }
    )

  if (error) {
    throw new Error(
      error?.message ||
      'Não foi possível cancelar o encaminhamento da manutenção ao P4.'
    )
  }

  return data
}

export async function colocarColeteRefletivoEmBaixadosP4({
  coleteRefletivoId,
  quantidade,
  user,
  observacoes = ''
}) {
  if (!coleteRefletivoId) {
    throw new Error(
      'Colete Refletivo não identificado.'
    )
  }

  const {
    data,
    error
  } =
    await supabase.rpc(
      'sigmo_colete_refletivo_colocar_baixado_p4',
      {
        p_colete_refletivo_id:
          coleteRefletivoId,

        p_quantidade:
          normalizarQuantidade(
            quantidade
          ),

        p_usuario_id:
          normalizarUsuarioId(
            user
          ),

        p_usuario_nome:
          normalizarUsuarioNome(
            user
          ),

        p_observacoes:
          String(
            observacoes ||
            ''
          )
            .trim()
            .toUpperCase() ||
          null
      }
    )

  if (error) {
    throw new Error(
      error?.message ||
      'Não foi possível colocar o Colete Refletivo em baixados.'
    )
  }

  return data
}


export async function descarregarColeteRefletivoP4({
  coleteRefletivoId,
  quantidade,
  user,
  observacoes = ''
}) {
  if (!coleteRefletivoId) {
    throw new Error(
      'Colete Refletivo não identificado.'
    )
  }

  const {
    data,
    error
  } =
    await supabase.rpc(
      'sigmo_colete_refletivo_descarga_p4',
      {
        p_colete_refletivo_id:
          coleteRefletivoId,

        p_quantidade:
          normalizarQuantidade(
            quantidade
          ),

        p_usuario_id:
          normalizarUsuarioId(
            user
          ),

        p_usuario_nome:
          normalizarUsuarioNome(
            user
          ),

        p_observacoes:
          String(
            observacoes ||
            ''
          )
            .trim()
            .toUpperCase() ||
          null
      }
    )

  if (error) {
    throw new Error(
      error?.message ||
      'Não foi possível concluir a descarga do Colete Refletivo.'
    )
  }

  return data
}


export {
  TAMANHOS
}
