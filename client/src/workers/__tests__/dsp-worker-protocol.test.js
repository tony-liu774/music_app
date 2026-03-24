import { describe, it, expect } from 'vitest'
import {
  MSG_INIT,
  MSG_PROCESS,
  MSG_RESULT,
  MSG_ERROR,
  MSG_PERF,
  createInitMessage,
  createProcessMessage,
  createResultMessage,
  createErrorMessage,
  createPerfMessage,
} from '../dsp-worker-protocol'

describe('DSP Worker Protocol', () => {
  describe('message type constants', () => {
    it('exports all required message types', () => {
      expect(MSG_INIT).toBe('INIT')
      expect(MSG_PROCESS).toBe('PROCESS')
      expect(MSG_RESULT).toBe('RESULT')
      expect(MSG_ERROR).toBe('ERROR')
      expect(MSG_PERF).toBe('PERF')
    })
  })

  describe('createInitMessage', () => {
    it('builds an INIT message with sampleRate, bufferSize, and instrument', () => {
      const msg = createInitMessage(44100, 2048, 'violin')
      expect(msg).toEqual({
        type: 'INIT',
        sampleRate: 44100,
        bufferSize: 2048,
        instrument: 'violin',
      })
    })
  })

  describe('createProcessMessage', () => {
    it('builds a PROCESS message with buffer and transferable list', () => {
      const buffer = new Float32Array([0.1, 0.2, 0.3])
      const { message, transfer } = createProcessMessage(buffer)

      expect(message.type).toBe('PROCESS')
      expect(message.buffer).toBe(buffer)
      expect(transfer).toHaveLength(1)
      expect(transfer[0]).toBe(buffer.buffer)
    })
  })

  describe('createResultMessage', () => {
    it('builds a RESULT message with all pitch data fields', () => {
      const msg = createResultMessage(440, 0.95, 'A4', 2)
      expect(msg).toEqual({
        type: 'RESULT',
        frequency: 440,
        confidence: 0.95,
        note: 'A4',
        cents: 2,
        vibrato: null,
      })
    })

    it('handles null values for no-detection case', () => {
      const msg = createResultMessage(null, 0, null, null)
      expect(msg.frequency).toBeNull()
      expect(msg.confidence).toBe(0)
      expect(msg.note).toBeNull()
      expect(msg.cents).toBeNull()
    })
  })

  describe('createErrorMessage', () => {
    it('builds an ERROR message with error text', () => {
      const msg = createErrorMessage('Something went wrong')
      expect(msg).toEqual({
        type: 'ERROR',
        error: 'Something went wrong',
      })
    })
  })

  describe('createPerfMessage', () => {
    it('builds a PERF message within budget', () => {
      const msg = createPerfMessage(12.5, false)
      expect(msg).toEqual({
        type: 'PERF',
        processingTimeMs: 12.5,
        exceeded: false,
      })
    })

    it('builds a PERF message exceeding budget', () => {
      const msg = createPerfMessage(45.2, true)
      expect(msg.exceeded).toBe(true)
    })
  })
})
