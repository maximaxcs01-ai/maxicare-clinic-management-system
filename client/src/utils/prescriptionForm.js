export const createEmptyMedication = () => ({
  medicationName: '',
  dosage: '',
  frequency: '',
  route: '',
  duration: '',
  quantity: '',
  instructions: '',
})

export const MEDICATION_FIELDS = [
  ['medicationName', 'Medication Name', true],
  ['dosage', 'Dosage', true],
  ['frequency', 'Frequency', true],
  ['route', 'Route', false],
  ['duration', 'Duration', true],
  ['quantity', 'Quantity', false],
]

export const prescriptionToDraft = (prescription) => ({
  medications: prescription?.medications?.length
    ? prescription.medications.map((medication) => ({
        medicationName: medication.medicationName || '',
        dosage: medication.dosage || '',
        frequency: medication.frequency || '',
        route: medication.route || '',
        duration: medication.duration || '',
        quantity: medication.quantity || '',
        instructions: medication.instructions || '',
      }))
    : [createEmptyMedication()],
})

export const prescriptionDraftToRequest = (draft) => ({
  medications: draft.medications
    .filter((medication) =>
      Object.values(medication).some((value) => value.trim()),
    )
    .map((medication) =>
      Object.fromEntries(
        Object.entries(medication).map(([field, value]) => [
          field,
          value.trim(),
        ]),
      ),
    ),
})

export const addMedication = (draft) => ({
  ...draft,
  medications: [...draft.medications, createEmptyMedication()],
})

export const removeMedication = (draft, index) => ({
  ...draft,
  medications: draft.medications.filter(
    (_, medicationIndex) => medicationIndex !== index,
  ),
})
