import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  consultationDraftToRequest,
  consultationToDraft,
  savedConsultationMatchesRequest,
} from './consultationDraft.js'

const persistedValues = {
  chiefComplaint: 'Persistent abdominal pain',
  symptoms: 'Nausea and mild fever',
  diagnosis: 'Acute gastroenteritis',
  treatmentPlan: 'Hydration and supportive treatment',
  instructions: 'Increase fluids and return if symptoms worsen',
  privateNotes: 'Internal doctor test note',
}

test('builds the save request with every canonical consultation field', () => {
  const request = consultationDraftToRequest({
    ...persistedValues,
    vitals: {},
  })

  assert.deepEqual(
    Object.fromEntries(
      Object.keys(persistedValues).map((field) => [field, request[field]]),
    ),
    persistedValues,
  )
})

test('hydrates every saved Doctor field when editing a consultation', () => {
  const draft = consultationToDraft({ ...persistedValues, vitals: {} })
  for (const [field, value] of Object.entries(persistedValues)) {
    assert.equal(draft[field], value)
  }
})

test('detects a save response that does not confirm the submitted draft', () => {
  assert.equal(
    savedConsultationMatchesRequest(persistedValues, persistedValues),
    true,
  )
  assert.equal(
    savedConsultationMatchesRequest(
      { ...persistedValues, diagnosis: '' },
      persistedValues,
    ),
    false,
  )
})
