import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateCancellation, paymentPlanForDate } from '../src/lib/bookingPolicy.js'

const NOW = new Date('2026-09-20T12:00:00-03:00')

test('cobra entrada de 50% com oito dias ou mais', () => {
  assert.deepEqual(paymentPlanForDate('2026-09-28', 601, NOW), {
    days: 8, paymentPlan: 'deposit', dueNow: 300.5, remaining: 300.5, holdMinutes: 1440,
  })
})

test('cobra valor integral e reduz o bloqueio perto da diária', () => {
  assert.equal(paymentPlanForDate('2026-09-26', 600, NOW).paymentPlan, 'full')
  assert.equal(paymentPlanForDate('2026-09-26', 600, NOW).holdMinutes, 120)
  assert.equal(paymentPlanForDate('2026-09-22', 600, NOW).holdMinutes, 30)
})

test('devolve tudo dentro dos sete dias da contratação', () => {
  const result = calculateCancellation({ totalAmount: 600, paidAmount: 600, createdAt: '2026-09-18T10:00:00-03:00', serviceStartsAt: '2026-09-25T08:00:00-03:00', now: NOW })
  assert.equal(result.refundAmount, 600)
  assert.equal(result.retainedAmount, 0)
})

test('retém 25% entre sete dias e 72 horas fora do período gratuito', () => {
  const result = calculateCancellation({ totalAmount: 600, paidAmount: 600, createdAt: '2026-09-01T10:00:00-03:00', serviceStartsAt: '2026-09-25T08:00:00-03:00', now: NOW })
  assert.equal(result.refundAmount, 450)
  assert.equal(result.retainedAmount, 150)
})

test('retém no máximo o valor já pago', () => {
  const result = calculateCancellation({ totalAmount: 600, paidAmount: 300, createdAt: '2026-09-01T10:00:00-03:00', serviceStartsAt: '2026-09-22T08:00:00-03:00', now: NOW })
  assert.equal(result.refundAmount, 0)
  assert.equal(result.retainedAmount, 300)
})

