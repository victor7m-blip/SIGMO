import painelOperacional from '../assets/painel-operacional.png'
import painelOperacionalMobile from '../assets/painel-operacional-mobile.png'
import {
  Package,
  ArrowDownCircle,
  ArrowUpCircle,
  AlertTriangle,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  ClipboardList
} from 'lucide-react'
import './DashboardV2.css'

export default function DashboardV2() {
  const resumo = [
    {
      titulo: 'Materiais cadastrados',
      icone: Package,
      valor: '124',
      itens: [
        ['Ativos', '118'],
        ['Inativos', '6']
      ]
    },
    {
      titulo: 'Entradas registradas',
      icone: ArrowDownCircle,
      valor: '38',
      itens: [
        ['Hoje', '4'],
        ['Mês atual', '38']
      ]
    },
    {
      titulo: 'Entregas realizadas',
      icone: ArrowUpCircle,
      valor: '57',
      itens: [
        ['Hoje', '3'],
        ['Mês atual', '57']
      ]
    },
    {
      titulo: 'Estoque crítico',
      icone: AlertTriangle,
      valor: '9',
      itens: [
        ['Baixo estoque', '7'],
        ['Sem saldo', '2']
      ]
    },
    {
      titulo: 'Auditoria',
      icone: ShieldCheck,
      valor: '212',
      itens: [
        ['Registros', '212'],
        ['Alertas', '5']
      ]
    }
  ]

  const atividades = [
    {
      tipo: 'Entrada',
      descricao: 'Material lançado no estoque operacional',
      horario: 'Hoje, 14:32',
      status: 'Concluído',
      icone: ArrowDownCircle
    },
    {
      tipo: 'Entrega',
      descricao: 'Material entregue para policial cadastrado',
      horario: 'Hoje, 13:10',
      status: 'Concluído',
      icone: ArrowUpCircle
    },
    {
      tipo: 'Cadastro',
      descricao: 'Novo item incluído no catálogo de materiais',
      horario: 'Ontem, 18:41',
      status: 'Concluído',
      icone: ClipboardList
    },
    {
      tipo: 'Alerta',
      descricao: 'Item atingiu limite mínimo de estoque',
      horario: 'Ontem, 16:05',
      status: 'Atenção',
      icone: AlertTriangle
    }
  ]

  const pendencias = [
    ['Materiais aguardando conferência', '3', 'warning'],
    ['Entregas pendentes de baixa', '2', 'danger'],
    ['Cadastros incompletos', '1', 'warning'],
    ['Sistema operacional', 'Normal', 'success']
  ]

  return (
  <main className="sigmo-dashboard-v2">
    <img
      src={painelOperacional}
      alt="Painel Operacional SIGMO"
      className="sigmo-mockup-image sigmo-desktop"
    />

    <img
      src={painelOperacionalMobile}
      alt="Painel Operacional SIGMO Mobile"
      className="sigmo-mockup-image sigmo-mobile"
    />
  </main>
)
}