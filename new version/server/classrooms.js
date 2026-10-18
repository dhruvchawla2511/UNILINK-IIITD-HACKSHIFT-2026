import crypto from 'node:crypto';
import { db } from './db.js';
import { newClassJoinCode, normalizeClassJoinCode } from './joinCodes.js';
import { HttpError } from './rest.js';

db.exec(`
CREATE TABLE IF NOT EXISTS teacher_classes(id TEXT PRIMARY KEY, teacher_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, title TEXT NOT NULL, subject TEXT NOT NULL DEFAULT '', join_code TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS teacher_class_members(class_id TEXT NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE, student_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(class_id,student_id));
CREATE TABLE IF NOT EXISTS teacher_class_notes(id TEXT PRIMARY KEY, class_id TEXT NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE, author_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, title TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS teacher_class_announcements(id TEXT PRIMARY KEY, class_id TEXT NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE, author_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, title TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS teacher_class_assignments(id TEXT PRIMARY KEY, class_id TEXT NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE, author_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, title TEXT NOT NULL, instructions TEXT NOT NULL, due_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS teacher_class_submissions(id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL REFERENCES teacher_class_assignments(id) ON DELETE CASCADE, student_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, answer TEXT NOT NULL, submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, grade TEXT NOT NULL DEFAULT '', feedback TEXT NOT NULL DEFAULT '', reviewed_at TEXT, UNIQUE(assignment_id,student_id));
CREATE INDEX IF NOT EXISTS idx_teacher_classes_teacher ON teacher_classes(teacher_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_teacher_class_members_student ON teacher_class_members(student_id,joined_at DESC);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_class ON teacher_class_assignments(class_id,due_at);
`);
const trim=(v,n=4000)=>String(v??'').trim().slice(0,n);
const ensure=(ok,msg,status=400)=>{if(!ok)throw new HttpError(msg,status)};
const role=(id)=>db.prepare('SELECT portal_type,full_name FROM profiles WHERE id=?').get(id)||{};
const classRow=(id)=>db.prepare('SELECT c.*,p.full_name AS teacher_name FROM teacher_classes c JOIN profiles p ON p.id=c.teacher_id WHERE c.id=?').get(id);
const member=(cid,uid)=>!!db.prepare('SELECT 1 FROM teacher_class_members WHERE class_id=? AND student_id=?').get(cid,uid);
const canRead=(c,u)=>c&&(c.teacher_id===u.id||member(c.id,u.id));
function notifyStudents(classId,actorId,kind,message,targetId){const rows=db.prepare('SELECT student_id FROM teacher_class_members WHERE class_id=?').all(classId);const insert=db.prepare('INSERT INTO campus_notifications(id,user_id,actor_id,kind,message,target_id) VALUES(?,?,?,?,?,?)');for(const row of rows){if(row.student_id!==actorId)insert.run(crypto.randomUUID(),row.student_id,actorId,kind,message,targetId);}}
export function classrooms(user,b){
 const action=trim(b.action,60), me=user.id, meRole=role(me).portal_type;
 if(action==='class.list') return db.prepare(`SELECT c.*,p.full_name AS teacher_name,(SELECT COUNT(*) FROM teacher_class_members m WHERE m.class_id=c.id) AS student_count,CASE WHEN c.teacher_id=? THEN 1 ELSE 0 END AS is_teacher FROM teacher_classes c JOIN profiles p ON p.id=c.teacher_id WHERE c.teacher_id=? OR EXISTS(SELECT 1 FROM teacher_class_members m WHERE m.class_id=c.id AND m.student_id=?) ORDER BY c.created_at DESC`).all(me,me,me);
 if(action==='class.create'){
  ensure(meRole==='teacher','Only teacher accounts can create classes',403);
  const title=trim(b.title,120),subject=trim(b.subject,120);ensure(title.length>=2,'Enter a class name');
  const code = newClassJoinCode(db);
  const id=crypto.randomUUID();db.prepare('INSERT INTO teacher_classes(id,teacher_id,title,subject,join_code) VALUES(?,?,?,?,?)').run(id,me,title,subject,code);return classRow(id);
 }
 if(action==='class.join'){
  ensure(meRole==='student','Only student accounts can join a class',403);const code=normalizeClassJoinCode(trim(b.code,160));ensure(/^[a-z]+(?:-[a-z]+){7}$/.test(code),'Enter the 8-word class code');const c=db.prepare('SELECT * FROM teacher_classes WHERE join_code=?').get(code);ensure(c,'That class code was not found',404);db.prepare('INSERT OR IGNORE INTO teacher_class_members(class_id,student_id) VALUES(?,?)').run(c.id,me);return classRow(c.id);
 }
 const cid=trim(b.class_id,80),c=classRow(cid);ensure(canRead(c,user),'You are not a member of this class',403);
 if(action==='class.notes.list')return db.prepare('SELECT n.*,p.full_name AS author_name FROM teacher_class_notes n JOIN profiles p ON p.id=n.author_id WHERE n.class_id=? ORDER BY n.created_at DESC').all(cid);
 if(action==='class.announcements.list')return db.prepare('SELECT a.*,p.full_name AS author_name FROM teacher_class_announcements a JOIN profiles p ON p.id=a.author_id WHERE a.class_id=? ORDER BY a.created_at DESC').all(cid);
 if(action==='class.assignments.list')return db.prepare(`SELECT a.*,p.full_name AS author_name,(SELECT COUNT(*) FROM teacher_class_submissions s WHERE s.assignment_id=a.id) AS submission_count,(SELECT answer FROM teacher_class_submissions s WHERE s.assignment_id=a.id AND s.student_id=?) AS my_answer,(SELECT grade FROM teacher_class_submissions s WHERE s.assignment_id=a.id AND s.student_id=?) AS my_grade,(SELECT feedback FROM teacher_class_submissions s WHERE s.assignment_id=a.id AND s.student_id=?) AS my_feedback FROM teacher_class_assignments a JOIN profiles p ON p.id=a.author_id WHERE a.class_id=? ORDER BY CASE WHEN a.due_at IS NULL THEN 1 ELSE 0 END,a.due_at ASC,a.created_at DESC`).all(me,me,me,cid);
 if(action==='class.assignments.create'){ensure(c.teacher_id===me,'Only the class teacher can create assignments',403);const title=trim(b.title,160),instructions=trim(b.instructions,8000),dueAt=trim(b.due_at,40)||null;ensure(title.length>=2&&instructions.length>=2,'Add an assignment title and instructions');if(dueAt)ensure(!Number.isNaN(Date.parse(dueAt)),'Enter a valid due date');const id=crypto.randomUUID();db.prepare('INSERT INTO teacher_class_assignments(id,class_id,author_id,title,instructions,due_at) VALUES(?,?,?,?,?,?)').run(id,cid,me,title,instructions,dueAt?new Date(dueAt).toISOString():null);notifyStudents(cid,me,'class_assignment',`published an assignment: ${title}`,id);return {id};}
 if(action==='class.assignments.submit'){ensure(meRole==='student','Only student accounts can submit assignments',403);const id=trim(b.assignment_id,80),answer=trim(b.answer,8000);const assignment=db.prepare('SELECT * FROM teacher_class_assignments WHERE id=? AND class_id=?').get(id,cid);ensure(assignment,'Assignment not found',404);ensure(answer.length>=1,'Write your answer before submitting');if(assignment.due_at)ensure(Date.now()<=Date.parse(assignment.due_at),'The deadline for this assignment has passed',409);const existing=db.prepare('SELECT id FROM teacher_class_submissions WHERE assignment_id=? AND student_id=?').get(id,me);if(existing)db.prepare("UPDATE teacher_class_submissions SET answer=?,submitted_at=CURRENT_TIMESTAMP,grade='',feedback='',reviewed_at=NULL WHERE id=?").run(answer,existing.id);else db.prepare('INSERT INTO teacher_class_submissions(id,assignment_id,student_id,answer) VALUES(?,?,?,?)').run(crypto.randomUUID(),id,me,answer);return {ok:true};}
 if(action==='class.assignments.submissions'){ensure(c.teacher_id===me,'Only the class teacher can view submissions',403);return db.prepare('SELECT s.*,p.full_name AS student_name FROM teacher_class_submissions s JOIN profiles p ON p.id=s.student_id WHERE s.assignment_id=? ORDER BY s.submitted_at DESC').all(trim(b.assignment_id,80));}
 if(action==='class.assignments.grade'){ensure(c.teacher_id===me,'Only the class teacher can review submissions',403);const id=trim(b.submission_id,80),grade=trim(b.grade,40),feedback=trim(b.feedback,2000);const submission=db.prepare('SELECT s.* FROM teacher_class_submissions s JOIN teacher_class_assignments a ON a.id=s.assignment_id WHERE s.id=? AND a.class_id=?').get(id,cid);ensure(submission,'Submission not found',404);db.prepare('UPDATE teacher_class_submissions SET grade=?,feedback=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?').run(grade,feedback,id);return {ok:true};}
 if(action==='class.notes.create'){
  ensure(c.teacher_id===me,'Only the class teacher can post notes',403);const title=trim(b.title,160),body=trim(b.body,8000);ensure(title.length>=2&&body.length>=2,'Add a note title and content');const id=crypto.randomUUID();db.prepare('INSERT INTO teacher_class_notes(id,class_id,author_id,title,body) VALUES(?,?,?,?,?)').run(id,cid,me,title,body);notifyStudents(cid,me,'class_note',`shared new notes: ${title}`,id);return {id,class_id:cid,title,body,author_id:me,author_name:role(me).full_name,created_at:new Date().toISOString()};
 }
 if(action==='class.announcements.create'){
  ensure(c.teacher_id===me,'Only the class teacher can publish announcements',403);const title=trim(b.title,160),body=trim(b.body,4000);ensure(title.length>=2&&body.length>=2,'Add an announcement title and message');const id=crypto.randomUUID();db.prepare('INSERT INTO teacher_class_announcements(id,class_id,author_id,title,body) VALUES(?,?,?,?,?)').run(id,cid,me,title,body);notifyStudents(cid,me,'class_announcement',`posted an announcement: ${title}`,id);return {id,class_id:cid,title,body,author_id:me,author_name:role(me).full_name,created_at:new Date().toISOString()};
 }
 if(action==='class.members.list')return db.prepare('SELECT p.id,p.full_name,m.joined_at FROM teacher_class_members m JOIN profiles p ON p.id=m.student_id WHERE m.class_id=? ORDER BY m.joined_at').all(cid);
 throw new HttpError('Unknown class action',400);
}
