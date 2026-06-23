import type React from 'react'
import { Route, Routes } from 'react-router-dom'
import IndexPage from './routes/_index'

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Index Routes */}
      <Route path="/" element={<IndexPage />} />
    </Routes>
  )
}
