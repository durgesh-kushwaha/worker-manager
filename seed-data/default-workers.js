const DEFAULT_REPORT_DATE = "2026-03-05";

const PERMANENT_WORKER = {
  workerId: "9551",
  name: "Kanhaiya",
  position: "Fabricator",
  hours: 2
};

const SEEDED_WORKERS = [
  PERMANENT_WORKER,
  { workerId: "12357", name: "Dinesh", position: "Welder", hours: 2 },
  { workerId: "7378", name: "Om prakash", position: "Fitter", hours: 2 },
  { workerId: "11852", name: "Satnam Singh", position: "Helper", hours: 2 },
  { workerId: "11217", name: "Raj Kumar", position: "Grinder", hours: 2 },
  { workerId: "11208", name: "Shaji", position: "Welder", hours: 2 },
  { workerId: "12498", name: "Safir ali", position: "Penter", hours: 2 },
  { workerId: "12456", name: "P Johny Reddy", position: "Pipe fitter", hours: 2 },
  { workerId: "11885", name: "Mp singh", position: "Helper", hours: 2 },
  { workerId: "11213", name: "Najir", position: "Grinder", hours: 2 },
  { workerId: "11268", name: "Santosh", position: "Helper", hours: 2 },
  { workerId: "12735", name: "Gulam vaish khan", position: "Riger", hours: 2 },
  { workerId: "7289", name: "Ramsevak", position: "RTRP", hours: 2 },
  { workerId: "12360", name: "Bhusayya", position: "Grinder", hours: 2 },
  { workerId: "12462", name: "Meghanath", position: "Welder", hours: 2 },
  { workerId: "9887", name: "Bala", position: "Loader operator", hours: 2 },
  { workerId: "12407", name: "D bhairagi", position: "Welder", hours: 2 },
  { workerId: "12364", name: "Shrinivas Rao", position: "Welder", hours: 2 },
  { workerId: "12361", name: "Faizullah", position: "Helper", hours: 2 },
  { workerId: "11342", name: "Md Kalam khan", position: "Fabricator", hours: 2 },
  { workerId: "6437", name: "Nizzamuddin", position: "Grinder", hours: 2 },
  { workerId: "12315", name: "Ramkrishna", position: "Fitter", hours: 2 }
];

module.exports = {
  DEFAULT_REPORT_DATE,
  PERMANENT_WORKER,
  SEEDED_WORKERS
};
