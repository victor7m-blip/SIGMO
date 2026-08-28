import { useEffect, useState } from 'react'
import {
  STATUS_MANUTENCAO,
  listarFotosManutencao,
  buscarNovidadePatrimonialDaManutencao
} from '../../../services/manutencoesService'
import {
  buscarHistoricoManutencaoExterna
} from '../../../services/manutencoesExternasService'

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
  onEncaminharP4,
  onEnviarManutencaoExterna,
  user,
  salvando
}) {
  const [observacoes, setObservacoes] = useState('')
  const [fotos, setFotos] = useState([])
  const [novidadeUsuario, setNovidadeUsuario] = useState(null)
  const [fotosUsuario, setFotosUsuario] = useState([])
  const [fotoAmpliada, setFotoAmpliada] = useState(null)
  const [historicoExterno, setHistoricoExterno] = useState(null)

  useEffect(() => {
    async function carregarHistorico() {
      if (!manutencao?.id) {
        setFotos([])
        setNovidadeUsuario(null)
        setFotosUsuario([])
        setHistoricoExterno(null)
        return
      }

      try {
        const [
          fotosManutencao,
          registroUsuario,
          registroExterno
        ] = await Promise.all([
          listarFotosManutencao(manutencao.id),
          buscarNovidadePatrimonialDaManutencao(manutencao),
          buscarHistoricoManutencaoExterna(manutencao.id)
        ])

        setFotos(fotosManutencao || [])
        setNovidadeUsuario(registroUsuario?.novidade || null)
        setFotosUsuario(registroUsuario?.fotos || [])
        setHistoricoExterno(registroExterno || null)
      } catch (erro) {
        console.error('Erro ao carregar histórico completo da manutenção:', erro)
        setFotos([])
        setNovidadeUsuario(null)
        setFotosUsuario([])
        setHistoricoExterno(null)
      }
    }

    carregarHistorico()
  }, [manutencao])

if (!manutencao) return null

  const ativa = manutencao.status === STATUS_MANUTENCAO.EM_MANUTENCAO

  const statusExterno = String(
    historicoExterno?.status || ''
  ).trim().toUpperCase()

  const emManutencaoExterna =
    Boolean(historicoExterno) &&
    ['APROVADA', 'EM_MANUTENCAO_EXTERNA'].includes(statusExterno)

  const manutencaoInternaAtiva =
    ativa && !emManutencaoExterna

  const temSolicitacaoExternaAtiva =
    Boolean(manutencao?.manutencao_externa) ||
    (Boolean(historicoExterno) &&
      !['CONCLUIDA', 'CANCELADA', 'REPROVADA', 'RETORNADA'].includes(statusExterno))

  const perfilUsuario = String(
    user?.perfil_efetivo || user?.perfil || user?.role || user?.tipo_perfil || ''
  ).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase()

  const origemInstitucional = String(
    manutencao?.origem_institucional ||
    manutencao?.origem_institucional_local ||
    manutencao?.origem ||
    ''
  ).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase()

  const podeEncaminharP4 =
    manutencaoInternaAtiva &&
    manutencao.modulo === 'HT' &&
    (perfilUsuario.includes('SVDD') || perfilUsuario.includes('SERVICO DE DIA')) &&
    (origemInstitucional.includes('SVDD') || origemInstitucional.includes('SERVICO DE DIA'))

  const podeEnviarManutencaoExterna =
    manutencaoInternaAtiva &&
    !temSolicitacaoExternaAtiva &&
    manutencao.modulo === 'HT' &&
    perfilUsuario.includes('P4') &&
    origemInstitucional.includes('P4')

  const podeRegistrarRetornoExterno =
    ativa &&
    emManutencaoExterna &&
    manutencao.modulo === 'HT' &&
    perfilUsuario.includes('P4') &&
    Boolean(historicoExterno?.id)

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
            <span>
              {emManutencaoExterna
                ? 'MANUTENÇÃO EXTERNA'
                : 'CENTRAL DE MANUTENÇÕES'}
            </span>
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

          {historicoExterno && (
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
              <h3>Histórico P4 / manutenção externa</h3>

              {historicoExterno?.recebimento_p4 && (
                <div style={{ marginTop: '12px' }}>
                  <strong>1. Recebimento pelo P4</strong>
                  <p style={{ marginTop: '4px' }}>
                    Recebido no sistema por{' '}
                    <strong>
                      {historicoExterno.recebimento_p4.aceito_por_nome ||
                        historicoExterno.recebimento_p4.executado_por_nome ||
                        'P4'}
                    </strong>
                    {' · '}
                    {dataHora(
                      historicoExterno.recebimento_p4.data_recebimento
                    )}
                  </p>
                  <p>
                    {historicoExterno.recebimento_p4.local_origem || 'Origem não informada'}
                    {' → '}
                    {historicoExterno.recebimento_p4.local_destino || 'P4'}
                  </p>
                  {historicoExterno.recebimento_p4.protocolo && (
                    <p>Movimentação: <strong>{historicoExterno.recebimento_p4.protocolo}</strong></p>
                  )}
                </div>
              )}

              <div style={{ marginTop: '14px' }}>
                <strong>2. Solicitação de manutenção externa pelo P4</strong>
                <p style={{ marginTop: '4px' }}>
                  {historicoExterno.solicitada_por_nome || 'P4'}
                  {' · '}
                  {dataHora(historicoExterno.solicitada_em)}
                </p>
                <p>
                  Destino: <strong>{historicoExterno.destino_nome || 'Não informado'}</strong>
                </p>
                {historicoExterno.destino_tipo && (
                  <p>Tipo: {historicoExterno.destino_tipo}</p>
                )}
                {historicoExterno.destino_contato && (
                  <p>Contato: {historicoExterno.destino_contato}</p>
                )}
                {historicoExterno.motivo && (
                  <p>Motivo: {historicoExterno.motivo}</p>
                )}
                {historicoExterno.servico_solicitado && (
                  <p>Serviço solicitado: {historicoExterno.servico_solicitado}</p>
                )}
              </div>

              <div style={{ marginTop: '14px' }}>
                <strong>3. Documento de encaminhamento</strong>
                <p style={{ marginTop: '4px' }}>
                  Tipo: <strong>{historicoExterno.tipo_documento || 'Não informado'}</strong>
                </p>
                <p>
                  Número: <strong>{historicoExterno.numero_documento || historicoExterno.destino_documento || 'Não informado'}</strong>
                </p>
                <p>Data: {historicoExterno.data_documento
                  ? new Intl.DateTimeFormat('pt-BR').format(new Date(`${historicoExterno.data_documento}T12:00:00`))
                  : 'Não informada'}
                </p>
                {historicoExterno.protocolo && (
                  <p>Protocolo SIGMO: <strong>{historicoExterno.protocolo}</strong></p>
                )}
              </div>

              <div style={{ marginTop: '14px' }}>
                <strong>4. Encaminhado para aprovação do Cmt de Cia</strong>
                <p style={{ marginTop: '4px' }}>
                  {dataHora(historicoExterno.solicitada_em)}
                </p>
              </div>

              {historicoExterno.decidida_em && (
                <div style={{ marginTop: '14px' }}>
                  <strong>5. Decisão do Cmt de Cia</strong>
                  <p style={{ marginTop: '4px' }}>
                    <strong>
                      {String(
                        historicoExterno.decisao ||
                        historicoExterno.status ||
                        ''
                      ).replaceAll('_', ' ')}
                    </strong>
                    {' · '}
                    {historicoExterno.decidida_por_nome || 'Cmt de Cia'}
                    {' · '}
                    {dataHora(historicoExterno.decidida_em)}
                  </p>
                  {historicoExterno.decisao_observacoes && (
                    <p>Observações: {historicoExterno.decisao_observacoes}</p>
                  )}
                </div>
              )}

              {['APROVADA', 'EM_MANUTENCAO_EXTERNA'].includes(
                String(historicoExterno.status || '').toUpperCase()
              ) && (
                <div style={{ marginTop: '14px' }}>
                  <strong>6. Situação atual</strong>
                  <p style={{ marginTop: '4px' }}>
                    <strong>MANUTENÇÃO EXTERNA</strong>
                    {' · '}
                    {historicoExterno.destino_nome || 'Destino não informado'}
                  </p>
                  {historicoExterno.previsao_retorno && (
                    <p>
                      Previsão de retorno: {dataHora(historicoExterno.previsao_retorno)}
                    </p>
                  )}
                </div>
              )}

              {historicoExterno.retornada_em && (
                <div style={{ marginTop: '14px' }}>
                  <strong>6. Retorno da manutenção externa</strong>
                  <p style={{ marginTop: '4px' }}>
                    Recebido por <strong>{historicoExterno.retornada_por_nome || 'P4'}</strong>
                    {' · '}
                    {dataHora(historicoExterno.retornada_em)}
                  </p>
                  {historicoExterno.servico_executado && (
                    <p>Serviço executado: {historicoExterno.servico_executado}</p>
                  )}
                  {historicoExterno.observacoes_retorno && (
                    <p>Observações do retorno: {historicoExterno.observacoes_retorno}</p>
                  )}
                </div>
              )}
            </section>
          )}

          <section className="manutencao-detalhe-grade">
            <div><span>Módulo</span><strong>{manutencao.modulo || 'OUTROS'}</strong></div>
            <div>
              <span>Status</span>
              <strong>
                {emManutencaoExterna
                  ? 'MANUTENÇÃO EXTERNA'
                  : String(manutencao.status || '').replaceAll('_', ' ')}
              </strong>
            </div>
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

          {(manutencaoInternaAtiva || podeRegistrarRetornoExterno) && (
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

        {(manutencaoInternaAtiva || podeRegistrarRetornoExterno) && (
          <footer>
            {podeRegistrarRetornoExterno ? (
              <button
                type="button"
                className="manutencoes-btn-primario"
                disabled={salvando}
                onClick={() =>
                  onConcluir(observacoes, {
                    manutencaoExternaAtiva: true,
                    manutencaoExternaId: historicoExterno.id
                  })
                }
              >
                {salvando ? 'Registrando retorno...' : 'Registrar retorno da manutenção externa'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="manutencoes-btn-perigo"
                  disabled={salvando}
                  onClick={() => onCancelar(observacoes)}
                >
                  Cancelar manutenção
                </button>

                {podeEncaminharP4 && (
                  <button
                    type="button"
                    className="manutencoes-btn-secundario"
                    disabled={salvando}
                    onClick={() => onEncaminharP4?.(observacoes)}
                  >
                    {salvando ? 'Encaminhando...' : 'Encaminhar ao P4'}
                  </button>
                )}

                {podeEnviarManutencaoExterna && (
                  <button
                    type="button"
                    className="manutencoes-btn-secundario"
                    disabled={salvando}
                    onClick={() => onEnviarManutencaoExterna?.()}
                  >
                    Enviar para manutenção externa
                  </button>
                )}

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
              </>
            )}
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
