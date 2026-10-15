import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getLinkedPrescriptionOrNull,
  issueLinkedPrescription,
  preparePrescriptionIssue,
} from './prescriptionIssueWorkflow.js'

const payload = {
  medications: [
    {
      medicationName: 'Oral rehydration salts',
      dosage: '1 sachet',
      frequency: 'After each loose stool',
      route: 'Oral',
      duration: '3 days',
      quantity: '6 sachets',
      instructions: 'Dissolve in clean water',
    },
  ],
}

test('a missing linked prescription is represented as null', async () => {
  const notFound = new Error('Not found')
  notFound.response = { status: 404 }
  assert.equal(
    await getLinkedPrescriptionOrNull(async () => {
      throw notFound
    }),
    null,
  )
})

test('prepares the modal only after the Consultation save succeeds', async () => {
  const calls = []
  const result = await preparePrescriptionIssue({
    saveConsultation: async () => {
      calls.push('save-consultation')
      return { _id: 'consultation-1', diagnosis: 'Saved diagnosis' }
    },
    getPrescription: async () => {
      calls.push('get-prescription')
      const notFound = new Error('Not found')
      notFound.response = { status: 404 }
      throw notFound
    },
  })

  assert.deepEqual(calls, ['save-consultation', 'get-prescription'])
  assert.equal(result.consultation.diagnosis, 'Saved diagnosis')
  assert.equal(result.prescription, null)
})

test('a failed Consultation save prevents prescription preparation', async () => {
  const saveError = new Error('Save failed')
  let prescriptionRequested = false
  await assert.rejects(
    preparePrescriptionIssue({
      saveConsultation: async () => {
        throw saveError
      },
      getPrescription: async () => {
        prescriptionRequested = true
      },
    }),
    saveError,
  )
  assert.equal(prescriptionRequested, false)
})

test('issues an existing draft without creating a duplicate', async () => {
  const calls = []
  const result = await issueLinkedPrescription({
    consultationId: 'consultation-1',
    prescription: { _id: 'prescription-1', status: 'draft' },
    payload,
    createPrescription: async () => calls.push('create'),
    getPrescription: async () => calls.push('get'),
    issuePrescription: async (id, body) => {
      calls.push(['issue', id, body])
      return { data: { data: { _id: id, status: 'issued' } } }
    },
  })

  assert.equal(result.status, 'issued')
  assert.deepEqual(calls, [['issue', 'prescription-1', payload]])
})

test('creates and immediately issues exactly one missing prescription', async () => {
  const calls = []
  const result = await issueLinkedPrescription({
    consultationId: 'consultation-1',
    prescription: null,
    payload,
    createPrescription: async (id) => {
      calls.push(['create', id])
      return {
        data: { data: { _id: 'prescription-1', status: 'draft' } },
      }
    },
    getPrescription: async () => calls.push('get'),
    issuePrescription: async (id) => {
      calls.push(['issue', id])
      return { data: { data: { _id: id, status: 'issued' } } }
    },
  })

  assert.equal(result.status, 'issued')
  assert.deepEqual(calls, [
    ['create', 'consultation-1'],
    ['issue', 'prescription-1'],
  ])
})

test('a create race reuses the unique linked draft before issuing', async () => {
  const conflict = new Error('Already exists')
  conflict.response = { status: 409 }
  let createCount = 0
  let issueCount = 0
  const result = await issueLinkedPrescription({
    consultationId: 'consultation-1',
    prescription: null,
    payload,
    createPrescription: async () => {
      createCount += 1
      throw conflict
    },
    getPrescription: async () => ({
      data: { data: { _id: 'prescription-1', status: 'draft' } },
    }),
    issuePrescription: async () => {
      issueCount += 1
      return {
        data: { data: { _id: 'prescription-1', status: 'issued' } },
      }
    },
  })

  assert.equal(result.status, 'issued')
  assert.equal(createCount, 1)
  assert.equal(issueCount, 1)
})

test('an issue failure exposes the reusable linked draft and preserves the payload', async () => {
  const issueError = new Error('Issue failed')
  let reusableDraft
  await assert.rejects(
    issueLinkedPrescription({
      consultationId: 'consultation-1',
      prescription: null,
      payload,
      createPrescription: async () => ({
        data: {
          data: { _id: 'prescription-1', status: 'draft', medications: [] },
        },
      }),
      issuePrescription: async () => {
        throw issueError
      },
      onDraftCreated: (created) => {
        reusableDraft = created
      },
    }),
    issueError,
  )

  assert.equal(reusableDraft._id, 'prescription-1')
  assert.equal(payload.medications[0].medicationName, 'Oral rehydration salts')
})

test('an already issued prescription is idempotently reused', async () => {
  let issueCount = 0
  const issued = { _id: 'prescription-1', status: 'issued' }
  const result = await issueLinkedPrescription({
    consultationId: 'consultation-1',
    prescription: issued,
    payload,
    issuePrescription: async () => {
      issueCount += 1
    },
  })

  assert.equal(result, issued)
  assert.equal(issueCount, 0)
})
