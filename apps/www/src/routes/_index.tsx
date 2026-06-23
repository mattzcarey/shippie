import type React from 'react'
import AgentFeatures from '../components/AgentFeatures'
import FaqAccordion from '../components/FaqAccordion'
import Footer from '../components/Footer'
import { Hero } from '../components/Hero'
import CustomNavbar from '../components/Navbar'

const IndexPage: React.FC = () => {
  return (
    <div className="min-h-screen">
      <CustomNavbar />
      <Hero />
      <AgentFeatures />
      <FaqAccordion />
      <Footer />
    </div>
  )
}

export default IndexPage
