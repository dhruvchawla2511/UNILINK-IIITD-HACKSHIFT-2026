import crypto from 'node:crypto';
import { db } from './db.js';
import { HttpError } from './rest.js';

const clean = (v, n = 200) => String(v ?? '').trim().slice(0, n);
const admin = (u) => ['admin', 'super_admin'].includes(u?.role);
const publicDomains = new Set(['gmail.com','googlemail.com','yahoo.com','yahoo.co.in','outlook.com','hotmail.com','live.com','icloud.com','proton.me','protonmail.com','rediffmail.com']);

db.exec(`
CREATE TABLE IF NOT EXISTS professional_companies (
 id TEXT PRIMARY KEY, name TEXT NOT NULL COLLATE NOCASE UNIQUE, website TEXT NOT NULL DEFAULT '',
 domains TEXT NOT NULL DEFAULT '[]', source TEXT NOT NULL DEFAULT 'seed' CHECK(source IN ('seed','founder')),
 verified INTEGER NOT NULL DEFAULT 1 CHECK(verified IN (0,1)), created_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS company_verification_requests (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 company_id TEXT NOT NULL REFERENCES professional_companies(id) ON DELETE CASCADE,
 request_type TEXT NOT NULL CHECK(request_type IN ('recruiter_domain','founder_company')),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 email_domain TEXT NOT NULL DEFAULT '', job_title TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '', reviewed_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
 reviewed_at TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_company_verification_status ON company_verification_requests(status, request_type, created_at);
CREATE TABLE IF NOT EXISTS recruiter_company_requests (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 company_id TEXT NOT NULL REFERENCES professional_companies(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 email_domain TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
 reviewed_by TEXT REFERENCES profiles(id) ON DELETE SET NULL, reviewed_at TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_recruiter_company_requests_status ON recruiter_company_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_company_verification_user ON company_verification_requests(user_id, created_at);
`);

// Seed company choices. Domains are exact corporate mail domains, not inferred from company names.
const seedCompanies = [
 ['Accenture','accenture.com'],['Adobe','adobe.com'],['Airbnb','airbnb.com'],['Amazon','amazon.com;amazon.in'],['American Express','aexp.com;americanexpress.com'],['Apple','apple.com'],['Atlassian','atlassian.com'],['Bain & Company','bain.com'],['Barclays','barclays.com'],['BCG','bcg.com'],['Bloomberg','bloomberg.net'],['Bosch','bosch.com'],['Capgemini','capgemini.com'],['Cisco','cisco.com'],['Cognizant','cognizant.com'],['Deloitte','deloitte.com'],['Flipkart','flipkart.com'],['Freshworks','freshworks.com'],['Goldman Sachs','gs.com'],['Google','google.com'],['HCLTech','hcl.com;hcltech.com'],['IBM','ibm.com'],['Infosys','infosys.com'],['Intel','intel.com'],['JPMorgan Chase','jpmorgan.com;chase.com'],['KPMG','kpmg.com'],['LinkedIn','linkedin.com'],['L&T Technology Services','ltts.com'],['Mahindra','mahindra.com'],['Meta','meta.com;fb.com'],['Microsoft','microsoft.com'],['Morgan Stanley','morganstanley.com'],['Netflix','netflix.com'],['NVIDIA','nvidia.com'],['Oracle','oracle.com'],['PayPal','paypal.com'],['PepsiCo','pepsico.com'],['PwC','pwc.com'],['Qualcomm','qualcomm.com'],['Salesforce','salesforce.com'],['SAP','sap.com'],['ServiceNow','servicenow.com'],['Siemens','siemens.com'],['Spotify','spotify.com'],['Tata Consultancy Services (TCS)','tcs.com'],['Tata Motors','tatamotors.com'],['Tech Mahindra','techmahindra.com'],['Tesla','tesla.com'],['Uber','uber.com'],['Unilever','unilever.com'],['Walmart','walmart.com'],['Wipro','wipro.com'],['Wells Fargo','wellsfargo.com'],['Zoho','zohocorp.com;zoho.com'],
];
const insertCompany = db.prepare(`INSERT OR IGNORE INTO professional_companies(id,name,website,domains,source,verified) VALUES(?,?,?,?, 'seed',1)`);
for (const [name, domains] of seedCompanies) {
  const domainList = domains.split(';');
  const main = domainList[0];
  insertCompany.run(crypto.createHash('sha256').update(`unilink-company:${name}`).digest('hex').slice(0, 36), name, `https://${main}`, JSON.stringify(domainList));
}

function getCurrent(userId) {
 return db.prepare(`SELECT p.id,p.portal_type,u.email,u.email_confirmed_at FROM profiles p JOIN users u ON u.id=p.id WHERE p.id=?`).get(userId);
}
function currentStatus(userId) {
 return db.prepare(`SELECT r.*,c.name AS company_name,c.website,c.verified AS company_verified FROM company_verification_requests r JOIN professional_companies c ON c.id=r.company_id WHERE r.user_id=? ORDER BY r.created_at DESC LIMIT 1`).get(userId) ?? null;
}
function safeDomain(v) {
 const raw = clean(v, 253).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split(':')[0].replace(/\.$/, '');
 if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(raw) || publicDomains.has(raw)) throw new HttpError('Enter a company-owned domain (for example, company.com), not a public email provider.');
 return raw;
}

export function companyVerification(user, body) {
 const action = clean(body.action, 50);
 if (action === 'companies.list') return { companies: db.prepare('SELECT id,name,website,domains FROM professional_companies WHERE verified=1 ORDER BY name COLLATE NOCASE').all().map(c => ({...c, domains: JSON.parse(c.domains)})) };
 if (action === 'my.status') return { status: currentStatus(user.id), email_confirmed: !!getCurrent(user.id)?.email_confirmed_at };
 if (action === 'recruiter.company.submit') {
   const me = getCurrent(user.id);
   if (me?.portal_type !== 'recruiter') throw new HttpError('Switch to the recruiter portal to request a company listing.', 403);
   if (!me.email_confirmed_at) throw new HttpError('Confirm your UniLink email address before requesting a company listing.');
   const name = clean(body.company_name, 120);
   const domain = safeDomain(body.domain);
   const websiteInput = clean(body.website, 300);
   const website = websiteInput ? (/^https?:\/\//i.test(websiteInput) ? websiteInput : `https://${websiteInput}`).slice(0,300) : `https://${domain}`;
   const notes = clean(body.notes, 1000);
   if (name.length < 2) throw new HttpError('Enter the company name.');
   if (!/^https?:\/\//i.test(website)) throw new HttpError('Enter a valid company website.');
   const existing = db.prepare(`SELECT * FROM professional_companies WHERE lower(name)=lower(?) OR domains LIKE ?`).get(name, `%\"${domain}\"%`);
   if (existing?.verified) throw new HttpError('This company is already verified. Select it from the company list.');
   if (existing) {
     const pending = db.prepare(`SELECT id FROM recruiter_company_requests WHERE company_id=? AND status='pending'`).get(existing.id);
     if (pending) throw new HttpError('This company is already waiting for admin review.');
     throw new HttpError('A company with this name or domain is already awaiting review. Contact UniLink support if you represent it.');
   }
   const companyId = crypto.randomUUID();
   const requestId = crypto.randomUUID();
   db.exec('BEGIN');
   try {
     // Pending companies remain hidden from the verified-company picker until an admin approves them.
     db.prepare(`INSERT INTO professional_companies(id,name,website,domains,source,verified,created_by) VALUES(?,?,?,?,'founder',0,?)`).run(companyId,name,website,JSON.stringify([domain]),user.id);
     db.prepare(`INSERT INTO recruiter_company_requests(id,user_id,company_id,email_domain,notes) VALUES(?,?,?,?,?)`).run(requestId,user.id,companyId,domain,notes);
     db.exec('COMMIT');
   } catch (e) { db.exec('ROLLBACK'); throw e; }
   return { message: 'Company submitted for admin review. It will appear in the verified-company list after approval.' };
 }
 if (action === 'recruiter.verify') {
   const me = getCurrent(user.id);
   if (me?.portal_type !== 'recruiter') throw new HttpError('Switch to the recruiter portal to verify an employer.', 403);
   const company = db.prepare('SELECT * FROM professional_companies WHERE id=? AND verified=1').get(clean(body.company_id, 80));
   if (!company) throw new HttpError('Choose a company from the verified company list.');
   if (!me.email_confirmed_at) throw new HttpError('Confirm your UniLink email address before company verification.');
   const domain = String(me.email).toLowerCase().split('@').pop();
   const domains = JSON.parse(company.domains);
   if (!domains.includes(domain)) throw new HttpError(`Your confirmed email domain (@${domain}) does not match ${company.name}'s listed company email domains.`);
   db.prepare(`DELETE FROM company_verification_requests WHERE user_id=? AND request_type='recruiter_domain'`).run(user.id);
   db.prepare(`INSERT INTO company_verification_requests(id,user_id,company_id,request_type,status,email_domain,reviewed_at) VALUES(?,?,?,'recruiter_domain','approved',?,?)`).run(crypto.randomUUID(),user.id,company.id,domain,new Date().toISOString());
   return { status: currentStatus(user.id), verified: true };
 }
 if (action === 'founder.submit') {
   const me = getCurrent(user.id);
   if (me?.portal_type !== 'founder') throw new HttpError('Switch to the founder portal to submit a company.', 403);
   const name = clean(body.company_name, 120);
   const domain = safeDomain(body.domain);
   const websiteInput = clean(body.website, 300);
   const website = websiteInput ? (/^https?:\/\//i.test(websiteInput) ? websiteInput : `https://${websiteInput}`).slice(0,300) : `https://${domain}`;
   const notes = clean(body.notes, 1000);
   if (name.length < 2) throw new HttpError('Enter your company or startup name.');
   if (!/^https?:\/\//i.test(website)) throw new HttpError('Enter a valid company website.');
   const existing = db.prepare(`SELECT * FROM professional_companies WHERE lower(name)=lower(?) OR domains LIKE ?`).get(name, `%\"${domain}\"%`);
   if (existing?.verified) throw new HttpError('This company is already in the company directory. Select it or contact support if its details are incorrect.');
   if (existing?.created_by && existing.created_by !== user.id) throw new HttpError('This company or domain is already part of another pending submission. Contact UniLink support if you represent the same company.');
   const companyId = existing?.id ?? crypto.randomUUID();
   if (existing) db.prepare(`UPDATE professional_companies SET name=?,website=?,domains=?,source='founder',verified=0,created_by=? WHERE id=?`).run(name,website,JSON.stringify([domain]),user.id,companyId);
   else db.prepare(`INSERT INTO professional_companies(id,name,website,domains,source,verified,created_by) VALUES(?,?,?,?,'founder',0,?)`).run(companyId,name,website,JSON.stringify([domain]),user.id);
   const old = db.prepare(`SELECT id FROM company_verification_requests WHERE user_id=? AND request_type='founder_company' AND status='pending'`).get(user.id);
   if (old) db.prepare(`UPDATE company_verification_requests SET company_id=?,email_domain=?,notes=?,created_at=? WHERE id=?`).run(companyId,domain,notes,new Date().toISOString(),old.id);
   else db.prepare(`INSERT INTO company_verification_requests(id,user_id,company_id,request_type,status,email_domain,notes) VALUES(?,?,?,'founder_company','pending',?,?)`).run(crypto.randomUUID(),user.id,companyId,domain,notes);
   return { status: currentStatus(user.id), message: 'Company submitted for admin review. The Founder verification badge is added only after approval.' };
 }
 if (action === 'admin.list') {
   if (!admin(user)) throw new HttpError('Only website admins can review company verification requests.', 403);
   return { requests: db.prepare(`
     SELECT * FROM (
       SELECT r.id,r.request_type,r.status,r.email_domain,r.notes,r.created_at,c.name AS company_name,c.website,p.full_name,u.email
       FROM company_verification_requests r JOIN professional_companies c ON c.id=r.company_id JOIN profiles p ON p.id=r.user_id JOIN users u ON u.id=r.user_id
       WHERE r.request_type='founder_company'
       UNION ALL
       SELECT r.id,'recruiter_company' AS request_type,r.status,r.email_domain,r.notes,r.created_at,c.name AS company_name,c.website,p.full_name,u.email
       FROM recruiter_company_requests r JOIN professional_companies c ON c.id=r.company_id JOIN profiles p ON p.id=r.user_id JOIN users u ON u.id=r.user_id
     ) ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END,created_at DESC
   `).all() };
 }
 if (action === 'admin.resolve') {
   if (!admin(user)) throw new HttpError('Only website admins can review company verification requests.', 403);
   const status = body.status;
   if (!['approved','rejected'].includes(status)) throw new HttpError('Choose approve or reject.');
   const id = clean(body.id,80);
   const recruiterReq = db.prepare(`SELECT * FROM recruiter_company_requests WHERE id=?`).get(id);
   const req = recruiterReq ?? db.prepare(`SELECT * FROM company_verification_requests WHERE id=? AND request_type='founder_company'`).get(id);
   if (!req) throw new HttpError('Company request not found.',404);
   db.exec('BEGIN');
   try {
     if (recruiterReq) db.prepare(`UPDATE recruiter_company_requests SET status=?,reviewed_by=?,reviewed_at=? WHERE id=?`).run(status,user.id,new Date().toISOString(),req.id);
     else db.prepare(`UPDATE company_verification_requests SET status=?,reviewed_by=?,reviewed_at=? WHERE id=?`).run(status,user.id,new Date().toISOString(),req.id);
     db.prepare(`UPDATE professional_companies SET verified=? WHERE id=?`).run(status==='approved'?1:0,req.company_id);
     db.exec('COMMIT');
   } catch (e) { db.exec('ROLLBACK'); throw e; }
   return { ok:true };
 }
 throw new HttpError('Unknown company verification action.', 400);
}
