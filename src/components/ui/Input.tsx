import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-lg border border-roll-gray-300 bg-white px-3 py-2 text-sm text-roll-gray-900 placeholder:text-roll-gray-400 focus:border-roll-orange focus:outline-none focus:ring-2 focus:ring-roll-orange/20 ${className}`}
      {...props}
    />
  )
}

export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full rounded-lg border border-roll-gray-300 bg-white px-3 py-2 text-sm text-roll-gray-900 focus:border-roll-orange focus:outline-none focus:ring-2 focus:ring-roll-orange/20 ${className}`}
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
