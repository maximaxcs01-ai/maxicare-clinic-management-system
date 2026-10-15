import {
  emptyVitals,
  toVitalsForm,
  toVitalsRequest,
} from './vitals.js'

export const CONSULTATION_TEXT_FIELDS = [
  'chiefComplaint',
  'symptoms',
  'diagnosis',
  'treatmentPlan',
  'instructions',
  'privateNotes',
]

export const createEmptyConsultationDraft = () => ({
  chiefComplaint: '',
  symptoms: '',
  vitals: emptyVitals(),
  diagnosis: '',
  treatmentPlan: '',
  instructions: '',
  privateNotes: '',
})

export const consultationToDraft = (consultation) => ({
  chiefComplaint: consultation.chiefComplaint || '',
  symptoms: consultation.symptoms || '',
  vitals: toVitalsForm(consultation.vitals),
  diagnosis: consultation.diagnosis || '',
  treatmentPlan: consultation.treatmentPlan || '',
  instructions: consultation.instructions || '',
  privateNotes: consultation.privateNotes || '',
})

export const consultationDraftToRequest = (draft) => ({
  ...Object.fromEntries(
    CONSULTATION_TEXT_FIELDS.map((field) => [
      field,
      (draft[field] || '').trim(),
    ]),
  ),
  vitals: toVitalsRequest(draft.vitals),
})

export const savedConsultationMatchesRequest = (consultation, request) =>
  Boolean(consultation) &&
  CONSULTATION_TEXT_FIELDS.every(
    (field) => consultation[field] === request[field],
  )
