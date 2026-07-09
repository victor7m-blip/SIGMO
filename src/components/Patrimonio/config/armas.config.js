import {
  listarFotosArma,
  uploadFotoArma,
  excluirFotoArma,
  definirFotoPrincipalArma
} from '../../../services/armasFotosService'

export default {
  modulo: 'armas',
  tabela: 'sigmo_armas',

  titulo: 'Armas',
  subtitulo: 'Cadastro e controle patrimonial de armas.',
  nomeSingular: 'Arma',
  nomePlural: 'Armas',
  campoTitulo: 'patrimonio',

  fotos: {
    listar: listarFotosArma,
    upload: uploadFotoArma,
    excluir: excluirFotoArma,
    definirPrincipal: definirFotoPrincipalArma
  },

  colunas: [
    { key: 'patrimonio', label: 'Patrimônio' },
    { key: 'numero_serie', label: 'Nº de série' },
    { key: 'modelo', label: 'Modelo' },
    { key: 'status', label: 'Status' }
  ],

  campos: [
    { name: 'patrimonio', label: 'Patrimônio' },
    { name: 'numero_serie', label: 'Nº de série' },
    { name: 'especie', label: 'Espécie' },
    { name: 'marca', label: 'Marca' },
    { name: 'modelo', label: 'Modelo' },
    { name: 'calibre', label: 'Calibre' },
    { name: 'status', label: 'Status' },
    { name: 'local_atual', label: 'Local atual' },
    { name: 'observacoes', label: 'Observações' }
  ]
}