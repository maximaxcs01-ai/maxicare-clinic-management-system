import assert from 'node:assert/strict'
import { test } from 'node:test'
import { openPrescriptionAfterSaving } from './openPrescriptionAfterSaving.js'

test('saves the consultation before opening its existing prescription', async () => {
  const events = []
  const prescription = { _id: 'prescription-id' }

  const result = await openPrescriptionAfterSaving({
    saveDraft: async () => {
      events.push('save')
      return { diagnosis: 'Acute gastroenteritis' }
    },
    getPrescription: async () => {
      events.push('get-prescription')
      return { data: { data: prescription } }
    },
    createPrescription: async () => {
      events.push('create-prescription')
      throw new Error('Should not create an existing prescription')
    },
  })

  assert.deepEqual(events, ['save', 'get-prescription'])
  assert.equal(result, prescription)
})

test('saves the consultation before creating a missing prescription', async () => {
  const events = []
  const prescription = { _id: 'new-prescription-id' }

  const result = await openPrescriptionAfterSaving({
    saveDraft: async () => {
      events.push('save')
    },
    getPrescription: async () => {
      events.push('get-prescription')
      const error = new Error('Not found')
      error.response = { status: 404 }
      throw error
    },
    createPrescription: async () => {
      events.push('create-prescription')
      return { data: { data: prescription } }
    },
  })

  assert.deepEqual(events, ['save', 'get-prescription', 'create-prescription'])
  assert.equal(result, prescription)
})

test('does not open or create a prescription when consultation save fails', async () => {
  const events = []
  const saveError = new Error('Consultation save failed')

  await assert.rejects(
    openPrescriptionAfterSaving({
      saveDraft: async () => {
        events.push('save')
        throw saveError
      },
      getPrescription: async () => {
        events.push('get-prescription')
        return { data: { data: { _id: 'prescription-id' } } }
      },
      createPrescription: async () => {
        events.push('create-prescription')
        return { data: { data: { _id: 'prescription-id' } } }
      },
    }),
    saveError,
  )

  assert.deepEqual(events, ['save'])
})

test('opens a concurrently created prescription instead of creating a duplicate', async () => {
  const events = []
  const prescription = { _id: 'existing-prescription-id' }

  const result = await openPrescriptionAfterSaving({
    saveDraft: async () => events.push('save'),
    getPrescription: async () => {
      events.push('get-prescription')
      if (events.filter((event) => event === 'get-prescription').length === 1) {
        const error = new Error('Not found')
        error.response = { status: 404 }
        throw error
      }
      return { data: { data: prescription } }
    },
    createPrescription: async () => {
      events.push('create-prescription')
      const error = new Error('Already exists')
      error.response = { status: 409 }
      throw error
    },
  })

  assert.deepEqual(events, [
    'save',
    'get-prescription',
    'create-prescription',
    'get-prescription',
  ])
  assert.equal(result, prescription)
})
