const responseData = (response) => response.data.data

export const getLinkedPrescriptionOrNull = async (getPrescription) => {
  try {
    return responseData(await getPrescription())
  } catch (error) {
    if (error.response?.status === 404) return null
    throw error
  }
}

export const preparePrescriptionIssue = async ({
  saveConsultation,
  getPrescription,
}) => {
  const consultation = await saveConsultation()
  const prescription = await getLinkedPrescriptionOrNull(getPrescription)
  return { consultation, prescription }
}

export const issueLinkedPrescription = async ({
  consultationId,
  prescription,
  payload,
  createPrescription,
  getPrescription,
  issuePrescription,
  onDraftCreated,
}) => {
  let linkedPrescription = prescription

  if (!linkedPrescription) {
    try {
      linkedPrescription = responseData(
        await createPrescription(consultationId),
      )
    } catch (error) {
      if (error.response?.status !== 409) throw error
      linkedPrescription = await getLinkedPrescriptionOrNull(getPrescription)
      if (!linkedPrescription) throw error
    }
    onDraftCreated?.(linkedPrescription)
  }

  if (linkedPrescription.status === 'issued') return linkedPrescription

  return responseData(
    await issuePrescription(linkedPrescription._id, payload),
  )
}
