import { useEffect, useState } from 'react'
import {
  STATUS_MANUTENCAO,
  listarFotosManutencao,
  buscarNovidadePatrimonialDaManutencao
} from '../../../services/manutencoesService'

function dataHora(valor) {
  if (!valor) return 'Não informado'
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return 'Não informado'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
    timeStyle: 'short'
  }).format(data)
}

export default function ManutencaoDetalhes({
  manutencao,
  onFechar,
  onConcluir,
  onCancelar,
  salvando
}) {
  const [observacoes, setObservacoes] = useState('')
  const [fotos, setFotos] = useState([])
  const [novidadeUsuario, setNovidadeUsuario] = useState(null)
  const [fotosUsuario, setFotosUsuario] = useState([])
  const [fotoAmpliada, setFotoAmpliada] = useState(null)

  useEffect(() => {
    async function carregarHistorico() {
      if (!manutencao?.id) {
        setFotos([])
        setNovidadeUsuario(null)
        setFotosUsuario([])
        return
      }

      try {
        const [fotosManutencao, registroUsuario] = await Promise.all([
          listarFotosManutencao(manutencao.id),
          buscarNovidadePatrimonialDaManutencao(manutencao)
        ])

        setFotos(fotosManutencao || [])
        setNovidadeUsuario(registroUsuario?.novidade || null)
        setFotosUsuario(registroUsuario?.fotos || [])
      } catch (erro) {
        console.error('Erro ao carregar histórico completo da manutenção:', erro)
        setFotos([])
        setNovidadeUsuario(null)
        setFotosUsuario([])
      }
    }

    carregarHistorico()
  }, [manutencao])

if (!manutencao) return null

  const ativa = manutencao.status === STATUS_MANUTENCAO.EM_MANUTENCAO

  return (
    <div className="manutencao-drawer-camada" role="presentation">
      <button
        type="button"
        className="manutencao-drawer-overlay"
        aria-label="Fechar detalhes"
        onClick={onFechar}
      />

      <aside className="manutencao-drawer" aria-label="Detalhes da manutenção">
        <header>
          <div>
            <span>CENTRAL DE MANUTENÇÕES</span>
            <h2>
              {manutencao.tipo_material || 'Material'}
              {(manutencao.numero_serie || manutencao.patrimonio) && (
                <> · {manutencao.numero_serie || manutencao.patrimonio}</>
              )}
            </h2>
            {(manutencao.marca || manutencao.modelo || manutencao.calibre) && (
              <small>
                {[manutencao.marca, manutencao.modelo, manutencao.calibre]
                  .filter(Boolean)
                  .join(' · ')}
              </small>
            )}
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar">×</button>
        </header>

        <div className="manutencao-drawer-corpo">
          <div className="manutencao-detalhe-foto">
            {(fotos[0]?.foto_url || manutencao.foto_url) ? (
              <img
  src={fotos[0]?.foto_url || manutencao.foto_url}
  alt="Foto da manutenção"
  onClick={() => setFotoAmpliada({
    url: fotos[0]?.foto_url || manutencao.foto_url,
    titulo: 'Foto da manutenção'
  })}
  style={{ cursor: 'zoom-in' }}
/>
            ) : (
              <span aria-hidden="true">🔧</span>
            )}
          </div>
{fotos.length > 1 && (
  <div className="manutencao-galeria-miniaturas">
    {fotos.map((foto) => (
      <img
        key={foto.id}
        src={foto.foto_url}
        alt={foto.tipo || 'Foto'}
        className="manutencao-miniatura"
        onClick={() =>
          setFotos((lista) => {
            const selecionada = lista.find((f) => f.id === foto.id)
            const restantes = lista.filter((f) => f.id !== foto.id)
            return [selecionada, ...restantes]
          })
        }
      />
    ))}
  </div>
)}
          {novidadeUsuario && (
            <section
              className="manutencao-detalhe-texto"
              style={{
                border: '1px solid #bfdbfe',
                borderRadius: '12px',
                padding: '14px',
                background: '#eff6ff',
                marginBottom: '16px'
              }}
            >
              <h3>Novidade registrada pelo usuário</h3>

              <p>
                <strong>
                  {novidadeUsuario.titulo ||
                    novidadeUsuario.tipo_novidade ||
                    'NÃO INFORMADO'}
                </strong>
              </p>

              <p style={{ marginTop: '8px' }}>
                {novidadeUsuario.descricao ||
                  'Nenhuma descrição registrada.'}
              </p>

              <p style={{ marginTop: '8px', fontSize: '13px' }}>
                <strong>Registrado por:</strong>{' '}
                {novidadeUsuario.registrado_por_nome ||
                  novidadeUsuario.registrada_por_nome ||
                  'Não informado'}
                {' · '}
                {dataHora(
                  novidadeUsuario.created_at ||
                  novidadeUsuario.registrada_em
                )}
              </p>

              {fotosUsuario.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    gap: '10px',
                    flexWrap: 'wrap',
                    marginTop: '12px'
                  }}
                >
                  {fotosUsuario.map((foto, indice) => (
                    <button
                      type="button"
                      key={foto.id || `${foto.foto_url}-${indice}`}
                      title="Ampliar foto registrada pelo usuário"
                      onClick={() => setFotoAmpliada({
                        url: foto.foto_url,
                        titulo: `Foto ${indice + 1} registrada pelo usuário`
                      })}
                      style={{
                        padding: 0,
                        border: 0,
                        background: 'transparent',
                        cursor: 'zoom-in'
                      }}
                    >
                      <img
                        src={foto.foto_url}
                        alt={`Foto ${indice + 1} registrada pelo usuário`}
                        style={{
                          width: '92px',
                          height: '92px',
                          objectFit: 'cover',
                          borderRadius: '8px',
                          border: '1px solid #93c5fd'
                        }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          <section
            className="manutencao-detalhe-texto"
            style={{
              border: '1px solid #fed7aa',
              borderRadius: '12px',
              padding: '14px',
              background: '#fff7ed',
              marginBottom: '16px'
            }}
          >
            <h3>Providência / entrada em manutenção pelo SVDD</h3>

            <p>
              <strong>
                {manutencao.providencia ||
                  manutencao.destino ||
                  'MANUTENÇÃO'}
              </strong>
            </p>

            <p style={{ marginTop: '8px' }}>
              {manutencao.descricao ||
                'Nenhuma descrição registrada.'}
            </p>

            <p style={{ marginTop: '8px', fontSize: '13px' }}>
              <strong>Registrado por:</strong>{' '}
              {manutencao.registrada_por_nome || 'Não informado'}
              {' · '}
              {dataHora(
                manutencao.registrada_em ||
                manutencao.created_at
              )}
            </p>

            {fotos.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  flexWrap: 'wrap',
                  marginTop: '12px'
                }}
              >
                {fotos.map((foto, indice) => (
                  <img
                    key={foto.id || `${foto.foto_url}-${indice}`}
                    src={foto.foto_url}
                    alt={`Foto ${indice + 1} da manutenção`}
                    onClick={() => setFotoAmpliada({
                      url: foto.foto_url,
                      titulo: `Foto ${indice + 1} da manutenção`
                    })}
                    style={{
                      width: '92px',
                      height: '92px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      border: '1px solid #fdba74',
                      cursor: 'zoom-in'
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="manutencao-detalhe-grade">
            <div><span>Módulo</span><strong>{manutencao.modulo || 'OUTROS'}</strong></div>
            <div><span>Status</span><strong>{String(manutencao.status || '').replaceAll('_', ' ')}</strong></div>
            <div><span>Quantidade</span><strong>{manutencao.quantidade || 1}</strong></div>
            <div><span>Policial</span><strong>{manutencao.policial_nome || 'Não vinculado'}</strong></div>
            <div><span>RE</span><strong>{manutencao.policial_re || 'Não informado'}</strong></div>
            <div><span>Registrada em</span><strong>{dataHora(manutencao.registrada_em || manutencao.created_at)}</strong></div>
            <div><span>Concluída em</span><strong>{dataHora(manutencao.concluida_em)}</strong></div>
          </section>

          <section className="manutencao-detalhe-texto">
            <h3>Observações</h3>
            <p>{manutencao.observacoes || 'Nenhuma observação registrada.'}</p>
          </section>

          {ativa && (
            <label className="manutencao-observacoes-finais">
              <span>Observações finais</span>
              <textarea
                rows="4"
                value={observacoes}
                placeholder="Informe o serviço executado, condição final ou motivo do cancelamento."
                onChange={(event) => setObservacoes(event.target.value.toUpperCase())}
              />
            </label>
          )}
        </div>

        {ativa && (
          <footer>
            <button
              type="button"
              className="manutencoes-btn-perigo"
              disabled={salvando}
              onClick={() => onCancelar(observacoes)}
            >
              Cancelar manutenção
            </button>
            <button
              type="button"
              className="manutencoes-btn-primario"
              disabled={salvando}
              onClick={() => onConcluir(observacoes)}
            >
              {salvando
                ? 'Salvando...'
                : manutencao.modulo === 'HT'
                  ? 'Aprovar saída da manutenção'
                  : 'Concluir manutenção'}
            </button>
          </footer>
        )}
      </aside>

      {fotoAmpliada?.url && (
        <div
          role="presentation"
          onClick={() => setFotoAmpliada(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(2, 12, 27, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}
        >
          <button
            type="button"
            aria-label="Fechar foto ampliada"
            onClick={() => setFotoAmpliada(null)}
            style={{
              position: 'fixed',
              top: '20px',
              right: '24px',
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,.35)',
              background: '#0b3157',
              color: '#fff',
              fontSize: '26px',
              cursor: 'pointer'
            }}
          >
            ×
          </button>

          <img
            src={fotoAmpliada.url}
            alt={fotoAmpliada.titulo || 'Foto ampliada'}
            onClick={(event) => event.stopPropagation()}
            style={{
              maxWidth: '92vw',
              maxHeight: '88vh',
              objectFit: 'contain',
              borderRadius: '12px'
            }}
          />
        </div>
      )}
    </div>
  )
}
