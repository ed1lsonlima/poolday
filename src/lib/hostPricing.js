export const HOST_FEE_RATE = 0.15

export function hostPayout(listedPrice) {
  const cents = Math.round(Number(listedPrice) * 100)
  if (!Number.isFinite(cents) || cents <= 0) return 0
  const feeCents = Math.round(cents * HOST_FEE_RATE)
  return (cents - feeCents) / 100
}

export function listedPriceForPayout(desiredPayout) {
  const targetCents = Math.round(Number(desiredPayout) * 100)
  if (!Number.isFinite(targetCents) || targetCents <= 0) return 0
  let listedCents = Math.ceil(targetCents / (1 - HOST_FEE_RATE))
  while (listedCents - Math.round(listedCents * HOST_FEE_RATE) < targetCents) listedCents++
  while (listedCents > 1 && listedCents - 1 - Math.round((listedCents - 1) * HOST_FEE_RATE) >= targetCents) listedCents--
  return listedCents / 100
}

