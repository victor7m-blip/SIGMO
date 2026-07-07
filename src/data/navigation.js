import {
  Shield,
  Users,
  Boxes,
  ClipboardCheck,
  FileText,
  Activity
} from 'lucide-react'

export const NAV = [
  { id: 'dashboard', label: 'Painel Operacional', icon: Shield },
  { id: 'usuarios', label: 'Usuários', icon: Users },
  { id: 'materiais', label: 'Materiais', icon: Boxes },
  { id: 'entrega', label: 'Entrega', icon: ClipboardCheck },
  { id: 'relatorios', label: 'Relatórios', icon: FileText },
  { id: 'auditoria', label: 'Auditoria', icon: Activity }
]