export default function WizardHeader({
  titulo,
  subtitulo,
  etapa,
  total
}) {
  return (
    <header className="cadastro-wizard-header">

      <div>

        <h1>{titulo}</h1>

        {subtitulo && (
          <p>{subtitulo}</p>
        )}

      </div>

      <span className="cadastro-wizard-counter">
        {etapa}/{total}
      </span>

    </header>
  )
}