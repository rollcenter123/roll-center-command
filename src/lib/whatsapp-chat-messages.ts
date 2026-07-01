/** Mensagens do chat no estilo WhatsApp Web */
export const WA_CHAT = {
  connection: {
    noInternet:
      'Não foi possível conectar. Verifique sua conexão com a internet e tente novamente.',
    phoneNotConnected:
      'Telefone não conectado. Verifique se o aparelho está conectado à internet.',
    waiting: 'Aguardando conexão...',
    loggedOut: 'Você saiu. Conecte novamente para continuar.',
    sessionExpired: 'Sua sessão expirou. Leia o QR Code novamente para reconectar.',
    computerNotConnected:
      'Computador não está conectado. Certifique-se de que seu celular tem conexão ativa com a internet.',
  },
  send: {
    retry: 'Não foi possível enviar a mensagem. Toque para tentar novamente.',
    notDelivered: 'Mensagem não entregue.',
    checkConnection: 'Falha ao enviar. Verifique sua conexão.',
    waiting: 'Aguardando esta mensagem. Isso pode levar um tempo.',
  },
  contact: {
    invalidPhone: 'O número de telefone informado não é válido.',
    notOnWhatsApp: 'Este número não está registrado no WhatsApp.',
    cannotValidate: 'Não foi possível validar o número informado.',
  },
  media: {
    downloadFailed: 'Não foi possível baixar. Tente novamente.',
    fileSendFailed: 'Falha no envio do arquivo. Verifique sua conexão e tente novamente.',
    tooLarge: 'O arquivo é muito grande para ser enviado.',
    loading: 'Aguardando esta mensagem. Isso pode levar um tempo.',
  },
  generic: {
    somethingWrong: 'Algo deu errado. Tente novamente.',
    unexpected: 'Ocorreu um erro inesperado. Recarregue a página.',
    actionFailed: 'Não foi possível completar a ação. Tente novamente em instantes.',
  },
  message: {
    unsupported: 'Aguardando esta mensagem. Isso pode levar um tempo.',
    unknownType: 'Algo deu errado. Tente novamente.',
  },
} as const

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return ''
}

/** Converte erros técnicos da API em mensagens leves para o usuário */
export function mapSendError(error: unknown): string {
  const raw = errorText(error)
  const lower = raw.toLowerCase()

  if (!raw.trim()) return WA_CHAT.send.retry

  if (
    lower.includes('failed to fetch')
    || lower.includes('network')
    || lower.includes('networkerror')
    || lower.includes('offline')
  ) {
    return WA_CHAT.connection.noInternet
  }

  if (
    lower.includes('não configurado')
    || lower.includes('not configured')
    || lower.includes('cloud api')
    || lower.includes('desconect')
    || lower.includes('disconnected')
  ) {
    return WA_CHAT.connection.phoneNotConnected
  }

  if (
    lower.includes('expir')
    || lower.includes('qr code')
    || lower.includes('qrcode')
    || lower.includes('sessão expir')
  ) {
    return WA_CHAT.connection.sessionExpired
  }

  if (
    lower.includes('não autorizado')
    || lower.includes('unauthorized')
    || lower.includes('401')
    || lower.includes('você saiu')
  ) {
    return WA_CHAT.connection.loggedOut
  }

  if (
    lower.includes('não registrado')
    || lower.includes('not registered')
    || lower.includes('not on whatsapp')
  ) {
    return WA_CHAT.contact.notOnWhatsApp
  }

  if (
    lower.includes('número inválido')
    || lower.includes('invalid phone')
    || lower.includes('número de telefone')
  ) {
    return WA_CHAT.contact.invalidPhone
  }

  if (lower.includes('validar o número') || lower.includes('validate')) {
    return WA_CHAT.contact.cannotValidate
  }

  if (
    lower.includes('muito grande')
    || lower.includes('too large')
    || lower.includes('maximum')
    || lower.includes('max ')
  ) {
    return WA_CHAT.media.tooLarge
  }

  if (
    lower.includes('mídia')
    || lower.includes('arquivo')
    || lower.includes('document')
    || lower.includes('imagem')
    || lower.includes('vídeo')
    || lower.includes('video')
    || lower.includes('áudio')
    || lower.includes('audio')
    || lower.includes('formato')
    || lower.includes('não suportado')
    || lower.includes('unsupported')
  ) {
    return WA_CHAT.media.fileSendFailed
  }

  if (lower.includes('entreg') || lower.includes('deliver')) {
    return WA_CHAT.send.notDelivered
  }

  if (lower.includes('timeout') || lower.includes('timed out')) {
    return WA_CHAT.send.waiting
  }

  if (lower.includes('não encontrad') || lower.includes('not found')) {
    return WA_CHAT.generic.actionFailed
  }

  if (
    lower.includes('fetch')
    || lower.includes('conexão')
    || lower.includes('connection')
  ) {
    return WA_CHAT.send.checkConnection
  }

  return WA_CHAT.send.retry
}

/** Erros do CRM exibidos no cabeçalho do chat */
export function mapChatCrmError(error: unknown): string {
  const raw = errorText(error)
  const lower = raw.toLowerCase()

  if (
    lower.includes('policy')
    || lower.includes('permiss')
    || lower.includes('42501')
  ) {
    return WA_CHAT.generic.actionFailed
  }

  if (lower.includes('fetch') || lower.includes('network')) {
    return WA_CHAT.connection.noInternet
  }

  return WA_CHAT.generic.somethingWrong
}

export function mapAudioRecorderError(
  error: 'unsupported' | 'permission_denied' | 'not_found' | 'unknown',
): string {
  if (error === 'permission_denied') {
    return WA_CHAT.generic.actionFailed
  }
  if (error === 'not_found') {
    return WA_CHAT.generic.somethingWrong
  }
  return WA_CHAT.generic.actionFailed
}
