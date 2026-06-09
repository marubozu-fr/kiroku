import { Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/AppLayout/AppLayout'
import { AnalyticsPage } from '@/pages/AnalyticsPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { JournalPage } from '@/pages/JournalPage'
import { ProjectionsPage } from '@/pages/ProjectionsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { TradeDetailPage } from '@/pages/TradeDetailPage'
import { TradeFormPage } from '@/pages/TradeFormPage'

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="journal" element={<JournalPage />} />
        <Route path="journal/new" element={<TradeFormPage />} />
        <Route path="journal/:id" element={<TradeDetailPage />} />
        <Route path="journal/:id/edit" element={<TradeFormPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="projections" element={<ProjectionsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
