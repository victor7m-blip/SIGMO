import './SigmoEmpty.css'

export default function SigmoEmpty({ title = 'Nenhum registro encontrado', text = '' }) {
  return (
    <div className="sigmo-empty">
      <strong>{title}</strong>
      {text && <p>{text}</p>}
    </div>
  )
}