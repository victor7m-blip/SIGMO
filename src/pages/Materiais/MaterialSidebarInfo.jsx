export default function MaterialSidebarInfo() {
  return (
    <section className="material-sidebar-info">

      <h2>Orientações</h2>

      <div className="material-info-block">
        <strong>Cadastro de materiais</strong>
        <p>
          Utilize esta área para organizar os materiais permanentes,
          controlados e de consumo da unidade.
        </p>
      </div>

      <div className="material-info-block">
        <strong>Estoque mínimo</strong>
        <p>
          Os alertas serão exibidos quando a quantidade cadastrada estiver
          igual ou inferior ao limite mínimo definido.
        </p>
      </div>

      <div className="material-info-block">
        <strong>Próxima etapa</strong>
        <p>
          Após finalizar a tela, conectaremos os dados à tabela de materiais
          no Supabase.
        </p>
      </div>

    </section>
  )
}