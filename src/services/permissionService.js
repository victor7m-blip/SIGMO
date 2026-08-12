export const PERFIS = {
  ADMINISTRADOR: 'ADMINISTRADOR',
  P4: 'P4',
  COMANDANTE_CIA: 'COMANDANTE DE CIA',
  ENCARREGADO_SVDD: 'ENCARREGADO DO SVDD',
  AUXILIAR_SVDD: 'AUXILIAR DO SVDD',
  USUARIO: 'USUÁRIO',
  USUARIO_EXTERNO: 'USUARIO EXTERNO'
}

export const ROTAS = {
  DASHBOARD: 'dashboard',
  CENTRAL_OPERACIONAL: 'central-operacional',
  MANUTENCOES: 'manutencoes',
  PAGAR_MATERIAL: 'pagar-material',
  RECEBER_MATERIAL: 'receber-material',
  DEVOLVER_MATERIAL: 'devolver-material',
  TRANSFERIR_MATERIAL: 'transferir-material',
  BAIXAR_MATERIAL: 'baixar-material',
  MATERIAIS: 'materiais',
  POLICIAIS: 'policiais',
  CARGA_PESSOAL: 'carga-pessoal',
  ARMAS: 'armas',
  TPD: 'tpd',
  HT: 'ht',
  TASERS: 'tasers',
  TONFAS: 'tonfas',
  MUNICOES: 'municoes',
  LOCAIS: 'locais',
  VIATURAS: 'viaturas',
  RELATORIOS: 'relatorios',
  ALERTAS: 'alertas',
  AUDITORIA: 'auditoria',
  DIAGNOSTICO: 'diagnostico',
  SOLICITACOES_CADASTRAIS:
    'solicitacoes-cadastrais',
  EXPORTACAO_BACKUP:
    'exportacao-backup',
  CONFIGURACOES: 'configuracoes'
}

function removerAcentos(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function normalizarPerfil(perfil) {
  const valor = removerAcentos(perfil)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')

  const aliases = {
    ADMINISTRADOR: PERFIS.ADMINISTRADOR,
    ADMIN: PERFIS.ADMINISTRADOR,

    P4: PERFIS.P4,
    'SECAO P4': PERFIS.P4,
    'SEÇÃO P4': PERFIS.P4,
    'GESTOR PATRIMONIAL': PERFIS.P4,

    'COMANDANTE DE CIA':
      PERFIS.COMANDANTE_CIA,
    'COMANDANTE DA CIA':
      PERFIS.COMANDANTE_CIA,
    COMANDANTE:
      PERFIS.COMANDANTE_CIA,

    'ENCARREGADO DO SVDD':
      PERFIS.ENCARREGADO_SVDD,
    'ENCARREGADO SVDD':
      PERFIS.ENCARREGADO_SVDD,
    'SVDD ENCARREGADO':
      PERFIS.ENCARREGADO_SVDD,
    'ENCARREGADO DO SERVICO DE DIA':
      PERFIS.ENCARREGADO_SVDD,

    'AUXILIAR DO SVDD':
      PERFIS.AUXILIAR_SVDD,
    'AUXILIAR SVDD':
      PERFIS.AUXILIAR_SVDD,

    USUARIO:
      PERFIS.USUARIO,
    OPERADOR:
      PERFIS.USUARIO,
    'USUARIO EXTERNO': PERFIS.USUARIO_EXTERNO,
    'USUÁRIO EXTERNO': PERFIS.USUARIO_EXTERNO
  }

  return aliases[valor] || valor
}

function dataValida(valor) {
  if (!valor) return null

  const data = new Date(valor)

  if (
    Number.isNaN(
      data.getTime()
    )
  ) {
    return null
  }

  return data
}

export function possuiPerfilTemporarioAtivo(
  user,
  agora = new Date()
) {
  if (!user) return false

  const ativo =
    user?.perfil_temporario_ativo === true ||
    user?.permissao_temporaria_ativa === true

  if (!ativo) return false

  const inicio = dataValida(
    user?.perfil_temporario_inicio ||
    user?.permissao_temporaria_inicio
  )

  const fim = dataValida(
    user?.perfil_temporario_fim ||
    user?.permissao_temporaria_fim
  )

  if (!fim) return false

  if (
    inicio &&
    agora < inicio
  ) {
    return false
  }

  return agora < fim
}

export function obterPerfilEfetivo(user) {
  if (!user) {
    return PERFIS.USUARIO
  }

  if (
    possuiPerfilTemporarioAtivo(user)
  ) {
    return normalizarPerfil(
      user?.perfil_temporario ||
      user?.permissao_temporaria_perfil
    )
  }

  return normalizarPerfil(
    user?.perfil_efetivo ||
    user?.perfil ||
    user?.funcao ||
    PERFIS.USUARIO
  )
}

export function perfilEh(
  user,
  ...perfis
) {
  const perfilEfetivo =
    obterPerfilEfetivo(user)

  return perfis
    .map(normalizarPerfil)
    .includes(perfilEfetivo)
}

export function ehAdministrador(user) {
  return perfilEh(
    user,
    PERFIS.ADMINISTRADOR
  )
}

export function ehP4(user) {
  return perfilEh(
    user,
    PERFIS.P4
  )
}

export function ehComandante(user) {
  return perfilEh(
    user,
    PERFIS.COMANDANTE_CIA
  )
}

export function ehEncarregado(user) {
  return perfilEh(
    user,
    PERFIS.ENCARREGADO_SVDD
  )
}

export function ehAuxiliar(user) {
  return perfilEh(
    user,
    PERFIS.AUXILIAR_SVDD
  )
}

export function ehUsuarioExterno(user) {
  return perfilEh(user, PERFIS.USUARIO_EXTERNO)
}

export function ehUsuario(user) {
  return perfilEh(
    user,
    PERFIS.USUARIO,
    PERFIS.USUARIO_EXTERNO
  )
}

export function possuiAdministracaoCia(
  user
) {
  return perfilEh(
    user,
    PERFIS.ADMINISTRADOR,
    PERFIS.COMANDANTE_CIA,
    PERFIS.ENCARREGADO_SVDD
  )
}

const GRADUACOES_SARGENTO_OU_SUPERIOR = [
  '3 SGT PM',
  '3 SARGENTO',
  '2 SGT PM',
  '2 SARGENTO',
  '1 SGT PM',
  '1 SARGENTO',
  'SUBTEN PM',
  'SUBTENENTE PM',
  'SUBTENENTE',
  'ASP OF PM',
  'ASPIRANTE A OFICIAL PM',
  'ASPIRANTE',
  '2 TEN PM',
  '2 TENENTE PM',
  '1 TEN PM',
  '1 TENENTE PM',
  'CAP PM',
  'CAPITAO PM',
  'MAJ PM',
  'MAJOR PM',
  'TEN CEL PM',
  'TENENTE CORONEL PM',
  'CEL PM',
  'CORONEL PM'
]

function normalizarPostoGraduacao(valor) {
  return removerAcentos(valor)
    .trim()
    .toUpperCase()
    .replace(/[º°]/g, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
}

export function possuiGraduacaoSargentoOuSuperior(user) {
  const graduacao = normalizarPostoGraduacao(
    user?.posto_graduacao ||
    user?.postoGraduacao ||
    user?.graduacao ||
    ''
  )

  return GRADUACOES_SARGENTO_OU_SUPERIOR.includes(
    graduacao
  )
}

export function podeGerenciarSolicitacoesCadastrais(user) {
  return perfilEh(
    user,
    PERFIS.ADMINISTRADOR,
    PERFIS.COMANDANTE_CIA,
    PERFIS.ENCARREGADO_SVDD
  )
}

export function podeAcessarRecuperacaoPin(user) {
  if (!user || ehAuxiliar(user)) {
    return false
  }

  return (
    perfilEh(
      user,
      PERFIS.ADMINISTRADOR,
      PERFIS.P4,
      PERFIS.COMANDANTE_CIA,
      PERFIS.ENCARREGADO_SVDD
    ) ||
    possuiGraduacaoSargentoOuSuperior(user)
  )
}

const ROTAS_USUARIO = [
  ROTAS.DASHBOARD,
  ROTAS.RECEBER_MATERIAL,
  ROTAS.DEVOLVER_MATERIAL,
  ROTAS.POLICIAIS,
  ROTAS.CARGA_PESSOAL
]

const ROTAS_P4 = [
  ROTAS.DASHBOARD,
  ROTAS.CENTRAL_OPERACIONAL,
  ROTAS.MANUTENCOES,
  ROTAS.PAGAR_MATERIAL,
  ROTAS.RECEBER_MATERIAL,
  ROTAS.TRANSFERIR_MATERIAL,
  ROTAS.BAIXAR_MATERIAL,
  ROTAS.MATERIAIS,
  ROTAS.POLICIAIS,
  ROTAS.CARGA_PESSOAL,
  ROTAS.ARMAS,
  ROTAS.TPD,
  ROTAS.HT,
  ROTAS.TASERS,
  ROTAS.TONFAS,
  ROTAS.MUNICOES,
  ROTAS.LOCAIS,
  ROTAS.VIATURAS,
  ROTAS.RELATORIOS,
  ROTAS.ALERTAS
]

const ROTAS_AUXILIAR = [
  ROTAS.DASHBOARD,
  ROTAS.CENTRAL_OPERACIONAL,
  ROTAS.PAGAR_MATERIAL,
  ROTAS.RECEBER_MATERIAL,
  ROTAS.MATERIAIS,
  ROTAS.POLICIAIS,
  ROTAS.CARGA_PESSOAL,
  ROTAS.ARMAS,
  ROTAS.TPD,
  ROTAS.HT,
  ROTAS.TASERS,
  ROTAS.TONFAS,
  ROTAS.MUNICOES,
  ROTAS.LOCAIS,
  ROTAS.VIATURAS,
  ROTAS.ALERTAS
]

const ROTAS_ENCARREGADO = [
  ...ROTAS_AUXILIAR,
  ROTAS.MANUTENCOES,
  ROTAS.TRANSFERIR_MATERIAL,
  ROTAS.BAIXAR_MATERIAL,
  ROTAS.RELATORIOS,
  ROTAS.AUDITORIA,
  ROTAS.DIAGNOSTICO,
  ROTAS.SOLICITACOES_CADASTRAIS
]

const ROTAS_COMANDANTE = [
  ...ROTAS_ENCARREGADO,
  ROTAS.CONFIGURACOES
]

const ROTAS_ADMINISTRADOR = [
  ...ROTAS_COMANDANTE,
  ROTAS.EXPORTACAO_BACKUP
]

const ROTAS_POR_PERFIL = {
  [PERFIS.USUARIO]:
    ROTAS_USUARIO,

  [PERFIS.USUARIO_EXTERNO]:
    ROTAS_USUARIO,

  [PERFIS.P4]:
    ROTAS_P4,

  [PERFIS.AUXILIAR_SVDD]:
    ROTAS_AUXILIAR,

  [PERFIS.ENCARREGADO_SVDD]:
    ROTAS_ENCARREGADO,

  [PERFIS.COMANDANTE_CIA]:
    ROTAS_COMANDANTE,

  [PERFIS.ADMINISTRADOR]:
    ROTAS_ADMINISTRADOR
}

export function obterRotasPermitidas(user) {
  const perfil =
    obterPerfilEfetivo(user)

  const rotasBase =
    ROTAS_POR_PERFIL[perfil] ||
    ROTAS_USUARIO

  if (
    podeAcessarRecuperacaoPin(user) &&
    !rotasBase.includes(
      ROTAS.SOLICITACOES_CADASTRAIS
    )
  ) {
    return [
      ...rotasBase,
      ROTAS.SOLICITACOES_CADASTRAIS
    ]
  }

  return rotasBase
}

export function podeAcessarRota(
  user,
  rota
) {
  if (!rota) return false

  return obterRotasPermitidas(
    user
  ).includes(rota)
}

export function obterRotaInicial(user) {
  if (ehUsuario(user)) {
    return ROTAS.DASHBOARD
  }

  return ROTAS.DASHBOARD
}

export function podeVisualizarDashboard(
  user
) {
  return podeAcessarRota(
    user,
    ROTAS.DASHBOARD
  )
}

export function podeVisualizarCentral(
  user
) {
  return podeAcessarRota(
    user,
    ROTAS.CENTRAL_OPERACIONAL
  )
}

export function podeVisualizarPoliciais(
  user
) {
  return podeAcessarRota(
    user,
    ROTAS.POLICIAIS
  )
}

export function podeCadastrarPolicial(
  user
) {
  return possuiAdministracaoCia(user) || ehAuxiliar(user)
}

export function podeCadastrarPolicialInterno(user) {
  return possuiAdministracaoCia(user)
}

export function podeCadastrarUsuarioExterno(user) {
  return possuiAdministracaoCia(user) || ehAuxiliar(user)
}

export function podePesquisarOutrosPoliciais(
  user
) {
  return !ehUsuario(user)
}

export function podeVisualizarPolicial(
  user,
  policial
) {
  if (!user || !policial) {
    return false
  }

  if (!ehUsuario(user)) {
    return true
  }

  const policialId =
    policial?.id ||
    policial?.policial_id

  const usuarioPolicialId =
    user?.policial_id ||
    user?.id_policial

  if (
    policialId &&
    usuarioPolicialId
  ) {
    return (
      String(policialId) ===
      String(usuarioPolicialId)
    )
  }

  const policialRe =
    String(
      policial?.re ?? ''
    ).trim()

  const usuarioRe =
    String(
      user?.re ?? ''
    ).trim()

  return (
    policialRe !== '' &&
    policialRe === usuarioRe
  )
}

export function podeEditarPolicial(
  user,
  policial
) {
  if (
    possuiAdministracaoCia(user)
  ) {
    return true
  }

  if (ehAuxiliar(user)) {
    return false
  }

  return podeVisualizarPolicial(
    user,
    policial
  )
}

export function podeExcluirPolicial(
  user
) {
  return ehAdministrador(user)
}

export function podeAprovarAlteracaoPolicial(
  user
) {
  return possuiAdministracaoCia(
    user
  )
}

export function podeAlterarProprioPin(
  user,
  policial
) {
  return podeVisualizarPolicial(
    user,
    policial
  )
}

export function podeEditarCamposAdministrativos(
  user
) {
  return possuiAdministracaoCia(
    user
  )
}

export function podeVisualizarTodosMateriais(
  user
) {
  return !ehUsuario(user)
}

export function podeEditarMaterial(
  user
) {
  return !ehUsuario(user)
}

export function podeExcluirMaterial(
  user
) {
  return perfilEh(
    user,
    PERFIS.ADMINISTRADOR,
    PERFIS.P4,
    PERFIS.COMANDANTE_CIA,
    PERFIS.ENCARREGADO_SVDD
  )
}

export function podeConcederPerfilTemporario(
  user
) {
  return possuiAdministracaoCia(
    user
  )
}

export function podeRevogarPerfilTemporario(
  user
) {
  return possuiAdministracaoCia(
    user
  )
}

export function obterResumoPermissoes(user) {
  const perfil =
    obterPerfilEfetivo(user)

  return {
    perfil,
    perfilTemporario:
      possuiPerfilTemporarioAtivo(
        user
      ),
    rotas:
      obterRotasPermitidas(user),
    administracaoCia:
      possuiAdministracaoCia(user),
    podeExcluirPoliciais:
      podeExcluirPolicial(user),
    podeConcederPerfilTemporario:
      podeConcederPerfilTemporario(
        user
      )
  }
}