export const PERFIS = {
  ADMINISTRADOR: 'ADMINISTRADOR',
  COMANDANTE_CIA: 'COMANDANTE DE CIA',
  ENCARREGADO_SVDD: 'ENCARREGADO DO SVDD',
  AUXILIAR_SVDD: 'AUXILIAR DO SVDD',
  USUARIO: 'USUÁRIO'
}

export const ROTAS = {
  DASHBOARD: 'dashboard',
  CENTRAL_OPERACIONAL: 'central-operacional',
  PAGAR_MATERIAL: 'pagar-material',
  RECEBER_MATERIAL: 'receber-material',
  TRANSFERIR_MATERIAL: 'transferir-material',
  BAIXAR_MATERIAL: 'baixar-material',
  MATERIAIS: 'materiais',
  POLICIAIS: 'policiais',
  ARMAS: 'armas',
  MUNICOES: 'municoes',
  LOCAIS: 'locais',
  VIATURAS: 'viaturas',
  RELATORIOS: 'relatorios',
  ALERTAS: 'alertas',
  AUDITORIA: 'auditoria',
  EXPORTACAO_BACKUP: 'exportacao-backup',
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

    'AUXILIAR DO SVDD':
      PERFIS.AUXILIAR_SVDD,
    'AUXILIAR SVDD':
      PERFIS.AUXILIAR_SVDD,

    USUARIO:
      PERFIS.USUARIO,
    OPERADOR:
      PERFIS.USUARIO
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

export function ehUsuario(user) {
  return perfilEh(
    user,
    PERFIS.USUARIO
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

const ROTAS_USUARIO = [
  ROTAS.RECEBER_MATERIAL,
  ROTAS.MATERIAIS,
  ROTAS.POLICIAIS
]

const ROTAS_AUXILIAR = [
  ROTAS.DASHBOARD,
  ROTAS.CENTRAL_OPERACIONAL,
  ROTAS.PAGAR_MATERIAL,
  ROTAS.RECEBER_MATERIAL,
  ROTAS.TRANSFERIR_MATERIAL,
  ROTAS.MATERIAIS,
  ROTAS.POLICIAIS,
  ROTAS.ARMAS,
  ROTAS.MUNICOES,
  ROTAS.LOCAIS,
  ROTAS.VIATURAS,
  ROTAS.ALERTAS
]

const ROTAS_ENCARREGADO = [
  ...ROTAS_AUXILIAR,
  ROTAS.BAIXAR_MATERIAL,
  ROTAS.RELATORIOS,
  ROTAS.AUDITORIA
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

  return (
    ROTAS_POR_PERFIL[perfil] ||
    ROTAS_USUARIO
  )
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
    return ROTAS.POLICIAIS
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
  return possuiAdministracaoCia(
    user
  )
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