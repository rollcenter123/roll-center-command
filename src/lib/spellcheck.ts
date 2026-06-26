interface LanguageToolMatch {
  offset: number
  length: number
  replacements?: { value: string }[]
}

interface LanguageToolResponse {
  matches?: LanguageToolMatch[]
}

/** Abreviações comuns de WhatsApp antes da API LanguageTool. */
function normalizeChatAbbreviations(text: string): string {
  const rules: [RegExp, string][] = [
    [/\bcmo\b/gi, 'como'],
    [/\bvc\b/gi, 'você'],
    [/\btb\b/gi, 'também'],
    [/\btbm\b/gi, 'também'],
    [/\bpq\b/gi, 'porque'],
    [/\bq\b/gi, 'que'],
    [/\bn\b/gi, 'não'],
    [/\bta\b/gi, 'está'],
    [/\bto\b/gi, 'estou'],
    [/\bblz\b/gi, 'beleza'],
    [/\bobg\b/gi, 'obrigado'],
    [/\bvlw\b/gi, 'valeu'],
  ]

  let result = text
  for (const [pattern, replacement] of rules) {
    result = result.replace(pattern, replacement)
  }
  return result
}

function capitalizeSentences(text: string): string {
  return text.replace(/(?:^|[.!?]\s+)([a-záàâãéêíóôõúç])/gi, (match, letter: string) =>
    match.replace(letter, letter.toUpperCase()),
  )
}

/** Tom cordial profissional — mantém a ideia, suaviza gírias. */
function formalizeCordially(text: string): string {
  const rules: [RegExp, string][] = [
    [/\boi\b/gi, 'Olá'],
    [/\be aí\b/gi, 'Olá'],
    [/\bfalae?\b/gi, 'Olá'],
    [/\bbeleza\b/gi, 'certo'],
    [/\bblz\b/gi, 'certo'],
    [/\bvaleu\b/gi, 'obrigado'],
    [/\bobg\b/gi, 'obrigado'],
    [/\bme manda\b/gi, 'poderia me enviar'],
    [/\bmanda (?:aí|ai)\b/gi, 'poderia enviar'],
    [/\btá bom\b/gi, 'está bem'],
    [/\btá ok\b/gi, 'está bem'],
    [/\bné\?/gi, '?'],
    [/\bné\b/gi, ''],
    [/\bvc\b/gi, 'você'],
  ]

  let result = text
  for (const [pattern, replacement] of rules) {
    result = result.replace(pattern, replacement)
  }

  return result.replace(/\s{2,}/g, ' ').replace(/\s+([?!.,])/g, '$1').trim()
}

export async function correctPortugueseText(text: string): Promise<string> {
  const res = await fetch('https://api.languagetool.org/v2/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      text,
      language: 'pt-BR',
      enabledOnly: 'false',
    }),
  })

  if (!res.ok) {
    throw new Error('Spell check request failed')
  }

  const data = (await res.json()) as LanguageToolResponse
  const matches = [...(data.matches ?? [])]
    .filter((match) => match.replacements?.[0]?.value)
    .sort((a, b) => b.offset - a.offset)

  let corrected = text
  for (const match of matches) {
    const replacement = match.replacements![0].value
    corrected =
      corrected.slice(0, match.offset) +
      replacement +
      corrected.slice(match.offset + match.length)
  }

  return corrected
}

export async function correctChatMessage(text: string): Promise<string> {
  const normalized = normalizeChatAbbreviations(text.trim())
  let corrected = normalized

  try {
    corrected = await correctPortugueseText(normalized)
  } catch {
    corrected = normalized
  }

  return formalizeCordially(capitalizeSentences(corrected))
}
