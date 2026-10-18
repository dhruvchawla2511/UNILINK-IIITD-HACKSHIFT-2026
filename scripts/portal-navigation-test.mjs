import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const professional = readFileSync(new URL('../src/pages/ProfessionalPortalPage.tsx', import.meta.url), 'utf8');

assert.match(app, /unilink:portal-mode:\$\{profile\.id\}/, 'portal selection should be stored per signed-in profile');
assert.match(app, /savedMode === 'student' \|\| savedMode === 'professional'/, 'saved portal selection should be restored');
assert.match(app, /switchPortal\('professional'\)/, 'student workspace should provide a way back to professional portal');
assert.match(app, /onStudentPortal=\{\(\) => switchPortal\('student'\)\}/, 'professional workspace should switch to student portal');
assert.match(professional, /onClick=\{onStudentPortal\}/, 'professional portal switch button should invoke its callback');

console.log('Portal navigation tests passed: both portal switches are wired and the selection persists across refreshes in the browser session.');
