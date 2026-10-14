const service = require("../services/appointmentService");

const createAppointment = async (req, res, next) => {
  try {
    const appointment = await service.createPatientAppointment(
      req.user,
      req.validatedAppointment
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

const getMyAppointment = async (req, res, next) => {
  try {
    const patient = await service.getPatientForUser(req.user._id);
    const data = await service.getPatientAppointment(patient._id, req.params.id);
    res.json({ data });
  } catch (error) {
    next(error);
  }
};

module.exports = { createAppointment, listMyAppointments, getMyAppointment };
