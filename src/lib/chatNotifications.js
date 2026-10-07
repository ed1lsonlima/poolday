export function isNoticeForOpenChat(notice, pathname) {
  if (!notice?.kind?.startsWith('chat')) return false
  const match = /^\/reserva\/([0-9a-f-]{36})\/chat\/?$/i.exec(pathname || '')
  return Boolean(match && (notice.booking_id === match[1] || notice.action_url === `/reserva/${match[1]}/chat`))
}

export function shouldNotifyChatRecipient(senderId, recipientId) {
  return Boolean(senderId && recipientId && senderId !== recipientId)
}

