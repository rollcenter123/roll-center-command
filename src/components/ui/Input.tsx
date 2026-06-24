import { useState, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-lg border border-roll-gray-300 bg-white px-3 py-2 text-sm text-roll-gray-900 placeholder:text-roll-gray-400 focus:border-roll-orange focus:outline-none focus:ring-2 focus:ring-roll-orange/20 dark:border-roll-gray-600 dark:bg-roll-gray-800 dark:text-white dark:placeholder:text-roll-gray-500 ${className}`}
      {...props}
    />
  )
}

export function PasswordInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        className={`w-full rounded-lg border border-roll-gray-300 bg-white px-3 py-2 pr-10 text-sm text-roll-gray-900 placeholder:text-roll-gray-400 focus:border-roll-orange focus:outline-none focus:ring-2 focus:ring-roll-orange/20 dark:border-roll-gray-600 dark:bg-roll-gray-800 dark:text-white dark:placeholder:text-roll-gray-500 ${className}`}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-roll-gray-400 hover:bg-roll-gray-100 hover:text-roll-gray-600"
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        tabIndex={-1}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full rounded-lg border border-roll-gray-300 bg-white px-3 py-2 text-sm text-roll-gray-900 focus:border-roll-orange focus:outline-none focus:ring-2 focus:ring-roll-orange/20 dark:border-roll-gray-600 dark:bg-roll-gray-800 dark:text-white ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-lg border border-roll-gray-300 bg-white px-3 py-2 text-sm text-roll-gray-900 placeholder:text-roll-gray-400 focus:border-roll-orange focus:outline-none focus:ring-2 focus:ring-roll-orange/20 ${className}`}
      {...props}
    />
  )
}

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-roll-gray-700">
      {children}
    </label>
  )
}

export function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
