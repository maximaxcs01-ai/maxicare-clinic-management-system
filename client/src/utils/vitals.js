export const VITAL_FIELDS = [
  ['systolic', 'Systolic BP', 'mmHg', 0, 400, 1],
  ['diastolic', 'Diastolic BP', 'mmHg', 0, 300, 1],
  ['temperature', 'Temperature', '°C', 20, 50, 0.1],
  ['pulse', 'Pulse', 'bpm', 0, 300, 1],
  ['respiratoryRate', 'Respiratory Rate', '/min', 0, 100, 1],
  ['oxygenSaturation', 'Oxygen Saturation', '%', 0, 100, 0.1],
  ['weight', 'Weight', 'kg', 0, 1000, 0.1],
  ['height', 'Height', 'cm', 0, 300, 0.1],
]

export const emptyVitals = () =>
  Object.fromEntries(VITAL_FIELDS.map(([field]) => [field, '']))

export const toVitalsForm = (vitals = {}) =>
  Object.fromEntries(
    VITAL_FIELDS.map(([field]) => [field, vitals[field] ?? '']),
  )

export const toVitalsRequest = (vitals) =>
  Object.fromEntries(
    VITAL_FIELDS.map(([field]) => [
      field,
      vitals[field] === '' ? null : Number(vitals[field]),
    ]),
  )
