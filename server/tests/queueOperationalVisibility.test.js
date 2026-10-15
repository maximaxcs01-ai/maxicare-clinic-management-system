const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const Doctor = require("../models/Doctor");
const QueueEntry = require("../models/QueueEntry");
const queueService = require("../services/queueService");

const originalFind = QueueEntry.find;
const originalDoctorFindOne = Doctor.findOne;

afterEach(() => {
  QueueEntry.find = originalFind;
  Doctor.findOne = originalDoctorFindOne;
});

test("operational queue includes in-consultation patients without queue positions", async () => {
  const doctorId = "620000000000000000000001";
  const entries = [
    {
      _id: "queue-waiting",
      doctorId: { _id: doctorId },
      queueStatus: "waiting",
      toObject() {
        return this;
      },
    },
    {
      _id: "queue-in-consultation",
      doctorId: { _id: doctorId },
      queueStatus: "in_consultation",
      active: false,
      toObject() {
        return this;
      },
    },
  ];
  let filter;
  QueueEntry.find = (query) => {
    filter = query;
    return {
      populate() {
        return this;
      },
      sort() {
        return this;
      },
      then(resolve, reject) {
        return Promise.resolve(entries).then(resolve, reject);
      },
    };
  };

  for (const role of ["admin", "receptionist"]) {
    const result = await queueService.listTodayQueue({
      _id: `${role}-user`,
      role,
    });
    assert.deepEqual(result.data.map((entry) => entry.queueStatus), [
      "waiting",
      "in_consultation",
    ]);
    assert.equal(result.data[0].queuePosition, 1);
    assert.equal(result.data[1].queuePosition, null);
    assert.deepEqual(filter.$or, [
      { active: true, queueStatus: { $in: ["waiting", "called"] } },
      { active: false, queueStatus: "in_consultation" },
    ]);
  }
});

test("doctor queue remains scoped to active waiting and called entries", async () => {
  const doctorId = "620000000000000000000001";
  let filter;
  Doctor.findOne = () => ({
    select() {
      return Promise.resolve({ _id: doctorId });
    },
  });
  QueueEntry.find = (query) => {
    filter = query;
    return {
      populate() {
        return this;
      },
      sort() {
        return this;
      },
      then(resolve, reject) {
        return Promise.resolve([]).then(resolve, reject);
      },
    };
  };

  await queueService.listTodayQueue({
    _id: "doctor-user",
    role: "doctor",
  });
  assert.equal(filter.doctorId, doctorId);
  assert.equal(filter.active, true);
  assert.deepEqual(filter.queueStatus, { $in: ["waiting", "called"] });
  assert.equal(filter.$or, undefined);
});
