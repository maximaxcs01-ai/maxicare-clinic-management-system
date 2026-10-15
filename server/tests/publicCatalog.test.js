const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const Doctor = require("../models/Doctor");
const Service = require("../models/Service");
const { getPublicCatalog } = require("../services/publicCatalogService");

const originals = {
  doctorFind: Doctor.find,
  serviceFind: Service.find,
};

afterEach(() => {
  Doctor.find = originals.doctorFind;
  Service.find = originals.serviceFind;
});

test("public catalog returns active records with only public doctor and service fields", async () => {
  const doctorQueryCalls = [];
  const serviceQueryCalls = [];
  const services = [
    {
      name: "General Consultation",
      description: "General care",
      fee: 500,
      durationMinutes: 30,
      status: "active",
    },
  ];
  const doctors = [
    {
      firstName: "Taylor",
      middleName: "",
      lastName: "Doctor",
      email: "private@example.test",
      licenseNumber: "PRIVATE-LICENSE",
      specialization: "General Practice",
      profileImage: {
        url: "https://images.example.test/doctor.jpg",
        publicId: "private-cloudinary-id",
      },
      serviceIds: [{ name: "General Consultation", status: "active" }],
      userId: { status: "active" },
    },
    {
      firstName: "Inactive",
      lastName: "Account",
      specialization: "General Practice",
      profileImage: {},
      serviceIds: [],
      userId: null,
    },
  ];

  const makeQuery = (result, calls) => ({
    select(projection) {
      calls.push(["select", projection]);
      return this;
    },
    populate(options) {
      calls.push(["populate", options]);
      return this;
    },
    sort(criteria) {
      calls.push(["sort", criteria]);
      return Promise.resolve(result);
    },
  });

  Service.find = (filter) => {
    serviceQueryCalls.push(["filter", filter]);
    return makeQuery(services, serviceQueryCalls);
  };
  Doctor.find = (filter) => {
    doctorQueryCalls.push(["filter", filter]);
    return makeQuery(doctors, doctorQueryCalls);
  };

  const result = await getPublicCatalog();

  assert.deepEqual(serviceQueryCalls[0], ["filter", { status: "active" }]);
  assert.deepEqual(doctorQueryCalls[0], ["filter", { status: "active" }]);
  assert.equal(
    serviceQueryCalls.find(([kind]) => kind === "select")[1],
    "name description fee durationMinutes"
  );
  assert.equal(
    doctorQueryCalls.find(([kind]) => kind === "select")[1],
    "firstName middleName lastName specialization profileImage.url serviceIds userId"
  );
  assert.equal(result.doctors.length, 1);
  assert.deepEqual(result.services, [
    {
      name: "General Consultation",
      description: "General care",
      fee: 500,
      durationMinutes: 30,
    },
  ]);
  assert.deepEqual(result.doctors[0], {
    firstName: "Taylor",
    middleName: "",
    lastName: "Doctor",
    specialization: "General Practice",
    profileImage: { url: "https://images.example.test/doctor.jpg" },
    services: ["General Consultation"],
  });
});
