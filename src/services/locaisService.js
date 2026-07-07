import { getDatabase, saveDatabase, gerarId } from '../data/database'

const LOCAIS_PADRAO = [
  {
    id: 'LOC_GUARDA',
    nome: 'Guarda do Quartel',
    tipo: 'GUARDA',
    descricao: 'Local principal da guarda',
    ativo: true,
    permite_receber: true,
    permite_entregar: true,
  },
  {
    id: 'LOC_RESERVA_BELICA',
    nome: 'Reserva Bélica',
    tipo: 'GUARDA',
    descricao: 'Local de armazenamento de armamento',
    ativo: true,
    permite_receber: true,
    permite_entregar: true,
  },
  {
    id: 'LOC_BAIXADO',
    nome: 'Baixado',
    tipo: 'BAIXA',
    descricao: 'Destino final para patrimônio baixado',
    ativo: true,
    permite_receber: true,
    permite_entregar: false,
  },
]

function prepararDatabase() {
  const db = getDatabase()

  if (!Array.isArray(db.locais)) {
    db.locais = LOCAIS_PADRAO
    saveDatabase(db)
  }

  return db
}

export async function listarLocais() {
  const db = prepararDatabase()

  return [...db.locais].sort((a, b) =>
    a.nome.localeCompare(b.nome)
  )
}

export async function buscarLocal(id) {
  const db = prepararDatabase()

  return db.locais.find((local) => local.id === id) || null
}

export async function cadastrarLocal(dados) {
  const db = prepararDatabase()

  const novoLocal = {
    id: gerarId('LOC'),
    nome: dados.nome,
    tipo: dados.tipo || 'GUARDA',
    descricao: dados.descricao || '',
    ativo: dados.ativo !== false,
    permite_receber: dados.permite_receber !== false,
    permite_entregar: dados.permite_entregar !== false,
  }

  db.locais.push(novoLocal)
  saveDatabase(db)

  return novoLocal
}

export async function atualizarLocal(id, dados) {
  const db = prepararDatabase()

  const index = db.locais.findIndex((local) => local.id === id)

  if (index === -1) {
    throw new Error('Local não encontrado.')
  }

  db.locais[index] = {
    ...db.locais[index],
    ...dados,
    id,
  }

  saveDatabase(db)

  return db.locais[index]
}

export async function excluirLocal(id) {
  const db = prepararDatabase()

  db.locais = db.locais.filter((local) => local.id !== id)

  saveDatabase(db)

  return true
}