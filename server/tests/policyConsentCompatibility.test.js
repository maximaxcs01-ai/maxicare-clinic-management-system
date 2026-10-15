const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { CURRENT_TERMS_VERSION } = require("../config/terms");

const clientRoot = path.resolve(__dirname, "../../client/src");
const readClient = (relativePath) =>
  fs.readFileSync(path.join(clientRoot, relativePath), "utf8");

test("frontend policy version matches the backend-authoritative version", () => {
  const clientConfig = readClient("config/legal.js");
  const match = clientConfig.match(
    /CURRENT_TERMS_VERSION\s*=\s*['"]([^'"]+)['"]/u
  );

  assert.ok(match, "Client policy version constant is missing");
  assert.equal(match[1], CURRENT_TERMS_VERSION);
});

test("registration submits the same version displayed by the policy dialog", () => {
  const register = readClient("pages/Register.jsx");
  const dialog = readClient("components/TermsPrivacyDialog.jsx");

  assert.match(register, /termsVersion:\s*CURRENT_TERMS_VERSION/u);
  assert.match(dialog, /Version \{CURRENT_TERMS_VERSION\}/u);
  assert.match(register, /disabled=\{loading \|\| !formIsValid \|\| !policyAccepted\}/u);
  assert.match(register, /onAccept=\{\(\) => \{[\s\S]*setPolicyAccepted\(true\)/u);
});

test("Visit Summary source contains no private or security-only fields", () => {
  const summary = readClient("pages/PatientMedicalRecord.jsx");

  for (const forbidden of [
    "privateNotes",
    "publicId",
    "password",
    "tokenVersion",
    "auditMetadata",
  ]) {
    assert.equal(summary.includes(forbidden), false, `${forbidden} must stay absent`);
  }
});

test("print view isolates the Visit Summary and hides portal actions", () => {
  const summary = readClient("pages/PatientMedicalRecord.jsx");
  const styles = readClient("patient-portal.css");
  const printRules = styles.slice(styles.indexOf("@media print"));

  assert.match(summary, /onClick=\{\(\) => window\.print\(\)\}/u);
  assert.match(printRules, /body \*\s*\{\s*visibility:\s*hidden/u);
  assert.match(printRules, /\.visit-summary,\s*\.visit-summary \*\s*\{\s*visibility:\s*visible/u);
  assert.match(printRules, /\.visit-summary-print/u);
  assert.match(printRules, /\.visit-summary-back/u);
  assert.match(printRules, /\.MuiDrawer-root/u);
  assert.match(printRules, /\.MuiAppBar-root/u);
  assert.match(printRules, /display:\s*none !important/u);
});
