export async function openPrescriptionAfterSaving({
  saveDraft,
  getPrescription,
  createPrescription,
}) {
  await saveDraft()

  try {
    const existing = await getPrescription()
    return existing.data.data
  } catch (requestError) {
    if (requestError.response?.status !== 404) throw requestError

    try {
      const created = await createPrescription()
      return created.data.data
    } catch (createError) {
      if (createError.response?.status !== 409) throw createError
      const existing = await getPrescription()
      return existing.data.data
    }
  }
}
