const DB_KEY = 'sigmo_database'

const initialDatabase = {
  materiais: [],
  movimentacoes: [],
  entregas: []
}

export function getDatabase() {
  const data = localStorage.getItem(DB_KEY)

  if (!data) {
    localStorage.setItem(DB_KEY, JSON.stringify(initialDatabase))
    return initialDatabase
  }

  return JSON.parse(data)
}

export function saveDatabase(database) {
  localStorage.setItem(DB_KEY, JSON.stringify(database))
}

export function gerarId(prefixo) {
  return `${prefixo}_${Date.now()}_${Math.floor(Math.random() * 1000)}`
}
// =========================
// MATERIAIS
// =========================

export function listarMateriais() {
  return getDatabase().materiais
}

export function buscarMaterial(id) {
  return getDatabase().materiais.find(m => m.id === id)
}

export function adicionarMaterial(material) {
  const db = getDatabase()

  db.materiais.push({
    id: gerarId('MAT'),
    ...material,
    dataCadastro: new Date().toISOString()
  })

  saveDatabase(db)
}

export function atualizarMaterial(id, dados) {
  const db = getDatabase()

  const index = db.materiais.findIndex(m => m.id === id)

  if (index === -1) return false

  db.materiais[index] = {
    ...db.materiais[index],
    ...dados
  }

  saveDatabase(db)
  return true
}

export function excluirMaterial(id) {
  const db = getDatabase()

  db.materiais = db.materiais.filter(m => m.id !== id)

  saveDatabase(db)
}