const service = require("../services/appointmentService");
const queueService = require("../services/queueService");
const { recordRequestAudit } = require("../services/auditService");

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
  confirmAppointment,
  rejectAppointment,
  cancelAppointment,
  rescheduleAppointment,
  checkInAppointment,
  addAppointmentToQueue,
  recordTriageVitals,
};
