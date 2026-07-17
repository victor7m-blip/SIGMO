import {
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  QRCodeCanvas
} from 'qrcode.react'

import {
  supabase
} from '../../../services/supabaseClient'

import './policialViewModal.css'

export default function PolicialViewModal({
  policial,
  fotos = [],
  onClose,
  onPrintFicha,
  onPrintCredencial
}) {
  const [
    policialAtual,
    setPolicialAtual
  ] = useState(policial)

  const [
    fotoSelecionada,
    setFotoSelecionada
  ] = useState(null)

  useEffect(() => {
    setPolicialAtual(policial)

    async function carregarPolicialAtualizado() {
      if (!policial?.id) {
        return
      }

      try {
        const {
          data,
          error
        } = await supabase
          .from('policiais')
          .select('*')
          .eq(
            'id',
            policial.id
          )
          .maybeSingle()

        if (error) {
          throw error
        }

        if (data) {
          setPolicialAtual(data)
        }
      } catch (error) {
        console.error(
          'Erro ao atualizar dados do policial:',
          error
        )
      }
    }

    carregarPolicialAtualizado()
  }, [policial])

  const fotoPrincipal =
    useMemo(() => {
      if (!policialAtual) {
        return null
      }

      return (
        fotos.find(
          (foto) =>
            foto.principal
        ) ||
        fotos.find(
          (foto) =>
            foto.url ===
            policialAtual.foto_url
        ) ||
        fotos[0] ||
        (
          policialAtual.foto_url
            ? {
                id:
                  'principal-policial',

                url:
                  policialAtual.foto_url,

                principal:
                  true
              }
            : null
        )
      )
    }, [
      policialAtual,
      fotos
    ])

  useEffect(() => {
    setFotoSelecionada(
      fotoPrincipal
    )
  }, [fotoPrincipal])

  if (!policialAtual) {
    return null
  }

  const fotoAtual =
    fotoSelecionada ||
    fotoPrincipal

  const qrValue =
    policialAtual.qr_code ||
    JSON.stringify({
      modulo:
        'POLICIAIS',

      id:
        policialAtual.id,

      nome:
        policialAtual.nome,

      nome_guerra:
        policialAtual.nome_guerra,

      re:
        policialAtual.re
    })

  return (
    <div className="policial-modal-overlay">
      <div className="policial-modal">
        <div className="policial-modal-header">
          <div>
            <span>
              POLICIAL
            </span>

            <h2>
              {policialAtual.nome_guerra ||
                policialAtual.nome}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="policial-modal-close"
          >
            ×
          </button>
        </div>

        <div className="policial-modal-body">
          <aside className="policial-modal-photo-area">
            <div className="policial-main-photo">
              {fotoAtual?.url ? (
                <img
                  src={fotoAtual.url}
                  alt={
                    policialAtual.nome ||
                    'Policial'
                  }
                />
              ) : (
                <div className="policial-photo-placeholder">
                  SEM FOTO
                </div>
              )}
            </div>

            <div className="policial-modal-photo-caption">
              {fotoAtual?.principal
                ? 'Foto principal'
                : 'Foto selecionada'}
            </div>

            <div className="policial-modal-qrcode">
              <strong>
                QR Code funcional
              </strong>

              <div className="policial-qrcode-box">
                <QRCodeCanvas
                  value={qrValue}
                  size={150}
                  includeMargin
                />
              </div>
            </div>
          </aside>

          <section className="policial-modal-info">
            <div className="policial-info-grid">
              <Info
                label="Nome completo"
                value={
                  policialAtual.nome
                }
              />

              <Info
                label="Nome de guerra"
                value={
                  policialAtual.nome_guerra
                }
              />

              <Info
                label="RE"
                value={
                  policialAtual.re
                }
              />

              <Info
                label="Posto/Graduação"
                value={
                  policialAtual.posto_graduacao
                }
              />

              <Info
                label="Companhia"
                value={
                  policialAtual.companhia
                }
              />

              <Info
                label="Pelotão"
                value={
                  policialAtual.pelotao
                }
              />

              <Info
                label="Equipe"
                value={
                  policialAtual.equipe
                }
              />

              <Info
                label="Função"
                value={
                  policialAtual.funcao
                }
              />

              <Info
                label="Telefone"
                value={
                  policialAtual.telefone
                }
              />

              <Info
                label="E-mail"
                value={
                  policialAtual.email
                }
              />

              <Info
                label="CPF"
                value={
                  policialAtual.cpf
                }
              />

              <Info
                label="RG"
                value={
                  policialAtual.rg
                }
              />

              <Info
                label="Perfil"
                value={
                  policialAtual.perfil
                }
              />

              <Info
                label="Situação"
                value={
                  policialAtual.situacao
                }
              />
            </div>

            <div className="policial-observacoes">
              <strong>
                Observações
              </strong>

              <p>
                {policialAtual.observacoes ||
                  'Nenhuma observação registrada.'}
              </p>
            </div>

            <div className="policial-gallery">
              <strong>
                Galeria de fotos
              </strong>

              {fotos.length > 0 ? (
                <div className="policial-gallery-grid">
                  {fotos.map(
                    (foto) => (
                      <button
                        key={
                          foto.id ||
                          foto.url
                        }
                        type="button"
                        className={
                          `policial-gallery-item ${
                            fotoSelecionada?.id ===
                            foto.id
                              ? 'active'
                              : ''
                          }`
                        }
                        onClick={() =>
                          setFotoSelecionada(
                            foto
                          )
                        }
                        title="Visualizar foto"
                      >
                        <img
                          src={foto.url}
                          alt="Foto do policial"
                          loading="lazy"
                        />

                        {foto.principal && (
                          <span>
                            Principal
                          </span>
                        )}
                      </button>
                    )
                  )}
                </div>
              ) : (
                <p>
                  Nenhuma foto cadastrada.
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="policial-modal-footer">
          <button
            type="button"
            onClick={
              onPrintFicha
            }
            className="btn-secondary"
          >
            Imprimir ficha funcional
          </button>

          <button
            type="button"
            onClick={
              onPrintCredencial
            }
            className="btn-secondary"
          >
            Imprimir credencial
          </button>

          <button
            type="button"
            onClick={onClose}
            className="btn-primary"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

function Info({
  label,
  value
}) {
  return (
    <div className="policial-info-item">
      <span>
        {label}
      </span>

      <strong>
        {value || '-'}
      </strong>
    </div>
  )
}