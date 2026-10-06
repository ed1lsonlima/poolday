export function isNearChatBottom({ scrollHeight, scrollTop, clientHeight }, threshold = 80) {
  return scrollHeight - scrollTop - clientHeight <= threshold
}
