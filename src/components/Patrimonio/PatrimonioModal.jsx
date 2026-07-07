import SigmoButton from '../../ui/components/SigmoButton'
import './PatrimonioModal.css'

export default function PatrimonioModal({
  aberto,
  titulo,
  children,
  onFechar,
  onSalvar,
  salvarTexto = 'Salvar',
  cancelarTexto = 'Cancelar'
}) {
  if (!aberto) return null

  return (
    <div className="patrimonio-modal-backdrop">
      <div className="patrimonio-modal">
        <header>
          <h2>{titulo}</h2>
          <button type="button" onClick={onFechar}>×</button>
        </header>

        <div className="patrimonio-modal-body">
          {children}
        </div>

        <footer>
          <SigmoButton variant="secondary" onClick={onFechar}>
            {cancelarTexto}
          </SigmoButton>

          <SigmoButton onClick={onSalvar}>
            {salvarTexto}
          </SigmoButton>
        </footer>
      </div>
    </div>
  )
}