import { useEffect, useState } from 'react'
import {
  STATUS_MANUTENCAO,
  listarFotosManutencao
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

useEffect(() => {
  async function carregarFotos() {
    if (!manutencao?.id) {
      setFotos([])
      return
    }

    try {
      const lista = await listarFotosManutencao(manutencao.id)
      setFotos(lista)
    } catch (erro) {
      console.error(erro)
    }
  }

  carregarFotos()
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
            <h2>{manutencao.tipo_material || 'Material'}</h2>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar">×</button>
        </header>

        <div className="manutencao-drawer-corpo">
          <div className="manutencao-detalhe-foto">
            {(fotos[0]?.foto_url || manutencao.foto_url) ? (
              <img
  src={fotos[0]?.foto_url || manutencao.foto_url}
  alt="Foto da manutenção"
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
          <section className="manutencao-detalhe-grade">
            <section className="manutencao-detalhe-texto">
  <h3>Ocorrência</h3>

  <p>
    <strong>{manutencao.tipo_ocorrencia || 'NÃO INFORMADO'}</strong>
  </p>

  <p style={{marginTop:'8px'}}>
    {manutencao.descricao || 'Nenhuma descrição registrada.'}
  </p>
</section>
            <section className="manutencao-detalhe-texto">
  <h3>Providência</h3>

  <p>
    {manutencao.providencia || 'MANUTENÇÃO'}
  </p>
</section>   
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
              {salvando ? 'Salvando...' : 'Concluir manutenção'}
            </button>
          </footer>
        )}
      </aside>
    </div>
  )
}
