import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  addMedication,
  prescriptionDraftToRequest,
  prescriptionToDraft,
  removeMedication,
} from './prescriptionForm.js'

test('medications can be added and removed without changing remaining values', () => {
  const first = {
    medicationName: 'Medicine A',
    dosage: '1 tablet',
    frequency: 'Once daily',
    route: 'Oral',
    duration: '5 days',
    quantity: '5 tablets',
    instructions: '',
  }
  let draft = prescriptionToDraft({ medications: [first] })
  draft = addMedication(draft)
  draft.medications[1].medicationName = 'Medicine B'
  draft = removeMedication(draft, 0)

  assert.equal(draft.medications.length, 1)
  assert.equal(draft.medications[0].medicationName, 'Medicine B')
})

test('issue payload preserves multiple complete medications', () => {
  const draft = prescriptionToDraft({
    medications: [
      {
        medicationName: 'Medicine A',
        dosage: '1 tablet',
        frequency: 'Once daily',
        route: 'Oral',
        duration: '5 days',
        quantity: '5 tablets',
        instructions: 'After meals',
      },
      {
        medicationName: 'Medicine B',
        dosage: '5 ml',
        frequency: 'Twice daily',
        route: 'Oral',
        duration: '3 days',
        quantity: '30 ml',
        instructions: '',
      },
    ],
  })

  assert.equal(prescriptionDraftToRequest(draft).medications.length, 2)
})
