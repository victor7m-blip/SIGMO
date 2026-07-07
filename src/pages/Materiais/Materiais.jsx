import { useEffect, useState } from 'react'

import telaPC from '../../assets/SIGMO_04_Cadastro_Materiais.png'
import telaMobile from '../../assets/SIGMO_04_Cadastro_Materiais_Mobile.png'

import PageHeader from '../../components/ui/PageHeader/PageHeader'
import Section from '../../components/ui/Section/Section'
import Card from '../../components/ui/Card/Card'
import Button from '../../components/ui/Button/Button'

import './Materiais.css'

export default function Materiais() {

  const [mobile, setMobile] = useState(window.innerWidth <= 768)

  useEffect(() => {

    function resize() {
      setMobile(window.innerWidth <= 768)
    }

    window.addEventListener('resize', resize)

    return () => window.removeEventListener('resize', resize)

  }, [])

  return (

    <main className="materiais-page">

      <PageHeader
        title="Materiais"
        subtitle="Cadastro Patrimonial SIGMO"
      >

        <Button>
          Novo Material
        </Button>

      </PageHeader>

      <Section
        title="Protótipo da tela"
        subtitle="Layout definitivo da tela de cadastro de materiais."
      >

        <Card>

          <img
            src={mobile ? telaMobile : telaPC}
            alt="Cadastro de Materiais"
            className="materiais-image"
          />

        </Card>

      </Section>

    </main>

  )

}