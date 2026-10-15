const assert = require("node:assert/strict");
const { afterEach, beforeEach, test } = require("node:test");
const Doctor = require("../models/Doctor");
const Patient = require("../models/Patient");
const User = require("../models/User");
const cloudinaryService = require("../services/cloudinaryService");
const doctorService = require("../services/doctorService");
const patientService = require("../services/patientService");
const userProfileService = require("../services/userProfileService");
const { validateOwnPatient } = require("../validators/patientValidator");
const { validateProfileImageFile } = require("../middleware/doctorImageUpload");
const userRoutes = require("../routes/userRoutes");
const doctorRoutes = require("../routes/doctorRoutes");
const patientRoutes = require("../routes/patientRoutes");

const ids = {
  user: "660000000000000000000001",
  otherUser: "660000000000000000000002",
  doctor: "660000000000000000000003",
  patient: "660000000000000000000004",
};

const pngFile = (overrides = {}) => ({
  mimetype: "image/png",
  size: 8,
  buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  ...overrides,
});

const original = {
  userFindById: User.findById,
  userFindOneAndUpdate: User.findOneAndUpdate,
  patientFindOneAndUpdate: Patient.findOneAndUpdate,
  doctorFindOne: Doctor.findOne,
  doctorFindOneAndUpdate: Doctor.findOneAndUpdate,
  uploadProfileImage: cloudinaryService.uploadProfileImage,
  uploadDoctorImage: cloudinaryService.uploadDoctorImage,
  deleteImage: cloudinaryService.deleteImage,
};

let userRecords;
let userUpdateFilters;
let userUpdateData;
let doctorUpdateFilter;
let cloudEvents;
let nextCloudinaryResult;
let failUserUpdate;
let userSelectFields;

const query = (resolver) => ({
  select() {
    return this;
  },
  populate() {
    return this;
  },
  then(resolve, reject) {
    return Promise.resolve().then(resolver).then(resolve, reject);
  },
});

const invokeValidator = (body) => {
  let response;
  let nextCalled = false;
  const req = { body };
  const res = {
    status(statusCode) {
      response = { statusCode };
      return this;
    },
    json(payload) {
      response = { ...response, ...payload };
      return this;
    },
  };
  validateOwnPatient(req, res, () => {
    nextCalled = true;
  });
  return { req, response, nextCalled };
};

beforeEach(() => {
  userRecords = new Map([
    [
      ids.user,
      {
        _id: ids.user,
        role: "patient",
        profileImage: { url: "https://old.example/image.png", publicId: "old-id" },
      },
    ],
    [
      ids.otherUser,
      {
        _id: ids.otherUser,
        role: "admin",
        profileImage: { url: "", publicId: "" },
      },
    ],
  ]);
  userUpdateFilters = [];
  userUpdateData = [];
  doctorUpdateFilter = null;
  cloudEvents = [];
  nextCloudinaryResult = {
    url: "https://new.example/image.png",
    publicId: "new-id",
  };
  failUserUpdate = false;
  userSelectFields = [];

  User.findById = (id) =>
    query(() => {
      const record = userRecords.get(String(id));
      return record
        ? {
            ...record,
            profileImage: { ...record.profileImage },
          }
        : null;
    });
  User.findOneAndUpdate = (filter, update) => {
    userUpdateFilters.push(filter);
    userUpdateData.push(update);
    return {
      select() {
        userSelectFields.push("-password -tokenVersion -profileImage.publicId");
        return this;
      },
      then(resolve, reject) {
        cloudEvents.push(["database-update"]);
        if (failUserUpdate) {
          return Promise.reject(new Error("database update failed")).then(
            resolve,
            reject
          );
        }
        const record = userRecords.get(String(filter._id));
        if (record) Object.assign(record, update.$set);
        return Promise.resolve(record || null).then(resolve, reject);
      },
    };
  };
  Patient.findOneAndUpdate = async (filter, update) => {
    cloudEvents.push(["patient-update", filter, update]);
    return { _id: ids.patient, ...update };
  };
  Doctor.findOne = (filter) =>
    query(() => ({ _id: ids.doctor, profileImage: { url: "https://old.example/doctor.png", publicId: "old-doctor-id" }, userId: filter.userId }));
  Doctor.findOneAndUpdate = (filter, update) => {
    doctorUpdateFilter = filter;
    cloudEvents.push(["doctor-update", update]);
    return {
      select() {
        return this;
      },
      then(resolve, reject) {
        return Promise.resolve({
          profileImage: { url: "https://old.example/doctor.png", publicId: "old-doctor-id" },
        }).then(resolve, reject);
      },
    };
  };
  cloudinaryService.uploadProfileImage = async (buffer, folder) => {
    cloudEvents.push(["upload", folder, buffer]);
    return nextCloudinaryResult;
  };
  cloudinaryService.uploadDoctorImage = async (buffer) => {
    cloudEvents.push(["doctor-upload", buffer]);
    return nextCloudinaryResult;
  };
  cloudinaryService.deleteImage = async (publicId) => {
    cloudEvents.push(["delete", publicId]);
  };
});

afterEach(() => {
  User.findById = original.userFindById;
  User.findOneAndUpdate = original.userFindOneAndUpdate;
  Patient.findOneAndUpdate = original.patientFindOneAndUpdate;
  Doctor.findOne = original.doctorFindOne;
  Doctor.findOneAndUpdate = original.doctorFindOneAndUpdate;
  cloudinaryService.uploadProfileImage = original.uploadProfileImage;
  cloudinaryService.uploadDoctorImage = original.uploadDoctorImage;
  cloudinaryService.deleteImage = original.deleteImage;
});

test("patient, receptionist, and admin upload only their own user image", async () => {
  for (const [userId, role] of [
    [ids.user, "patient"],
    [ids.otherUser, "receptionist"],
    [ids.otherUser, "admin"],
  ]) {
    userRecords.set(userId, {
      _id: userId,
      role,
      profileImage: { url: "", publicId: "" },
    });
    const result = await userProfileService.updateOwnProfileImage(
      userId,
      role,
      pngFile()
    );
    assert.equal(String(result._id), userId);
    assert.equal(result.profileImage.url, nextCloudinaryResult.url);
    assert.equal(userUpdateFilters.at(-1)._id, userId);
    assert.deepEqual(userSelectFields.at(-1), "-password -tokenVersion -profileImage.publicId");
  }
  assert.deepEqual(
    cloudEvents.filter(([event]) => event === "upload").map(([, folder]) => folder),
    [
      "maxicare/users/patient",
      "maxicare/users/receptionist",
      "maxicare/users/admin",
    ]
  );
});

test("replacement writes metadata before best-effort deletion of the old asset", async () => {
  const result = await userProfileService.updateOwnProfileImage(
    ids.user,
    "patient",
    pngFile()
  );
  assert.equal(result.profileImage.publicId, "new-id");
  assert.deepEqual(
    cloudEvents.map(([event]) => event),
    ["upload", "database-update", "delete"]
  );
  assert.deepEqual(userUpdateData[0], {
    $set: {
      profileImage: {
        url: "https://new.example/image.png",
        publicId: "new-id",
      },
    },
  });
  assert.equal(userUpdateFilters[0]._id, ids.user);
  assert.equal(
    cloudEvents[2][1],
    "old-id",
    "old Cloudinary asset is deleted after successful database update"
  );
  assert.equal("buffer" in userUpdateData[0].$set.profileImage, false);
});

test("failed profile-image database update removes the unused new Cloudinary asset", async () => {
  failUserUpdate = true;
  await assert.rejects(
    userProfileService.updateOwnProfileImage(ids.user, "patient", pngFile()),
    /database update failed/
  );
  assert.deepEqual(
    cloudEvents.map(([event]) => event),
    ["upload", "database-update", "delete"]
  );
  assert.equal(cloudEvents[2][1], "new-id");
});

test("old-image cleanup failure does not undo a successful profile update", async () => {
  cloudinaryService.deleteImage = async () => {
    throw new Error("old Cloudinary asset is unavailable");
  };
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const result = await userProfileService.updateOwnProfileImage(
      ids.user,
      "patient",
      pngFile()
    );
    assert.equal(result.profileImage.url, nextCloudinaryResult.url);
    assert.deepEqual(
      cloudEvents.map(([event]) => event),
      ["upload", "database-update"]
    );
  } finally {
    console.error = originalConsoleError;
  }
});

test("profile image validator rejects unsupported mime, bad signatures, and files over 5 MB", () => {
  assert.equal(validateProfileImageFile(pngFile()), null);
  assert.equal(
    validateProfileImageFile(pngFile({ mimetype: "image/gif" })).statusCode,
    400
  );
  assert.equal(
    validateProfileImageFile(
      pngFile({ buffer: Buffer.from("not a png") })
    ).statusCode,
    400
  );
  assert.equal(
    validateProfileImageFile(pngFile({ size: 5 * 1024 * 1024 + 1 })).statusCode,
    400
  );
});

test("self-image endpoint is limited to the authenticated account roles and has no user-id parameter", () => {
  const route = userRoutes.stack.find(
    (layer) =>
      layer.route?.path === "/me/profile-image" &&
      layer.route.methods.patch
  );
  assert.ok(route);
  assert.equal(route.route.stack.length, 4);
  const roleGuard = route.route.stack[1].handle;
  for (const role of ["patient", "receptionist", "admin"]) {
    let passed = false;
    roleGuard({ user: { role } }, {}, () => {
      passed = true;
    });
    assert.equal(passed, true);
  }
  let doctorPassed = false;
  let doctorStatus;
  roleGuard(
    { user: { role: "doctor" } },
    {
      status(status) {
        doctorStatus = status;
        return this;
      },
      json() {},
    },
    () => {
      doctorPassed = true;
    }
  );
  assert.equal(doctorPassed, false);
  assert.equal(doctorStatus, 403);

  const doctorImageRoute = doctorRoutes.stack.find(
    (layer) =>
      layer.route?.path === "/me/profile-image" &&
      layer.route.methods.patch
  );
  assert.ok(doctorImageRoute);
  const doctorRoleGuard = doctorImageRoute.route.stack[0].handle;
  let doctorRolePassed = false;
  doctorRoleGuard({ user: { role: "doctor" } }, {}, () => {
    doctorRolePassed = true;
  });
  assert.equal(doctorRolePassed, true);

  const patientProfileRoute = patientRoutes.stack.find(
    (layer) => layer.route?.path === "/me" && layer.route.methods.put
  );
  assert.ok(patientProfileRoute);
  const patientRoleGuard = patientProfileRoute.route.stack[0].handle;
  let patientPassed = false;
  patientRoleGuard({ user: { role: "patient" } }, {}, () => {
    patientPassed = true;
  });
  assert.equal(patientPassed, true);
});

test("Doctor continues updating the canonical Doctor profile image only", async () => {
  Doctor.findOne = (filter) =>
    query(() => ({ _id: ids.doctor, userId: filter.userId }));
  Doctor.findOneAndUpdate = (filter) => {
    doctorUpdateFilter = filter;
    return {
      select() {
        return this;
      },
      then(resolve, reject) {
        return Promise.resolve({
          profileImage: {
            url: "https://old.example/doctor.png",
            publicId: "old-doctor-id",
          },
        }).then(resolve, reject);
      },
    };
  };
  const updatedDoctor = {
    _id: ids.doctor,
    profileImage: nextCloudinaryResult,
  };
  let profileReadCount = 0;
  Doctor.findOne = (filter) => {
    profileReadCount += 1;
    return profileReadCount === 1
      ? query(() => ({ _id: ids.doctor, userId: filter.userId }))
      : {
          populate() {
            return this;
          },
          then(resolve, reject) {
            return Promise.resolve(updatedDoctor).then(resolve, reject);
          },
        };
  };
  const result = await doctorService.updateMyProfileImage(
    ids.user,
    {
      ...pngFile(),
      mimetype: "image/png",
      buffer: Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x00,
      ]),
    }
  );
  assert.equal(String(doctorUpdateFilter.userId), ids.user);
  assert.equal(result.profileImage.url, nextCloudinaryResult.url);
  assert.equal(cloudEvents.at(-1)[0], "delete");
  assert.equal(cloudEvents.at(-1)[1], "old-doctor-id");
});

test("patient profile validator allowlists only personal details", () => {
  const valid = invokeValidator({
    sex: "Female",
    address: {
      street: "1 Main Street",
      barangay: "Poblacion",
      city: "Manila",
      province: "Metro Manila",
      zipCode: "1000",
    },
    mobileNumber: "09171234567",
    dateOfBirth: "1990-01-02",
  });
  assert.equal(valid.nextCalled, true);
  assert.deepEqual(valid.req.validatedPatient, {
    sex: "Female",
    gender: "Female",
    address: {
      street: "1 Main Street",
      barangay: "Poblacion",
      city: "Manila",
      province: "Metro Manila",
      zipCode: "1000",
    },
    mobileNumber: "09171234567",
    contactNumber: "09171234567",
    dateOfBirth: "1990-01-02",
  });

  for (const protectedField of [
    "firstName",
    "email",
    "patientNumber",
    "portalStatus",
    "medicalSummary",
    "userId",
  ]) {
    const rejected = invokeValidator({
      ...valid.req.body,
      [protectedField]: "not editable",
    });
    assert.equal(rejected.nextCalled, false, `${protectedField} is protected`);
    assert.equal(rejected.response.statusCode, 400);
  }
});

test("self patient update targets the existing linked Patient record", async () => {
  let filterUsed;
  let updateUsed;
  Patient.findOneAndUpdate = async (filter, update) => {
    filterUsed = filter;
    updateUsed = update;
    return { _id: ids.patient, userId: ids.user, ...update };
  };

  const validated = invokeValidator({
    sex: "Male",
    address: {
      street: "2 Main Street",
      barangay: "Poblacion",
      city: "Manila",
      province: "Metro Manila",
      zipCode: "",
    },
    mobileNumber: "09171234567",
  });
  assert.equal(validated.nextCalled, true);
  const updated = await patientService.updateOwnPatient(
    ids.user,
    validated.req.validatedPatient
  );
  assert.equal(String(filterUsed.userId), ids.user);
  assert.equal(String(updated._id), ids.patient);
  assert.equal(updateUsed.sex, "Male");
});
