import type React from 'react'
import AgentFeatures from '../components/AgentFeatures'
import FaqAccordion from '../components/FaqAccordion'
import Footer from '../components/Footer'
import { Hero } from '../components/Hero'
import CustomNavbar from '../components/Navbar'

const IndexPage: React.FC = () => {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* ambient background: a soft red glow up top, a faint grid that fades out */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/2 top-[-220px] h-[620px] w-[1000px] -translate-x-1/2 rounded-full bg-red-500/15 blur-[150px]" />
        <div className="absolute inset-0 [background-image:linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_top,black_10%,transparent_65%)]" />
      </div>
      <CustomNavbar />
      <Hero />
      <AgentFeatures />
      <FaqAccordion />
      <Footer />
    </div>
  )
}

export default IndexPage
