const Doctor = require("../models/Doctor");
const Service = require("../models/Service");
const AppError = require("../utils/AppError");
const { buildPagination, escapeRegex, getPagination } = require("../utils/pagination");

const listServices = async (query, role) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  const search = typeof query.search === "string" ? query.search.trim() : "";

  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: pattern }, { description: pattern }];
  }

  if (role === "patient") {
    filter.status = "active";
  } else if (["active", "inactive"].includes(query.status)) {
    filter.status = query.status;
  }

  const [data, total] = await Promise.all([
    Service.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
    Service.countDocuments(filter),
  ]);

  return { data, pagination: buildPagination(page, limit, total) };
};

const getService = async (id, role) => {
  const filter = { _id: id };
  if (role === "patient") filter.status = "active";
  return Service.findOne(filter);
};

const createService = (data) =>
  Service.create({ ...data, nameKey: data.name.toLocaleLowerCase() });

const updateService = (id, data) =>
  Service.findByIdAndUpdate(
    id,
    { ...data, nameKey: data.name.toLocaleLowerCase() },
    { new: true, runValidators: true }
  );

const deleteService = async (id) => {
  const referenced = await Doctor.exists({ serviceIds: id });
  if (referenced) {
    throw new AppError("Service cannot be deleted while assigned to a doctor", 409);
  }
  return Service.findByIdAndDelete(id);
};

module.exports = { listServices, getService, createService, updateService, deleteService };
