import type React from 'react'
import AgentFeatures from '../components/AgentFeatures'
import FaqAccordion from '../components/FaqAccordion'
import Footer from '../components/Footer'
import { Hero } from '../components/Hero'
import CustomNavbar from '../components/Navbar'

const IndexPage: React.FC = () => {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* ambient background: a soft warm signal glow up top — kept minimal */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/2 top-[-280px] h-[640px] w-[1100px] -translate-x-1/2 rounded-full bg-signal/8 blur-[170px]" />
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
