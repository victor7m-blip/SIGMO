import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  listarPatrimoniosCategoria,
  listarResponsaveisCategoria,
  listarResumoCentral
} from '../../services/CentralOperacionalEngine'
import CategoriaCard from './components/CategoriaCard'
import CategoriaDetalhes from './components/CategoriaDetalhes'
import CentralResumo from './components/CentralResumo'
import ConferenciaPatrimonial from './components/ConferenciaPatrimonial'
import ResponsabilidadePolicial from './components/ResponsabilidadePolicial'
import './styles/central-operacional.css'

export default function CentralOperacional() {
  const [resumo, setResumo] = useState({
    total: 0,
    com_policial: 0,
    no_cofre: 0,
    sem_localizacao: 0,
    divergencias: 0,
    categorias: []
  })

  const [categoriaSelecionada, setCategoriaSelecionada] = useState(null)
  const [patrimonios, setPatrimonios] = useState([])
  const [responsaveis, setResponsaveis] = useState([])

  const [buscaCategoria, setBuscaCategoria] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [carregandoCategoria, setCarregandoCategoria] = useState(false)
  const [erro, setErro] = useState('')

  const [conferenciaAberta, setConferenciaAberta] = useState(false)
  const [responsabilidadeAberta, setResponsabilidadeAberta] =
    useState(false)

  const categoriasFiltradas = useMemo(() => {
    const busca = buscaCategoria.trim().toUpperCase()

    if (!busca) {
      return resumo.categorias
    }

    return resumo.categorias.filter((item) =>
      item.categoria.includes(busca)
    )
  }, [buscaCategoria, resumo.categorias])

  const carregarResumo = useCallback(async () => {
    try {
      setCarregando(true)
      setErro('')

      const dados = await listarResumoCentral()

      setResumo(dados)

      setCategoriaSelecionada((atual) => {
        if (!atual) {
          return null
        }

        return (
          dados.categorias.find(
            (item) => item.categoria === atual.categoria
          ) ?? null
        )
      })
    } catch (error) {
      setErro(
        error?.message ||
          'Não foi possível carregar a Central Operacional.'
      )
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregarResumo()
  }, [carregarResumo])

  async function selecionarCategoria(categoria) {
    try {
      setCategoriaSelecionada(categoria)
      setCarregandoCategoria(true)
      setErro('')

      const [listaPatrimonios, listaResponsaveis] = await Promise.all([
        listarPatrimoniosCategoria(categoria.categoria),
        listarResponsaveisCategoria(categoria.categoria)
      ])

      setPatrimonios(listaPatrimonios)
      setResponsaveis(listaResponsaveis)
    } catch (error) {
      setErro(
        error?.message || 'Não foi possível abrir a categoria.'
      )
    } finally {
      setCarregandoCategoria(false)
    }
  }

  async function atualizarCategoria() {
    await carregarResumo()

    if (categoriaSelecionada?.categoria) {
      const categoriaAtualizada =
        resumo.categorias.find(
          (item) =>
            item.categoria === categoriaSelecionada.categoria
        ) ?? categoriaSelecionada

      await selecionarCategoria(categoriaAtualizada)
    }
  }

  function voltarCategorias() {
    setCategoriaSelecionada(null)
    setPatrimonios([])
    setResponsaveis([])
  }

  return (
    <main className="central-page">
      <header className="central-page-header">
        <div>
          <span className="central-section-eyebrow">
            Sprint 7.3
          </span>

          <h1>Central Operacional Patrimonial</h1>

          <p>
            Visão consolidada da reserva, responsabilidades,
            localização física e divergências patrimoniais.
          </p>
        </div>

        <div className="central-page-actions">
          <button
            type="button"
            className="central-button central-button-secondary"
            onClick={() => setResponsabilidadeAberta(true)}
          >
            Consultar policial
          </button>

          <button
            type="button"
            className="central-button central-button-primary"
            onClick={carregarResumo}
            disabled={carregando}
          >
            {carregando ? 'Atualizando...' : 'Atualizar central'}
          </button>
        </div>
      </header>

      {erro && (
        <div className="central-alert central-alert-error">
          {erro}
        </div>
      )}

      {categoriaSelecionada ? (
        <CategoriaDetalhes
          categoria={categoriaSelecionada}
          patrimonios={patrimonios}
          responsaveis={responsaveis}
          carregando={carregandoCategoria}
          onVoltar={voltarCategorias}
          onAbrirConferencia={() => setConferenciaAberta(true)}
          onSelecionarPatrimonio={(item) => {
            console.log('Patrimônio selecionado:', item)
          }}
          onSelecionarResponsavel={(responsavel) => {
            console.log('Responsável selecionado:', responsavel)
          }}
        />
      ) : (
        <>
          <CentralResumo resumo={resumo} />

          <section className="central-categorias-section">
            <div className="central-section-header">
              <div>
                <span className="central-section-eyebrow">
                  Reserva operacional
                </span>

                <h2>Categorias patrimoniais</h2>

                <p>
                  Selecione uma categoria para consultar os patrimônios
                  e responsáveis.
                </p>
              </div>

              <label className="central-search">
                <span>Buscar categoria</span>

                <input
                  type="text"
                  value={buscaCategoria}
                  onChange={(event) =>
                    setBuscaCategoria(event.target.value.toUpperCase())
                  }
                  placeholder="HT, TPD, COLETE..."
                />
              </label>
            </div>

            {carregando ? (
              <div className="central-loading">
                Carregando Central Operacional...
              </div>
            ) : categoriasFiltradas.length === 0 ? (
              <div className="central-empty">
                Nenhuma categoria patrimonial encontrada.
              </div>
            ) : (
              <div className="central-categorias-grid">
                {categoriasFiltradas.map((categoria) => (
                  <CategoriaCard
                    key={categoria.categoria}
                    categoria={categoria}
                    selecionada={
                      categoriaSelecionada?.categoria ===
                      categoria.categoria
                    }
                    onClick={selecionarCategoria}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <ConferenciaPatrimonial
        aberto={conferenciaAberta}
        categoria={categoriaSelecionada}
        onFechar={() => setConferenciaAberta(false)}
        onConferenciaAlterada={atualizarCategoria}
      />

      <ResponsabilidadePolicial
        aberto={responsabilidadeAberta}
        onFechar={() => setResponsabilidadeAberta(false)}
      />
    </main>
  )
}