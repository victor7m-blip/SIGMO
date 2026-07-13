import {
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  listarPatrimoniosParaEntrega
} from '../../../services/pagarMaterialService'

function normalizarTexto(valor) {
  return String(valor || '')
    .trim()
    .toUpperCase()
}

export default function PesquisaMaterial({
  itensSelecionados = [],
  onAdicionar,
  onAbrirQrCode,
  atualizarEm = 0
}) {
  const [busca, setBusca] =
    useState('')

  const [materiais, setMateriais] =
    useState([])

  const [loading, setLoading] =
    useState(false)

  const [erro, setErro] =
    useState('')

  useEffect(() => {
    carregarMateriais()
  }, [atualizarEm])

  async function carregarMateriais() {
    try {
      setLoading(true)
      setErro('')

      const resultado =
        await listarPatrimoniosParaEntrega()

      setMateriais(resultado)
    } catch (error) {
      console.error(error)

      setErro(
        'Não foi possível carregar os patrimônios.'
      )
    } finally {
      setLoading(false)
    }
  }

  const resultados = useMemo(() => {
    const termo =
      normalizarTexto(busca)

    if (!termo) {
      return materiais
    }

    return materiais.filter((material) =>
      [
        material.patrimonio,
        material.descricao,
        material.categoria,
        material.local_atual,
        material.status,
        material.modulo,
        material.numero_serie,
        material.qr_code
      ].some((valor) =>
        normalizarTexto(valor).includes(
          termo
        )
      )
    )
  }, [busca, materiais])

  function estaSelecionado(material) {
    return itensSelecionados.some(
      (item) =>
        item.id === material.id &&
        item.tabela_origem ===
          material.tabela_origem
    )
  }

  return (
    <section className="pagar-material-card">
      <div className="pagar-material-card-header">
        <div>
          <span>ETAPA 2</span>
          <h2>Selecionar materiais</h2>
        </div>

        <div className="pagar-material-results-head">
          <strong className="pagar-material-count">
            {resultados.length} encontrados
          </strong>

          <button
            type="button"
            className="pagar-material-refresh"
            disabled={loading}
            onClick={carregarMateriais}
          >
            {loading
              ? 'Atualizando...'
              : 'Atualizar'}
          </button>
        </div>
      </div>

      <div className="pagar-material-search">
        <input
          value={busca}
          onChange={(event) =>
            setBusca(
              event.target.value.toUpperCase()
            )
          }
          placeholder="Pesquisar patrimônio, série, descrição, categoria ou local"
        />

        <button
          type="button"
          onClick={onAbrirQrCode}
        >
          Ler QR Code
        </button>
      </div>

      {erro && (
        <div className="pagar-material-inline-error">
          {erro}
        </div>
      )}

      <div className="pagar-material-table-wrap">
        <table className="pagar-material-table">
          <thead>
            <tr>
              <th>Patrimônio</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Módulo</th>
              <th>Local</th>
              <th>Status</th>
              <th aria-label="Ações" />
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={7}
                  className="pagar-material-table-empty"
                >
                  Carregando patrimônios...
                </td>
              </tr>
            ) : (
              resultados.map(
                (material) => {
                  const selecionado =
                    estaSelecionado(material)

                  return (
                    <tr
                      key={[
                        material.tabela_origem,
                        material.id
                      ].join('-')}
                    >
                      <td>
                        <strong>
                          {material.patrimonio}
                        </strong>
                      </td>

                      <td>
                        {material.descricao}
                      </td>

                      <td>
                        {material.categoria}
                      </td>

                      <td>
                        <span className="pagar-material-module">
                          {material.modulo}
                        </span>
                      </td>

                      <td>
                        {material.local_atual}
                      </td>

                      <td>
                        <span
                          className={[
                            'pagar-material-badge',
                            material.disponivel
                              ? 'is-success'
                              : 'is-warning'
                          ].join(' ')}
                        >
                          {material.status}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="pagar-material-add"
                          disabled={
                            selecionado ||
                            !material.disponivel
                          }
                          onClick={() =>
                            onAdicionar(material)
                          }
                        >
                          {selecionado
                            ? 'Adicionado'
                            : 'Adicionar'}
                        </button>
                      </td>
                    </tr>
                  )
                }
              )
            )}

            {!loading &&
              resultados.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="pagar-material-table-empty"
                  >
                    Nenhum patrimônio encontrado.
                  </td>
                </tr>
              )}
          </tbody>
        </table>
      </div>
    </section>
  )
}