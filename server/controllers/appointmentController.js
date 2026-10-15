const service = require("../services/appointmentService");
const queueService = require("../services/queueService");
const { recordRequestAudit } = require("../services/auditService");
const notifications = require("../services/notificationService");

const entityId = (value) => value?._id || value;
const doctorName = (doctor) =>
  doctor?.firstName ? `Dr. ${doctor.firstName} ${doctor.lastName}` : "your doctor";

const createAppointment = async (req, res, next) => {
  try {
    const appointment = await service.createPatientAppointment(
      req.user,
      req.validatedAppointment
    );
    await recordRequestAudit(req, {
      action: "appointment.booked",
      entityType: "Appointment",
      entityId: appointment._id,
      patientId: appointment.patientId?._id || appointment.patientId,
      description: "Appointment booked.",
      metadata: {
        patientId: appointment.patientId?._id || appointment.patientId,
        doctorId: appointment.doctorId?._id || appointment.doctorId,
        serviceId: appointment.serviceId?._id || appointment.serviceId,
        status: appointment.status,
        bookingType: appointment.bookingType,
      },
    });
    await notifications.publishSafely(() =>
      Promise.all([
        notifications.notifyRoles(["admin", "receptionist"], {
          type: "appointment_booked",
          title: "New Appointment Request",
          message: "A new patient appointment requires review.",
          targetType: "staff_appointments",
          targetId: appointment._id,
          dedupeKey: `appointment:${appointment._id}:booked:staff`,
        }),
        notifications.notifyDoctor(entityId(appointment.doctorId), {
          type: "appointment_assigned",
          title: "New Appointment Assignment",
          message: "A new appointment has been added to your schedule.",
          targetType: "doctor_appointments",
          targetId: appointment._id,
          dedupeKey: `appointment:${appointment._id}:assigned`,
        }),
      ])
    );
    res.status(201).json({
      message: "Appointment booked successfully.",
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

const listMyAppointments = async (req, res, next) => {
  try {
    const patient = await service.getPatientForUser(req.user._id);
    res.json(
      await service.listPatientAppointments(
        patient._id,
        req.query,
        req.appointmentBucket
      )
    );
  } catch (error) {
    next(error);
  }
};

const listDoctorAppointments = async (req, res, next) => {
  try {
    res.json(
      await service.listDoctorAppointments(
        req.user._id,
        req.doctorAppointmentQuery,
        req.doctorAppointmentBucket
      )
    );
  } catch (error) {
    next(error);
  }
};

const getMyAppointment = async (req, res, next) => {
  try {
    const data = await service.getAppointmentById(req.params.id, req.user);
    res.json({ data });
  } catch (error) {
    next(error);
  }
};

const listAllAppointments = async (req, res, next) => {
  try {
    res.json(await service.listAllAppointments(req.query));
  } catch (error) {
    next(error);
  }
};

const getAppointment = async (req, res, next) => {
  try {
    const data = await service.getAppointmentById(req.params.id, req.user);
    res.json({ data });
  } catch (error) {
    next(error);
  }
};

const deleteAppointment = async (req, res, next) => {
  try {
    const data = await service.deleteAppointment(
      req.params.id,
      req.user,
      req.appointmentDeletionReason,
      req
    );
    res.json({ message: "Appointment and eligible operational records deleted.", data });
  } catch (error) {
    next(error);
  }
};

const confirmAppointment = async (req, res, next) => {
  try {
    const appointment = await service.confirmAppointment(req.params.id, req.user);
    await recordRequestAudit(req, {
      action: "appointment.confirmed",
      entityType: "Appointment",
      entityId: appointment._id,
      patientId: appointment.patientId?._id || appointment.patientId,
      description: "Appointment confirmed.",
      metadata: { status: appointment.status, patientId: appointment.patientId?._id || appointment.patientId },
    });
    await notifications.publishSafely(() =>
      notifications.notifyPatient(entityId(appointment.patientId), {
        type: "appointment_confirmed",
        title: "Appointment Confirmed",
        message: `Your appointment with ${doctorName(appointment.doctorId)} has been confirmed.`,
        targetType: "patient_appointments",
        targetId: appointment._id,
        dedupeKey: `appointment:${appointment._id}:confirmed`,
      })
    );
    res.json({
      message: "Appointment confirmed successfully.",
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

const rejectAppointment = async (req, res, next) => {
  try {
    const appointment = await service.rejectAppointment(
      req.params.id,
      req.user,
      req.validatedRejection
    );
    await recordRequestAudit(req, {
      action: "appointment.rejected",
      entityType: "Appointment",
      entityId: appointment._id,
      patientId: appointment.patientId?._id || appointment.patientId,
      description: "Appointment rejected.",
      metadata: { status: appointment.status, patientId: appointment.patientId?._id || appointment.patientId },
    });
    await notifications.publishSafely(() =>
      notifications.notifyPatient(entityId(appointment.patientId), {
        type: "appointment_rejected",
        title: "Appointment Rejected",
        message: "Your appointment request was not approved. Open Appointments for details.",
        targetType: "patient_appointments",
        targetId: appointment._id,
        dedupeKey: `appointment:${appointment._id}:rejected`,
      })
    );
    res.json({
      message: "Appointment rejected successfully.",
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

const cancelAppointment = async (req, res, next) => {
  try {
    const appointment = await service.cancelAppointment(
      req.params.id,
      req.user,
      req.validatedCancellation || {}
    );
    await recordRequestAudit(req, {
      action: "appointment.cancelled",
      entityType: "Appointment",
      entityId: appointment._id,
      patientId: appointment.patientId?._id || appointment.patientId,
      description: "Appointment cancelled.",
      metadata: { status: appointment.status, patientId: appointment.patientId?._id || appointment.patientId },
    });
    await notifications.publishSafely(() =>
      Promise.all([
        notifications.notifyPatient(entityId(appointment.patientId), {
          type: "appointment_cancelled",
          title: "Appointment Cancelled",
          message: "An appointment was cancelled. Open Appointments for details.",
          targetType: "patient_appointments",
          targetId: appointment._id,
          dedupeKey: `appointment:${appointment._id}:cancelled`,
        }),
        notifications.notifyDoctor(entityId(appointment.doctorId), {
          type: "appointment_cancelled",
          title: "Appointment Cancelled",
          message: "An appointment on your schedule was cancelled.",
          targetType: "doctor_appointments",
          targetId: appointment._id,
          dedupeKey: `appointment:${appointment._id}:cancelled:doctor`,
        }),
      ])
    );
    res.json({
      message: "Appointment cancelled successfully.",
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

const rescheduleAppointment = async (req, res, next) => {
  try {
    const appointment = await service.rescheduleAppointment(
      req.params.id,
      req.user,
      req.validatedReschedule,
      req
    );
    await notifications.publishSafely(() =>
      Promise.all([
        notifications.notifyPatient(entityId(appointment.patientId), {
          type: "appointment_rescheduled",
          title: "Appointment Rescheduled",
          message: "Your appointment schedule has changed. Open Appointments for details.",
          targetType: "patient_appointments",
          targetId: appointment._id,
          dedupeKey: `appointment:${appointment._id}:rescheduled:${appointment.rescheduleCount}`,
        }),
        notifications.notifyDoctor(entityId(appointment.doctorId), {
          type: "appointment_rescheduled",
          title: "Appointment Rescheduled",
          message: "An appointment on your schedule was rescheduled.",
          targetType: "doctor_appointments",
          targetId: appointment._id,
          dedupeKey: `appointment:${appointment._id}:rescheduled:${appointment.rescheduleCount}:doctor`,
        }),
      ])
    );
    res.json({
      message: "Appointment rescheduled successfully.",
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

const checkInAppointment = async (req, res, next) => {
  try {
    const data = await queueService.checkInScheduledAppointment(
      req.params.id,
      req.user,
      req
    );
    res.json({ message: "Appointment checked in successfully.", data });
  } catch (error) {
    next(error);
  }
};

const addAppointmentToQueue = async (req, res, next) => {
  try {
    const data = await queueService.addCheckedInAppointmentToQueue(
      req.params.id,
      req.user,
      req
    );
    await notifications.publishSafely(() =>
      notifications.notifyDoctor(entityId(data.queueEntry?.doctorId), {
        type: "patient_waiting",
        title: "Patient Waiting",
        message: `${data.queueEntry?.patientId?.firstName || "A patient"} ${data.queueEntry?.patientId?.lastName || ""}`.trim() +
          " is waiting in your queue.",
        targetType: "doctor_queue",
        targetId: data.queueEntry?._id,
        dedupeKey: `queue:${data.queueEntry?._id}:waiting`,
      })
    );
    res.json({ message: "Patient added to the queue.", data });
  } catch (error) {
    next(error);
  }
};

const recordTriageVitals = async (req, res, next) => {
  try {
    const result = await service.recordTriageVitals(
      req.params.id,
      req.user,
      req.validatedTriageVitals
    );
    const appointment = result.appointment;
    await recordRequestAudit(req, {
      action: result.updated ? "triage.vitals_updated" : "triage.vitals_recorded",
      entityType: "Appointment",
      entityId: appointment._id,
      patientId: appointment.patientId?._id || appointment.patientId,
      description: result.updated
        ? "Pre-consultation vitals updated."
        : "Pre-consultation vitals recorded.",
      metadata: {
        appointmentId: appointment._id,
        patientId: appointment.patientId?._id || appointment.patientId,
        status: appointment.status,
      },
    });
    res.json({
      message: result.updated
        ? "Vitals updated successfully."
        : "Vitals recorded successfully.",
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAppointment,
  listMyAppointments,
  listDoctorAppointments,
  getMyAppointment,
  listAllAppointments,
  getAppointment,
  deleteAppointment,
  confirmAppointment,
  rejectAppointment,
  cancelAppointment,
  rescheduleAppointment,
  checkInAppointment,
  addAppointmentToQueue,
  recordTriageVitals,
};
