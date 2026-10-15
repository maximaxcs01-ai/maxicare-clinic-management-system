const Doctor = require("../models/Doctor");
const Service = require("../models/Service");

const getPublicCatalog = async () => {
  const [services, doctors] = await Promise.all([
    Service.find({ status: "active" })
      .select("name description fee durationMinutes")
      .sort({ name: 1 }),
    Doctor.find({ status: "active" })
      .select("firstName middleName lastName specialization profileImage.url serviceIds userId")
      .populate({
        path: "serviceIds",
        match: { status: "active" },
        select: "name",
      })
      .populate({
        path: "userId",
        match: { status: "active" },
        select: "status",
      })
      .sort({ lastName: 1, firstName: 1 }),
  ]);

  return {
    services: services.map(({ name, description, fee, durationMinutes }) => ({
      name,
      description,
      fee,
      durationMinutes,
    })),
    doctors: doctors
      .filter((doctor) => doctor.userId)
      .map((doctor) => ({
        firstName: doctor.firstName,
        middleName: doctor.middleName,
        lastName: doctor.lastName,
        specialization: doctor.specialization,
        profileImage: { url: doctor.profileImage?.url || "" },
        services: (doctor.serviceIds || []).map(({ name }) => name),
      })),
  };
};

module.exports = { getPublicCatalog };
