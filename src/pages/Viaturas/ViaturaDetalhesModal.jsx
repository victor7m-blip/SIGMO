import { useEffect, useMemo, useState } from 'react'

import ViaturaRiv from './ViaturaRiv'

import {
  definirFotoPrincipal,
  enviarFotosCadastroInicial,
  excluirFotoViatura,
  listarFotosViatura
} from '../../services/viaturasFotosService'

export default function ViaturaDetalhesModal({
  user,
  viatura,
  onClose,
  onUpdated
}) {
  const [fotos, setFotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const [aba, setAba] = useState('FOTOS')

  const fotosCadastroInicial = useMemo(
    () => fotos.filter((item) => item.origem === 'CADASTRO_INICIAL'),
    [fotos]
  )

  async function carregarFotos() {
    try {
      setLoading(true)
      setErro('')
      setFotos(await listarFotosViatura(viatura.id))
    } catch (error) {
      setErro(error?.message || 'Não foi possível carregar as fotos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarFotos()
  }, [viatura.id])

  async function upload(event) {
    const arquivos = event.target.files
    if (!arquivos?.length) return

    try {
      setOcupado(true)
      setErro('')

      await enviarFotosCadastroInicial({
        viatura,
        arquivos,
        user
      })

      await carregarFotos()
      await onUpdated?.()
    } catch (error) {
      setErro(error?.message || 'Não foi possível enviar as fotos.')
    } finally {
      event.target.value = ''
      setOcupado(false)
    }
  }

  async function principal(foto) {
    try {
      setOcupado(true)
      setErro('')
      await definirFotoPrincipal(viatura.id, foto)
      await carregarFotos()
      await onUpdated?.()
    } catch (error) {
      setErro(error?.message || 'Não foi possível definir a foto principal.')
    } finally {
      setOcupado(false)
    }
  }

  async function excluir(foto) {
    if (!window.confirm('Excluir esta foto da ficha da viatura?')) {
      return
    }

    try {
      setOcupado(true)
      setErro('')
      await excluirFotoViatura(viatura.id, foto)
      await carregarFotos()
      await onUpdated?.()
    } catch (error) {
      setErro(error?.message || 'Não foi possível excluir a foto.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div
      className="viatura-ficha-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !ocupado) {
          onClose()
        }
      }}
    >
      <section className="viatura-ficha">
        <header className="viatura-ficha__header">
          <div>
            <small>FICHA INDIVIDUAL DA VIATURA</small>
            <h2>{viatura.prefixo}</h2>
            <p>{viatura.modelo} · {viatura.ano}</p>
          </div>

          <button type="button" onClick={onClose} disabled={ocupado}>
            ×
          </button>
        </header>

        <div className="viatura-ficha__dados">
          <div>
            <small>Tipo</small>
            <strong>
              {viatura.tipo_veiculo === 'MOTOCICLETA'
                ? 'Motocicleta'
                : 'Viatura'}
            </strong>
          </div>
          <div>
            <small>Placa</small>
            <strong>{viatura.placa}</strong>
          </div>
          <div>
            <small>Ano</small>
            <strong>{viatura.ano}</strong>
          </div>
          <div>
            <small>Situação</small>
            <strong>{String(viatura.situacao || '').replaceAll('_', ' ')}</strong>
          </div>
        </div>

        <div className="viatura-ficha__abas">
          <button
            type="button"
            className={aba === 'FOTOS' ? 'is-ativa' : ''}
            onClick={() => setAba('FOTOS')}
          >
            Registro fotográfico
          </button>
          <button
            type="button"
            className={aba === 'RIV' ? 'is-ativa' : ''}
            onClick={() => setAba('RIV')}
          >
            RIV — Registro Individual
          </button>
        </div>

        {aba === 'FOTOS' && (
        <div className="viatura-ficha__secao">
            <div className="viatura-ficha__titulo">
            <div>
              <small>REGISTRO FOTOGRÁFICO</small>
              <h3>Estado inicial da viatura</h3>
              <p>
                Registre até 10 fotos do estado da viatura no momento do cadastro.
                A foto marcada como principal aparece no card.
              </p>
            </div>

            <label className="viatura-ficha__upload">
              {ocupado ? 'Enviando...' : '+ Adicionar fotos'}
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={ocupado || fotosCadastroInicial.length >= 10}
                onChange={upload}
              />
            </label>
          </div>

          <div className="viatura-ficha__contador">
            {fotosCadastroInicial.length}/10 fotos do cadastro inicial
          </div>

          {erro && <div className="viaturas-erro">{erro}</div>}

          {loading ? (
            <div className="viaturas-vazio">Carregando fotos...</div>
          ) : fotosCadastroInicial.length === 0 ? (
            <div className="viatura-ficha__sem-fotos">
              Nenhuma foto cadastrada ainda.
            </div>
          ) : (
            <div className="viatura-ficha__galeria">
              {fotosCadastroInicial.map((foto) => (
                <article
                  className={[
                    'viatura-ficha__foto',
                    foto.principal ? 'is-principal' : ''
                  ].join(' ')}
                  key={foto.id}
                >
                  <img src={foto.url} alt={foto.nome_arquivo || 'Foto da viatura'} />

                  <div className="viatura-ficha__foto-info">
                    <span>
                      {foto.principal ? 'FOTO PRINCIPAL' : 'CADASTRO INICIAL'}
                    </span>

                    <small>
                      {new Date(foto.created_at).toLocaleString('pt-BR')}
                    </small>
                  </div>

                  <div className="viatura-ficha__foto-acoes">
                    {!foto.principal && (
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => principal(foto)}
                      >
                        Tornar principal
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => excluir(foto)}
                    >
                      Excluir
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        )}

        {aba === 'RIV' && (
          <ViaturaRiv
            user={user}
            viatura={viatura}
            onUpdated={onUpdated}
          />
        )}

      </section>
    </div>
  )
}
