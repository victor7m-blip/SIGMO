import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Informe SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente.'
  )
  process.exit(1)
}

const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Troque pelos IDs encontrados em auth.users
const usuarios = [
  {
    nome: 'P4',
    id: 'COLE_AQUI_O_ID_DO_USUARIO_P4',
    senha: '444444'
  },
  {
    nome: 'SVDD',
    id: 'COLE_AQUI_O_ID_DO_USUARIO_SVDD',
    senha: '555555'
  }
]

for (const usuario of usuarios) {
  const { data, error } =
    await supabaseAdmin.auth.admin.updateUserById(
      usuario.id,
      {
        password: usuario.senha
      }
    )

  if (error) {
    console.error(
      `Erro ao atualizar ${usuario.nome}:`,
      error.message
    )
    continue
  }

  console.log(
    `Senha do usuário ${usuario.nome} atualizada com sucesso.`,
    data.user?.id
  )
}