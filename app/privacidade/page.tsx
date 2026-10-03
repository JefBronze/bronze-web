import type { Metadata } from 'next'
import Link from 'next/link'
import { BRONZE_URL } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Política de privacidade — Data Joule',
  description: 'O observatório Data Joule não usa cookies nem formulários; só contagens anônimas de visitas. Controlador: Bronze Engenharia de Energia.',
  alternates: { canonical: '/privacidade' },
}

const UPDATED = '3 de outubro de 2026'
const EMAIL = 'contato@data-joule.com'

export default function PrivacyPage() {
  return (
    <main className="wrap legal">
      <p className="kick">
        <Link href="/">← Data Joule</Link>
      </p>
      <h1 className="h2">Política de privacidade</h1>
      <p className="legalmeta">Última atualização: {UPDATED}</p>

      <p>
        Este site é um observatório de dados públicos de energia. Ele não tem formulários, não pede cadastro e não usa
        cookies. Esta política explica o pouco que é tratado, conforme a Lei Geral de Proteção de Dados (Lei nº
        13.709/2018, LGPD).
      </p>

      <h2>1. Quem é o controlador</h2>
      <p>
        Bronze Engenharia de Energia, CNPJ 19.824.419/0001-96, Curitiba/PR, que mantém a marca Data Joule. Encarregado
        pelo tratamento de dados (DPO): Jeferson Bronze, pelo e-mail <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
      </p>

      <h2>2. O que é coletado</h2>
      <ul>
        <li>
          <strong>Dados de navegação agregados</strong>, pela Vercel Analytics e Speed Insights, sem cookies e sem
          identificar o visitante: páginas vistas, país, tipo de dispositivo e medidas de desempenho. Base legal: legítimo
          interesse em manter o site rápido e útil (art. 7º, IX).
        </li>
        <li>
          <strong>Registros técnicos</strong> da hospedagem (Vercel), como endereço IP e horário de acesso, guardados pelo
          provedor por segurança e pelo prazo que ele define.
        </li>
        <li>
          A preferência de tema claro ou escuro, se você escolher uma, fica só no seu navegador (armazenamento local) e
          nunca é enviada ao servidor.
        </li>
      </ul>
      <p>
        Os gráficos são montados no servidor a partir de fontes públicas (ONS, ANEEL, CCEE, ANP, Banco Central e outras
        citadas em cada seção). Seu navegador não fala com essas fontes.
      </p>

      <h2>3. Se você entrar em contato</h2>
      <p>
        Mensagens por e-mail ou WhatsApp são usadas só para responder e guardadas por até 12 meses após a última
        interação. Faturas de energia enviadas para auditoria seguem a política da{' '}
        <a className="bz" href={`${BRONZE_URL}/privacidade`}>
          Bronze Engenharia
        </a>
        .
      </p>

      <h2>4. Seus direitos</h2>
      <p>
        Você pode pedir confirmação, acesso, correção ou exclusão dos seus dados, e informações sobre o compartilhamento,
        pelo e-mail <a href={`mailto:${EMAIL}`}>{EMAIL}</a>. Também pode reclamar à Autoridade Nacional de Proteção de
        Dados (ANPD).
      </p>
    </main>
  )
}
