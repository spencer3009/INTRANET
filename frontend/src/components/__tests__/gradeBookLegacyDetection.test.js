/**
 * Unit test for the legacy-format detection heuristic used in GradeBookTab.
 * Mirrors the `isLegacyRegister` useMemo logic. Run with:
 *   node /app/frontend/src/components/__tests__/gradeBookLegacyDetection.test.js
 */

const LEGACY_FIELD_LIST = [
  "act_co", "act_re",
  "rf_r1", "rf_r2", "rf_r3", "rf_r4", "rf_r5",
  "comp_c1", "comp_c2",
  "part_p1", "part_p2", "part_p3", "part_exp", "part_tg", "part_p",
  "exam_mensual", "exam_bimestral",
];

function isLegacyRegister(students, plantilla) {
  if (!students || students.length === 0) return false;
  // System templates render legacy fields natively — skip detection.
  if (!plantilla || plantilla.es_sistema) return false;
  let anyDynamic = false;
  let anyLegacy = false;
  for (const s of students) {
    const gd = s.grades_dynamic || {};
    for (const v of Object.values(gd)) {
      if (v !== null && v !== undefined) { anyDynamic = true; break; }
    }
    if (anyDynamic) break;
    for (const f of LEGACY_FIELD_LIST) {
      if (s[f] !== null && s[f] !== undefined) { anyLegacy = true; break; }
    }
  }
  return !anyDynamic && anyLegacy;
}

const CUSTOM_TPL = { id: "tpl-custom", es_sistema: false };
const SYSTEM_TPL = { id: "tpl-system", es_sistema: true };

const cases = [
  {
    name: "Empty students → not legacy",
    students: [],
    plantilla: CUSTOM_TPL,
    expected: false,
  },
  {
    name: "All blank students → not legacy",
    students: [
      { student_id: "1", grades_dynamic: {}, act_co: null, rf_r1: null },
      { student_id: "2", grades_dynamic: {}, act_co: null, rf_r1: null },
    ],
    plantilla: CUSTOM_TPL,
    expected: false,
  },
  {
    name: "Pure legacy register + CUSTOM template → IS legacy",
    students: [
      { student_id: "1", grades_dynamic: {}, act_co: 18, rf_r1: 16, exam_bimestral: 15 },
      { student_id: "2", grades_dynamic: {}, act_co: 14, rf_r1: 12, exam_bimestral: 13 },
      { student_id: "3", grades_dynamic: {}, act_co: 11, rf_r1: 10 },
    ],
    plantilla: CUSTOM_TPL,
    expected: true,
  },
  {
    name: "Pure legacy register + SYSTEM template → NOT legacy (regression of school complaint)",
    students: [
      { student_id: "1", grades_dynamic: {}, act_co: 18, rf_r1: 16, exam_bimestral: 15 },
      { student_id: "2", grades_dynamic: {}, act_co: 14, rf_r1: 12, exam_bimestral: 13 },
    ],
    plantilla: SYSTEM_TPL,
    expected: false,
  },
  {
    name: "Pure dynamic register + custom template → not legacy",
    students: [
      { student_id: "1", grades_dynamic: { "sub-uuid-1": 17, "sub-uuid-2": 15 } },
      { student_id: "2", grades_dynamic: { "sub-uuid-1": 12 } },
    ],
    plantilla: CUSTOM_TPL,
    expected: false,
  },
  {
    name: "Mixed (one legacy, one dynamic) → not legacy",
    students: [
      { student_id: "1", grades_dynamic: {}, act_co: 15 },
      { student_id: "2", grades_dynamic: { "sub-uuid-1": 14 } },
    ],
    plantilla: CUSTOM_TPL,
    expected: false,
  },
  {
    name: "Only one student has legacy field, others blank + custom tpl → IS legacy",
    students: [
      { student_id: "1", grades_dynamic: {} },
      { student_id: "2", grades_dynamic: {}, rf_r2: 12.0 },
      { student_id: "3", grades_dynamic: {} },
    ],
    plantilla: CUSTOM_TPL,
    expected: true,
  },
  {
    name: "grades_dynamic missing entirely + custom tpl → IS legacy",
    students: [
      { student_id: "1", part_p1: 18, exam_mensual: 15 },
    ],
    plantilla: CUSTOM_TPL,
    expected: true,
  },
  {
    name: "grades_dynamic with all null + custom tpl → IS legacy",
    students: [
      { student_id: "1", grades_dynamic: { "x": null, "y": null }, act_co: 17 },
    ],
    plantilla: CUSTOM_TPL,
    expected: true,
  },
  {
    name: "No plantilla loaded yet → not legacy",
    students: [
      { student_id: "1", grades_dynamic: {}, act_co: 18 },
    ],
    plantilla: null,
    expected: false,
  },
];

let passed = 0, failed = 0;
for (const c of cases) {
  const got = isLegacyRegister(c.students, c.plantilla);
  const ok = got === c.expected;
  if (ok) {
    passed++;
    console.log(`  PASS  ${c.name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${c.name}`);
    console.log(`        expected=${c.expected}, got=${got}`);
  }
}
console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
