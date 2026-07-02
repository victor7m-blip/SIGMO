import { useEffect, useState } from 'react'
import telaPC from '../../assets/SIGMO_04_Cadastro_Materiais.png'
import telaMobile from '../../assets/SIGMO_04_Cadastro_Materiais_Mobile.png'
import './Materiais.css'

export default function Materiais() {
  const [mobile, setMobile] = useState(window.innerWidth <= 768)

  useEffect(() => {
    const resize = () => setMobile(window.innerWidth <= 768)

    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  return (
    <main className="materiais-page">
      <img
        src={mobile ? telaMobile : telaPC}
        alt="Cadastro de Materiais"
        className="materiais-image"
      />
    </main>
  )
}