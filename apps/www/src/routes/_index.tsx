import type React from 'react'
import AgentFeatures from '../components/AgentFeatures'
import FaqAccordion from '../components/FaqAccordion'
import Footer from '../components/Footer'
import { Hero } from '../components/Hero'
import CustomNavbar from '../components/Navbar'

const IndexPage: React.FC = () => {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* ambient background: vermilion signal glow + a blueprint grid that fades out */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/2 top-[-260px] h-[680px] w-[1100px] -translate-x-1/2 rounded-full bg-signal/12 blur-[160px]" />
        <div className="absolute inset-0 [background-image:linear-gradient(to_right,rgba(236,230,218,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(236,230,218,0.05)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black_5%,transparent_60%)]" />
        <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-background to-transparent" />
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
