import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input, PasswordInput, FieldGroup } from '@/components/ui/Input'
import { Logo } from '@/components/ui/Logo'

export function LoginPage() {
  const { signIn, session, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session) return <Navigate to="/" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { error: err } = await signIn(email, password)
    if (err) setError(err)
    setSubmitting(false)
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-roll-gray-800 p-12 lg:flex">
        <div className="flex items-center gap-3">
          <Logo size="md" className="bg-white" />
          <div>
            <h1 className="text-2xl font-bold text-white">Roll Center</h1>
            <p className="text-roll-gray-400">Central de Comando</p>
          </div>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-white">
            Gerencie clientes, campanhas e métricas em um só lugar.
          </h2>
          <p className="mt-4 text-roll-gray-400">
            Campanhas de email e WhatsApp em um só lugar.
          </p>
        </div>
        <p className="text-sm text-roll-gray-500">© Roll Center</p>
      </div>

      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <Logo size="md" />
            <div>
              <h1 className="text-xl font-bold text-roll-gray-900">Roll Center</h1>
              <p className="text-sm text-roll-gray-500">Central de Comando</p>
            </div>
          </div>
          <h2 className="mb-2 text-2xl font-bold text-roll-gray-900">Entrar</h2>
          <p className="mb-8 text-roll-gray-500">Acesse sua conta para continuar</p>

          <form onSubmit={handleSubmit}>
            <FieldGroup label="E-mail">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
              />
            </FieldGroup>
            <FieldGroup label="Senha">
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </FieldGroup>

            {error && (
              <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
            )}

            <Button type="submit" className="w-full" loading={submitting}>
              Entrar
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
