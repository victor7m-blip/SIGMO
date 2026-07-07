import SigmoButton from '../../ui/components/SigmoButton'
import './PatrimonioToolbar.css'

export default function PatrimonioToolbar({
  busca,
  onBuscaChange,
  onNovo,
  placeholder = 'Buscar...'
}) {
  return (
    <div className="patrimonio-toolbar">
      <input
        value={busca}
        onChange={(e) => onBuscaChange(e.target.value)}
        placeholder={placeholder}
      />

      <SigmoButton onClick={onNovo}>
        Novo cadastro
      </SigmoButton>
    </div>
  )
}