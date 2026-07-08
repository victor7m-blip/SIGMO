export default {

    modulo: 'armas',

    titulo: 'Armas',

    subtitulo: 'Cadastro de Armas da Unidade',

    patrimonioPrefixo: 'ARM',

    usaFotos: true,

    usaQRCode: true,

    usaMovimentacao: true,

    usaHistorico: true,

    usaAuditoria: true,

    colunas: [

        {
            key: 'patrimonio',
            label: 'Patrimônio'
        },

        {
            key: 'modelo',
            label: 'Modelo'
        },

        {
            key: 'calibre',
            label: 'Calibre'
        },

        {
            key: 'status',
            label: 'Status'
        }

    ]

}