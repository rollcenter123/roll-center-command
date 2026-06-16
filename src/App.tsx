import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute, RoleGuard } from '@/components/guards/ProtectedRoute'
import { Layout } from '@/components/layout/Layout'
import { LoginPage } from '@/pages/Login'
import { DashboardPage } from '@/pages/Dashboard'
import { ClientsPage } from '@/pages/Clients'
import { ClientDetailPage } from '@/pages/ClientDetail'
import { ImportClientsPage } from '@/pages/ImportClients'
import { EmailCampaignsPage } from '@/pages/EmailCampaigns'
import { WhatsAppCampaignsPage } from '@/pages/WhatsAppCampaigns'
import { MetricsPage } from '@/pages/Metrics'
import { IntegrationsPage } from '@/pages/Integrations'
import { TeamPage } from '@/pages/Team'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<DashboardPage />} />
              <Route path="clientes" element={<ClientsPage />} />
              <Route path="clientes/:id" element={<ClientDetailPage />} />
              <Route path="clientes/importar" element={
                <RoleGuard roles={['admin', 'operator']}><ImportClientsPage /></RoleGuard>
              } />
              <Route path="campanhas/email" element={<EmailCampaignsPage />} />
              <Route path="campanhas/whatsapp" element={<WhatsAppCampaignsPage />} />
              <Route path="metricas" element={<MetricsPage />} />
              <Route path="integracoes" element={
                <RoleGuard roles={['admin']}><IntegrationsPage /></RoleGuard>
              } />
              <Route path="equipe" element={
                <RoleGuard roles={['admin']}><TeamPage /></RoleGuard>
              } />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
