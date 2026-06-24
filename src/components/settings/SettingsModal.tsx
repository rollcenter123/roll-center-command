import { useState } from 'react'
import { CheckCircle2, Monitor, Moon, Sun, User } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { supabase } from '@/lib/supabase'
import { ROLE_LABELS } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FieldGroup, Input } from '@/components/ui/Input'

type SettingsTab = 'profile' | 'appearance' | 'system'

const tabs: { id: SettingsTab; label: string; icon: typeof User }[] = [
  { id: 'profile', label: 'Perfil', icon: User },
  { id: 'appearance', label: 'Aparência', icon: Sun },
  { id: 'system', label: 'Sistema', icon: Monitor },
]

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, profile } = useAuth()
  const { theme, setTheme } = useTheme()
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)

  const email = profile?.email ?? user?.email ?? ''
  const isEmailVerified = Boolean(user?.email_confirmed_at)

  const handleResendVerification = async () => {
    if (!email || isEmailVerified) return
    setResendLoading(true)
    setResendMessage(null)
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    setResendLoading(false)
    setResendMessage(
      error
        ? error.message
        : 'E-mail de verificação reenviado. Confira sua caixa de entrada.',
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Configurações" size="lg">
      <div className="flex flex-col gap-6 sm:flex-row">
        <nav className="flex shrink-0 gap-1 sm:w-40 sm:flex-col">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === id
                  ? 'bg-roll-orange/10 text-roll-orange'
                  : 'text-roll-gray-600 hover:bg-roll-gray-100 dark:text-roll-gray-300 dark:hover:bg-roll-gray-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1">
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-roll-gray-900 dark:text-white">Seu perfil</h3>
                <p className="text-sm text-roll-gray-500 dark:text-roll-gray-400">
                  Informações da sua conta no Roll Center.
                </p>
              </div>

              <FieldGroup label="Nome">
                <Input readOnly value={profile?.full_name ?? '—'} />
              </FieldGroup>

              <FieldGroup label="Papel">
                <Input readOnly value={profile ? ROLE_LABELS[profile.role] : '—'} />
              </FieldGroup>

              <FieldGroup label="E-mail">
                <Input readOnly value={email || '—'} />
              </FieldGroup>

              <div className="rounded-lg border border-roll-gray-200 bg-roll-gray-50 px-4 py-3 dark:border-roll-gray-600 dark:bg-roll-gray-800/50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-roll-gray-900 dark:text-white">
                      Verificação de e-mail
                    </p>
                    <p className="mt-1 text-xs text-roll-gray-500 dark:text-roll-gray-400">
                      {isEmailVerified
                        ? 'Seu e-mail foi confirmado e está ativo.'
                        : 'Confirme seu e-mail para garantir acesso completo.'}
                    </p>
                  </div>
                  {isEmailVerified ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Verificado
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      Pendente
                    </span>
                  )}
                </div>

                {!isEmailVerified && email && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    loading={resendLoading}
                    onClick={handleResendVerification}
                  >
                    Reenviar e-mail de verificação
                  </Button>
                )}

                {resendMessage && (
                  <p className="mt-2 text-xs text-roll-gray-600 dark:text-roll-gray-300">{resendMessage}</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-roll-gray-900 dark:text-white">Aparência</h3>
                <p className="text-sm text-roll-gray-500 dark:text-roll-gray-400">
                  Escolha o tema visual do sistema.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors ${
                    theme === 'light'
                      ? 'border-roll-orange bg-orange-50 dark:bg-orange-950/30'
                      : 'border-roll-gray-200 hover:border-roll-gray-300 dark:border-roll-gray-600 dark:hover:border-roll-gray-500'
                  }`}
                >
                  <Sun className={`h-6 w-6 ${theme === 'light' ? 'text-roll-orange' : 'text-roll-gray-400'}`} />
                  <span className="text-sm font-medium text-roll-gray-900 dark:text-white">Claro</span>
                  <span className="text-xs text-roll-gray-500 dark:text-roll-gray-400">Padrão atual</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors ${
                    theme === 'dark'
                      ? 'border-roll-orange bg-orange-50 dark:bg-orange-950/30'
                      : 'border-roll-gray-200 hover:border-roll-gray-300 dark:border-roll-gray-600 dark:hover:border-roll-gray-500'
                  }`}
                >
                  <Moon className={`h-6 w-6 ${theme === 'dark' ? 'text-roll-orange' : 'text-roll-gray-400'}`} />
                  <span className="text-sm font-medium text-roll-gray-900 dark:text-white">Escuro</span>
                  <span className="text-xs text-roll-gray-500 dark:text-roll-gray-400">Modo dark</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-roll-gray-900 dark:text-white">Sistema</h3>
                <p className="text-sm text-roll-gray-500 dark:text-roll-gray-400">
                  Informações gerais da plataforma.
                </p>
              </div>

              <dl className="space-y-3 rounded-lg border border-roll-gray-200 bg-roll-gray-50 px-4 py-3 text-sm dark:border-roll-gray-600 dark:bg-roll-gray-800/50">
                <div className="flex justify-between gap-4">
                  <dt className="text-roll-gray-500 dark:text-roll-gray-400">Aplicação</dt>
                  <dd className="font-medium text-roll-gray-900 dark:text-white">Roll Center Command</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-roll-gray-500 dark:text-roll-gray-400">Idioma</dt>
                  <dd className="font-medium text-roll-gray-900 dark:text-white">Português (BR)</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-roll-gray-500 dark:text-roll-gray-400">Fuso horário</dt>
                  <dd className="font-medium text-roll-gray-900 dark:text-white">America/São Paulo</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
