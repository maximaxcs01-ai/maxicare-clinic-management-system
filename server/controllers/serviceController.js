const serviceService = require("../services/serviceService");

const listServices = async (req, res, next) => {
  try {
    res.json(await serviceService.listServices(req.query, req.user.role));
  } catch (error) { next(error); }
};

const getService = async (req, res, next) => {
  try {
    const service = await serviceService.getService(req.params.id, req.user.role);
    if (!service) return res.status(404).json({ message: "Service not found" });
    res.json({ data: service });
  } catch (error) { next(error); }
};

const createService = async (req, res, next) => {
  try {
    const service = await serviceService.createService(req.validatedService);
    res.status(201).json({ message: "Service created successfully", data: service });
  } catch (error) { next(error); }
};

const updateService = async (req, res, next) => {
  try {
    const service = await serviceService.updateService(req.params.id, req.validatedService);
    if (!service) return res.status(404).json({ message: "Service not found" });
    res.json({ message: "Service updated successfully", data: service });
  } catch (error) { next(error); }
};

const deleteService = async (req, res, next) => {
  try {
    const service = await serviceService.deleteService(req.params.id);
    if (!service) return res.status(404).json({ message: "Service not found" });
    res.json({ message: "Service deleted successfully" });
  } catch (error) { next(error); }
};

module.exports = { listServices, getService, createService, updateService, deleteService };
