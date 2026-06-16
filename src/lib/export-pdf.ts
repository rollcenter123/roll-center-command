import html2canvas from 'html2canvas-pro'
import jsPDF from 'jspdf'

function formatDateInputValue(value: string): string {
  if (!value) return '—'
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`
}

function replaceDateInputsForExport(root: ParentNode) {
  root.querySelectorAll<HTMLInputElement>('input[type="date"]').forEach((input) => {
    const exportLabel =
      input.dataset.exportDate || formatDateInputValue(input.value)
    const display = input.ownerDocument.createElement('div')
    display.textContent = exportLabel
    display.className = input.className
    display.style.display = 'flex'
    display.style.alignItems = 'center'
    display.style.minHeight = '2.5rem'
    display.style.backgroundColor = '#ffffff'
    display.style.color = '#111827'
    input.replaceWith(display)
  })
}

function prepareCloneForExport(clonedDoc: Document) {
  replaceDateInputsForExport(clonedDoc.body)
}

export async function exportElementToPdf(element: HTMLElement, filename: string) {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#f3f4f6',
    logging: false,
    onclone: (clonedDoc) => prepareCloneForExport(clonedDoc),
  })

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const imgHeight = (canvas.height * pageWidth) / canvas.width

  let heightLeft = imgHeight
  let position = 0

  pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight)
  heightLeft -= pageHeight

  while (heightLeft > 0) {
    position = heightLeft - imgHeight
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight)
    heightLeft -= pageHeight
  }

  pdf.save(filename)
}
