import { useCallback, useState, type ChangeEvent, type DragEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, FileSpreadsheet } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
  parseClientsSpreadsheet,
  type ImportClientRow,
  type ImportClientsResult,
} from '@/lib/import-clients'

interface ClientImportPanelProps {
  onClose?: () => void
}

export function ClientImportPanel({ onClose }: ClientImportPanelProps) {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportClientRow[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [result, setResult] = useState<ImportClientsResult | null>(null)

  const resetSelection = () => {
    setFile(null)
    setPreview([])
    setTotalRows(0)
    setResult(null)
  }

  const loadFile = useCallback(async (selected: File) => {
    setFile(selected)
    setResult(null)
    const rows = await parseClientsSpreadsheet(selected)
    setTotalRows(rows.length)
    setPreview(rows.slice(0, 10))
    return rows
  }, [])

  const handleDrop = useCallback(async (event: DragEvent) => {
    event.preventDefault()
    const selected = event.dataTransfer.files[0]
    if (selected) await loadFile(selected)
  }, [loadFile])

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0]
    event.target.value = ''
    if (selected) await loadFile(selected)
  }

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Nenhum arquivo selecionado')
      const rows = await parseClientsSpreadsheet(file)
      const { data, error } = await supabase.functions.invoke('import-clients', {
        body: { clients: rows },
      })
      if (error) throw error
      return data as ImportClientsResult
    },
    onSuccess: (data) => {
      setResult(data)
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })

  return (
    <div className="space-y-6">
      <Card>
        <div
          onDrop={handleDrop}
          onDragOver={(event) => event.preventDefault()}
          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-roll-gray-300 bg-roll-gray-50 p-12 transition-colors hover:border-roll-orange"
        >
          <Upload className="mb-4 h-12 w-12 text-roll-gray-400" />
          <p className="mb-2 text-lg font-medium text-roll-gray-700">Arraste sua planilha aqui</p>
          <p className="mb-4 text-sm text-roll-gray-400">ou clique para selecionar (.xlsx, .xls, .csv)</p>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            className="hidden"
            id="clients-file-upload"
          />
          <label
            htmlFor="clients-file-upload"
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-roll-gray-300 px-4 py-2 text-sm font-medium text-roll-gray-700 transition-colors hover:bg-roll-gray-50"
          >
            Selecionar arquivo
          </label>
          {file && (
            <p className="mt-4 flex items-center gap-2 text-sm text-roll-gray-600">
              <FileSpreadsheet className="h-4 w-4" />
              {file.name} — {totalRows > 0 ? `${totalRows} registros detectados` : 'processando...'}
            </p>
          )}
        </div>
      </Card>

      {preview.length > 0 && (
        <Card title="Pré-visualização (10 primeiros)">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-roll-gray-500">
                  <th className="pb-2">Nome</th>
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Telefone</th>
                  <th className="pb-2">Empresa</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, index) => (
                  <tr key={index} className="border-b border-roll-gray-100">
                    <td className="py-2">{row.name}</td>
                    <td className="py-2">{row.email ?? '—'}</td>
                    <td className="py-2">{row.phone ?? '—'}</td>
                    <td className="py-2">{row.company ?? '—'}</td>
                    <td className="py-2">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={resetSelection}>
              Limpar
            </Button>
            <Button onClick={() => importMutation.mutate()} loading={importMutation.isPending}>
              Importar clientes
            </Button>
          </div>
        </Card>
      )}

      {result && (
        <Card title="Resultado da importação">
          <div className="space-y-2 text-sm">
            <p className="text-green-600">✓ {result.imported} clientes importados</p>
            <p className="text-roll-gray-500">{result.skipped} ignorados (duplicatas)</p>
            {result.errors.length > 0 && (
              <div className="mt-4">
                <p className="font-medium text-red-600">Erros:</p>
                <ul className="mt-2 list-disc pl-5 text-red-500">
                  {result.errors.slice(0, 10).map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="secondary" onClick={resetSelection}>
              Importar outro arquivo
            </Button>
            {onClose && (
              <Button variant="outline" onClick={onClose}>
                Fechar
              </Button>
            )}
          </div>
        </Card>
      )}

      <Card title="Colunas suportadas">
        <p className="text-sm text-roll-gray-600">
          Nome, Email, Telefone, Empresa, Status (lead/contatado/convertido/inativo), Origem, Observações.
          Colunas extras serão salvas em campos personalizados.
        </p>
      </Card>
    </div>
  )
}
