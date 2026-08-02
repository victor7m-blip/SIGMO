import { useEffect, useMemo, useState } from 'react'

import '../styles/HTRetornoManutencaoModal.css'

function dataHoraAtual() {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date())
}

export default function HTRetornoManutencaoModal({
  contexto,
  salvando = false,
  onClose,
  onConfirm
}) {
  const [servicoExecutado, setServicoExecutado] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [fotos, setFotos] = useState([])
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!contexto) return
    setServicoExecutado('')
    setObservacoes('')
    setFotos([])
    setErro('')
  }, [contexto])

  const previews = useMemo(
    () => fotos.map((arquivo) => ({ arquivo, url: URL.createObjectURL(arquivo) })),
    [fotos]
  )

  useEffect(() => () => previews.forEach((item) => URL.revokeObjectURL(item.url)), [previews])

  if (!contexto) return null

  const { ht, manutencao } = contexto
  const identificacao = ht?.patrimonio || ht?.numero_serie || 'HT'
  const localRetorno = String(ht?.local_atual || '').toUpperCase().includes('SVDD')
    ? 'COFRE DO SVDD'
    : 'DEPÓSITO P4'

  function selecionarFotos(event) {
    const arquivos = Array.from(event.target.files || [])
    const invalidos = arquivos.filter((arquivo) => !arquivo.type?.startsWith('image/'))
    const grandes = arquivos.filter((arquivo) => Number(arquivo.size || 0) > 5 * 1024 * 1024)

    if (invalidos.length) {
      setErro('Selecione somente arquivos de imagem.')
      return
    }

    if (grandes.length) {
      setErro('Cada foto deve possuir no máximo 5 MB.')
      return
    }

    setErro('')
    setFotos(arquivos.slice(0, 6))
  }

  async function confirmar(event) {
    event.preventDefault()

    if (!servicoExecutado.trim()) {
      setErro('Informe o serviço executado ou a solução adotada.')
      return
    }

    setErro('')
    await onConfirm?.({
      servicoExecutado: servicoExecutado.trim(),
      observacoes: observacoes.trim(),
      fotos
    })
  }

  return (
    <div className="ht-retorno-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !salvando) onClose?.()
    }}>
      <form className="ht-retorno-modal" onSubmit={confirmar}>
        <header>
          <div>
            <span>RETORNO DA MANUTENÇÃO</span>
            <h2>Tornar HT disponível</h2>
            <p>{identificacao} · retorno previsto para {localRetorno}</p>
          </div>
          <button type="button" onClick={onClose} disabled={salvando} aria-label="Fechar">×</button>
        </header>

        <div className="ht-retorno-corpo">
          <section className="ht-retorno-resumo">
            <div><span>Equipamento</span><strong>{identificacao}</strong></div>
            <div><span>Data e hora do retorno</span><strong>{dataHoraAtual()}</strong></div>
            <div><span>Guardião atual</span><strong>{ht?.local_atual || '—'}</strong></div>
            <div><span>Status final</span><strong>RESERVA / DISPONÍVEL</strong></div>
          </section>

          <section className="ht-retorno-ocorrencia">
            <span>Ocorrência de entrada</span>
            <strong>{manutencao?.tipo_novidade || 'MANUTENÇÃO'}</strong>
            <p>{manutencao?.descricao || 'Sem descrição registrada.'}</p>
          </section>

          <label>
            <span>Serviço executado *</span>
            <textarea
              rows="3"
              value={servicoExecutado}
              onChange={(event) => setServicoExecutado(event.target.value.toUpperCase())}
              placeholder="Ex.: TROCA DO PTT, LIMPEZA DOS CONTATOS E TESTE OPERACIONAL"
              disabled={salvando}
            />
          </label>

          <label>
            <span>Observações do retorno</span>
            <textarea
              rows="3"
              value={observacoes}
              onChange={(event) => setObservacoes(event.target.value.toUpperCase())}
              placeholder="Condição final, testes realizados e demais informações."
              disabled={salvando}
            />
          </label>

          <label className="ht-retorno-fotos-input">
            <span>Fotos do retorno</span>
            <input type="file" accept="image/*" multiple onChange={selecionarFotos} disabled={salvando} />
            <small>Até 6 imagens, com no máximo 5 MB cada. Estas fotos ficam separadas das fotos de entrada.</small>
          </label>

          {previews.length > 0 && (
            <div className="ht-retorno-previews">
              {previews.map((item, index) => (
                <img key={`${item.arquivo.name}-${index}`} src={item.url} alt={`Foto de retorno ${index + 1}`} />
              ))}
            </div>
          )}

          {erro && <div className="ht-retorno-erro">{erro}</div>}
        </div>

        <footer>
          <button type="button" className="ht-btn-secondary" onClick={onClose} disabled={salvando}>Fechar</button>
          <button type="submit" className="ht-btn-primary" disabled={salvando}>
            {salvando ? 'Registrando retorno...' : 'Tornar disponível'}
          </button>
        </footer>
      </form>
    </div>
  )
}
