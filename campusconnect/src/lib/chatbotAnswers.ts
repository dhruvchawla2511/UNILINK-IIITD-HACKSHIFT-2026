// Simple rule-based answers for the Unilink help bot. No server or AI needed:
// each topic has keywords; the topic with the most keyword hits wins.
// To teach the bot something new, add an entry to TOPICS below.

export interface Topic {
  keywords: string[];
  answer: string;
}

export const GREETING =
  "Hi! I’m your UniLink Campus Assistant 👋\n\nI can help you navigate UniLink, plan your study week, prepare for exams and placements, discover campus opportunities, understand student safety, and look up colleges. I can suggest a plan based on the details you share, but I can’t see private campus records or confirm live event availability unless that information is provided.\n\nTry one of these: plan my week · find internship opportunities · prepare for placements · stay safe on campus.";

export const FALLBACK =
  "I’m not fully sure I understood that. Try asking in a different way, or choose a topic: account verification, chat rooms, direct messages, college directory, events, study tips, placements, internships, scholarships, or reporting/blocking someone.";

export const SUGGESTIONS = [
  'How do I get verified?',
  'How do I join a room?',
  'Tips to study better',
  'How do I prepare for placements?',
  'Help me plan my week',
  'How do I find an internship?',
  'How do I stay safe on the marketplace?',
  'What are chat commands?',
  'I feel stressed',
];

export const TOPICS: Topic[] = [
  {
    keywords: ['hi', 'hello', 'hey', 'hii', 'namaste', 'help'],
    answer:
      'Hello! I can help with UniLink features, study planning, exams, placements, internships, campus events, college information, and student safety. Tell me your goal and any deadline or constraints, and I’ll suggest practical next steps.',
  },
  {
    keywords: ['what is unilink', 'about', 'unilink', 'campusconnect', 'what is this', 'purpose'],
    answer:
      'Unilink (Connect Beyond Campus) is a community platform for students: chat rooms, direct messages, a college directory, events and a media gallery, all in one place.',
  },
  {
    keywords: ['verify', 'verified', 'verification', 'approve', 'approval', 'pending'],
    answer:
      "To get verified: 1) Choose your college on your Profile. 2) Request verification for it. 3) Wait for a college officer or an admin to approve you. You can only have one pending request at a time, and if you're rejected you can ask again. Verified students can see their college's chat rooms.",
  },
  {
    keywords: ['code', 'join', 'join a room', 'join room', 'join with code', 'room code', 'private room', 'key'],
    answer:
      "Every room has a 6-digit code shown in the chat header. To join one, click the key button above the room list, type the code and you're in. Private rooms only appear for you after you join with the code.",
  },
  {
    keywords: ['create room', 'new room', 'make room', 'create a room', 'start room'],
    answer:
      "Anyone can create a private room. Verified students can create a room for their own college. Global rooms can only be created by website admins.",
  },
  {
    keywords: ['chat', 'room', 'rooms', 'global', 'college chat', 'message room'],
    answer:
      'There are three kinds of rooms: Global (everyone), College (only verified students of that college) and Private (only people who joined with the code). You can send text, photos, videos, audio, files and polls.',
  },
  {
    keywords: ['dm', 'direct', 'direct message', 'private message', 'message someone', 'new message', 'personal'],
    answer:
      'Open Messages in the menu and press "New message" to search for someone by name, or press the Message button on anyone\'s profile card. Only the two of you can read a direct message. You can also block the other person or report a message.',
  },
  {
    keywords: ['command', 'commands', '/help', 'mute', 'kick', 'ban', 'slash'],
    answer:
      'Type / in any chat room to see the commands, like /help, /mute, /kick and /ban. What you can use depends on your college rank or admin role.',
  },
  {
    keywords: ['rank', 'college rank', 'college ranks', 'president', 'secretary', 'officer', 'committee', 'vice'],
    answer:
      'College ranks are president, vice president, secretary and committee head. They manage chat and rooms in their own college and can verify students who asked for their college. A website admin gives the first rank.',
  },
  {
    keywords: ['college', 'directory', 'tier', 'missing college', 'request college', 'add college'],
    answer:
      "The Colleges page lists about 200 Indian and international colleges, which you can filter by tier and country. If yours is missing, use the request option to ask admins to add it.",
  },
  {
    keywords: ['event', 'events', 'post event', 'upcoming'],
    answer:
      'The Events page lets you post and discover events across campuses. College officers can limit an event to their own college. Upcoming events also show on the Home page.',
  },
  {
    keywords: ['gallery', 'photo', 'photos', 'video', 'videos', 'image', 'images', 'media'],
    answer:
      'The Gallery shows every image and video, with tabs, category filters, search and a full-screen viewer.',
  },
  {
    keywords: ['profile', 'change my college', 'edit profile', 'name', 'change college', 'switch college', 'avatar'],
    answer:
      'Open Profile in the menu to edit your details and choose your college. Note: if you switch colleges, your verified status is removed until the new college verifies you, and the old college chats close.',
  },
  {
    keywords: ['report', 'flag', 'abuse', 'spam', 'harass', 'inappropriate'],
    answer:
      'Hover over a message and press the flag button, pick a reason, add details if you like, and send. You cannot report your own messages, and each message can be reported once. Moderators review reports.',
  },
  {
    keywords: ['block', 'blocked'],
    answer: 'In a direct message you can block the other person from the conversation menu.',
  },
  {
    keywords: ['dark', 'light', 'theme', 'mode', 'night'],
    answer: 'Use the "Dark mode" / "Light mode" button in the sidebar. Your choice is remembered.',
  },
  {
    keywords: ['password', 'account', 'security', 'login', 'sign in', 'signin', 'sign up', 'signup', 'logout', 'sign out'],
    answer:
      'Sign up or sign in on the first screen. You can manage your account security from your Profile, and Sign Out is at the bottom of the sidebar.',
  },
  {
    keywords: ['admin', 'super admin', 'moderator', 'dashboard'],
    answer:
      'Admins have an Admin Panel in the menu with a dashboard (signups, pending verifications, active rooms, open reports), student, college and room management, and a Home Page editor for super admins.',
  },
  {
    keywords: ['email', 'privacy', 'private', 'who can see'],
    answer:
      'Your email is private: you see your own, website admins see everyone\'s, and college officers see people of their own college. Everyone else sees no email.',
  },
  {
    keywords: ['community', 'community feed', 'post', 'posts', 'like', 'comment', 'reaction', 'global feed'],
    answer: 'Use Community to share updates and join campus conversations. Choose the audience carefully: College-only is for people from your college, while Global / All Colleges is for cross-campus posts. Keep posts respectful, and report content that breaks community rules.',
  },
  {
    keywords: ['marketplace', 'buy', 'sell', 'selling', 'listing', 'sold', 'used books', 'second hand'],
    answer: 'The campus marketplace is for student-to-student listings such as books, calculators, and other allowed items. Add a clear description, fair price, condition, and photos when available. Meet in a public campus place, verify the item before paying, and never share passwords or verification codes.',
  },
  {
    keywords: ['lost and found', 'lost item', 'found item', 'lost my', 'found a'],
    answer: 'Open Lost & Found to report a missing item or post something you found. Include a general location, date, and a description, but keep one identifying detail private so the real owner can confirm it. Arrange handover in a safe public place or through campus staff.',
  },
  {
    keywords: ['study group', 'study groups', 'group study', 'project partner', 'team up'],
    answer: 'Use Study Groups to find classmates for a subject, exam, or project. Give the group a clear name, course/semester, goal, and meeting plan. Avoid posting personal contact details publicly; use UniLink messages to coordinate first.',
  },
  {
    keywords: ['notification', 'notifications', 'unread', 'notification settings'],
    answer: 'Notifications help you keep up with replies, reactions, club activity, events, and messages. Open the notification item to go to the related content, and review your notification preferences if you want fewer interruptions. If something does not update, refresh the page and check your connection.',
  },
  {
    keywords: ['college only', 'global', 'all colleges', 'cross college', 'audience', 'scope', 'who can see my post'],
    answer: 'Choose College-only when a post is intended for students at your college. Choose Global / All Colleges when you want it visible across campuses. Check the audience label before publishing and never assume a private message or private room is public content.',
  },
  {
    keywords: ['chatbot', 'assistant', 'ai', 'how do you work', 'are answers live'],
    answer: 'I’m UniLink’s built-in helper. I use a set of app guides and student-life answers, plus the college directory and a Wikipedia lookup for college questions. I’m not a live human, and I may not know recent deadlines or every campus-specific rule—please confirm important information with official college sources.',
  },
  {
    keywords: ['internship', 'internships', 'opportunities', 'scholarship deadline', 'hackathon'],
    answer: 'Use Opportunities to discover internships, scholarships, hackathons, and competitions. Check the eligibility, deadline, location, and application link before applying. Be careful with requests for payment or sensitive documents, and verify the opportunity on the organiser’s official website.',
  },
  // ---------- General college-student questions ----------
  {
    keywords: ['study', 'studying', 'study tips', 'how to study', 'concentrate', 'focus', 'revision', 'revise', 'learn faster'],
    answer:
      "Study tips that work: 1) Study in 25-45 minute blocks with 5-10 minute breaks (Pomodoro). 2) Test yourself instead of only re-reading. 3) Revise the same topic again after 1 day, 1 week and 1 month. 4) Keep your phone away while studying. 5) Teach the topic to a friend; if you can explain it, you know it.",
  },
  {
    keywords: ['exam', 'exams', 'test', 'semester', 'prepare for exam', 'last minute', 'finals', 'viva'],
    answer:
      "Exam prep: list all topics, mark the weak ones, and start with those. Solve previous years' papers under a timer. Make short notes or formula sheets for the final revision. Sleep well the night before, since it helps more than studying all night.",
  },
  {
    keywords: ['time management', 'timetable', 'schedule', 'procrastinate', 'procrastination', 'productive', 'planner', 'plan my day'],
    answer:
      "Time management: write down tomorrow's 3 most important tasks tonight, do the hardest one first, and block fixed study hours in your calendar. If you keep delaying a task, just start it for 5 minutes. Starting is the hardest part.",
  },
  {
    keywords: ['attendance', 'bunk', 'shortage', 'detained', 'detention', '75'],
    answer:
      "Many colleges need around 75% attendance to sit for exams, but the exact rule differs by college. Check your college handbook and talk to your class coordinator early if you're short. Medical leave with a certificate is often accepted.",
  },
  {
    keywords: ['placement', 'placements', 'campus placement', 'job', 'jobs', 'career', 'get a job', 'hiring'],
    answer:
      "For placements: 1) Build a clear one-page resume. 2) Practise aptitude and reasoning questions. 3) Learn one programming language or skill well and do a few real projects. 4) Do mock interviews with friends. 5) Keep your LinkedIn updated and ask seniors from your college for referrals.",
  },
  {
    keywords: ['resume', 'cv', 'curriculum vitae', 'resume tips'],
    answer:
      "Resume tips: keep it to one page, use a simple format, and start with your education, projects, skills and internships. Write what you did with numbers where possible (for example \"built a chat app used by 200 students\"). Proofread it twice and save it as a PDF.",
  },
  {
    keywords: ['interview', 'interviews', 'hr round', 'tell me about yourself', 'interview tips'],
    answer:
      "Interview tips: research the company, prepare a 1-minute introduction about yourself, and be ready to explain every project on your resume. For tough questions it's fine to think for a few seconds. Be honest if you don't know something, and say how you would find the answer.",
  },
  {
    keywords: ['internship', 'internships', 'intern', 'summer training', 'training'],
    answer:
      "To find an internship: apply on LinkedIn, Internshala and company career pages, and ask professors and seniors. Start early, send a short personalised message with your resume, and show one or two projects. Even a small internship or open-source contribution counts.",
  },
  {
    keywords: ['project', 'projects', 'final year project', 'mini project', 'project ideas'],
    answer:
      "Pick a project that solves a real problem around you (for example a college notes app, event finder or attendance tracker). Keep the first version small, put the code on GitHub and write a clear README. A finished simple project beats an unfinished big one.",
  },
  {
    keywords: ['coding', 'programming', 'learn to code', 'learn programming', 'dsa', 'data structures', 'algorithms', 'leetcode', 'python', 'java', 'c++'],
    answer:
      "To learn coding: pick one language (Python is easiest to start), practise a little every day, and build small things instead of only watching videos. Once the basics are clear, learn data structures and algorithms, and solve problems on LeetCode or CodeChef. Consistency matters more than long sessions.",
  },
  {
    keywords: ['scholarship', 'scholarships', 'fees', 'fee', 'financial aid', 'education loan', 'loan', 'stipend'],
    answer:
      "For scholarships, check the National Scholarship Portal (scholarships.gov.in), your state's scholarship portal and your college's accounts or scholarship office. Keep your marksheets, income and caste certificates (if applicable) and bank details ready, and watch the deadlines.",
  },
  {
    keywords: ['stress', 'stressed', 'anxiety', 'anxious', 'tension', 'overwhelmed', 'burnout', 'sad', 'depressed', 'lonely', 'homesick', 'mental health'],
    answer:
      "I'm sorry you're feeling this way. It's very common in college. Try breaking things into small steps, take short walks, sleep on time, and talk to a friend, family member or college counsellor. If you feel really low or unsafe, please reach out to someone you trust or a local helpline right away. You don't have to handle it alone.",
  },
  {
    keywords: ['sleep', 'sleeping', 'tired', 'insomnia', 'health', 'exercise', 'gym', 'diet'],
    answer:
      "Basic habits help your studies a lot: sleep 7-8 hours, drink enough water, move or walk for at least 20-30 minutes a day, and don't skip meals. For anything health-related that worries you, please see a doctor.",
  },
  {
    keywords: ['friends', 'make friends', 'friend', 'shy', 'introvert', 'new college', 'first year', 'freshers', 'fresher', 'ragging'],
    answer:
      "Making friends in a new college: join a club or event, sit with different people in class, join your college chat room here on Unilink and say hello. Most people are nervous too, so a simple \"hi, which branch are you from?\" works. If anyone harasses or rags you, report it to your college authorities. Ragging is illegal in India, and you can report messages here with the flag button.",
  },
  {
    keywords: ['club', 'clubs', 'society', 'fest', 'extracurricular', 'hobby', 'activities', 'volunteer', 'ncc', 'nss'],
    answer:
      "Join at least one club or activity (technical, cultural, sports, NSS/NCC, volunteering). It builds skills, friends and a better resume. You can find events on the Events page and talk to your college people in the chat rooms.",
  },
  {
    keywords: ['notes', 'note taking', 'take notes', 'handwritten', 'ppt', 'presentation', 'presentations'],
    answer:
      "Good notes are short: write key points and examples in your own words, use headings and highlight formulas. For presentations, use a few words per slide, one idea per slide, practise out loud once, and keep eye contact with the audience.",
  },
  {
    keywords: ['english', 'communication', 'speaking', 'public speaking', 'confidence', 'spoken english', 'grammar'],
    answer:
      "To improve your English and confidence: read a little every day, watch videos with subtitles, speak out loud even when alone, and join a debate or discussion club. Making mistakes is part of learning, so keep talking.",
  },
  {
    keywords: ['higher studies', 'mba', 'mtech', 'ms abroad', 'gate', 'cat', 'gre', 'ielts', 'toefl', 'upsc', 'competitive exam', 'competitive exams'],
    answer:
      "For higher studies, decide your goal first (job, M.Tech/GATE, MBA/CAT, MS abroad with GRE/IELTS, or government exams like UPSC). Then check the syllabus and dates on the official exam website, start 8-12 months early and join a study group. Ask seniors from your college chat who took the same path.",
  },
  {
    keywords: ['money', 'budget', 'save money', 'saving', 'expenses', 'part time', 'part-time', 'freelance', 'earn'],
    answer:
      "Student budget tip: track your spending for a month, split it into needs and wants, and save a small fixed amount at the start of the month. To earn a bit, try tutoring, freelancing (writing, design, coding) or campus jobs and internships.",
  },
  {
    keywords: ['hostel', 'pg', 'roommate', 'mess', 'food', 'room', 'living'],
    answer:
      "Living away from home: keep a daily routine, clean your space, be respectful with roommates and agree on rules about noise and sleeping time early. Cook or eat healthy where you can, and keep emergency contacts handy.",
  },
  {
    keywords: ['joke', 'funny', 'make me laugh', 'bored'],
    answer:
      "Why did the student eat his homework? Because the teacher said it was a piece of cake! Want a study tip next?",
  },
  {
    keywords: ['who are you', 'your name', 'are you ai', 'are you a bot', 'are you human', 'bot'],
    answer:
      "I'm the Unilink Helper, a small built-in assistant. I answer common questions about the app and about college life. I don't know everything, and I'm not a person or a teacher.",
  },
  {
    keywords: ['how are you', 'whats up', 'how r u', 'how do you do'],
    answer: "I'm doing great, thanks for asking! How can I help you today?",
  },
  {
    keywords: ['thanks', 'thank', 'thx', 'ok thanks', 'great'],
    answer: "You're welcome! Ask me anything else about Unilink.",
  },
  {
    keywords: ['bye', 'goodbye', 'see you'],
    answer: 'Bye! Come back any time.',
  },
];

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9/+\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Edit distance of at most 1 (typo tolerance), for words of 5+ letters.
function nearlyEqual(a: string, b: string) {
  if (a === b) return true;
  if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1); // one wrong letter
  const [long, short] = a.length > b.length ? [a, b] : [b, a];
  return long.slice(i + 1) === short.slice(i); // one missing letter
}

// A trailing "s"/"es" doesn't matter ("exams" = "exam").
function stem(w: string) {
  return w.length > 3 ? w.replace(/(es|s)$/, '') : w;
}

export function getAnswer(question: string): string {
  return getReply(question).text;
}

export type BotPage = 'home' | 'chat' | 'messages' | 'colleges' | 'events' | 'gallery' | 'profile';

export interface Reply {
  text: string;
  /** A page the answer is about; the chat shows an "Open" button for it. */
  page?: { id: BotPage; label: string };
  /** Related questions shown as tap-to-ask chips under the answer. */
  followUps: string[];
}

// Extra info per topic, keyed by the topic's first keyword: a page to open and related questions.
const META: Record<string, { page?: Reply['page']; followUps?: string[] }> = {
  verify: { page: { id: 'profile', label: 'Open Profile' }, followUps: ['How do I join a room?', 'What are college ranks?', 'Can I change my college?'] },
  code: { page: { id: 'chat', label: 'Open Chat' }, followUps: ['How do I create a room?', 'What kinds of rooms are there?'] },
  'create room': { page: { id: 'chat', label: 'Open Chat' }, followUps: ['How do I join a room?', 'What are chat commands?'] },
  chat: { page: { id: 'chat', label: 'Open Chat' }, followUps: ['How do I join a room?', 'How do I report a message?', 'What are chat commands?'] },
  dm: { page: { id: 'messages', label: 'Open Messages' }, followUps: ['How do I block someone?', 'How do I report a message?'] },
  command: { page: { id: 'chat', label: 'Open Chat' }, followUps: ['What are college ranks?'] },
  rank: { followUps: ['How do I get verified?', 'What are chat commands?'] },
  college: { page: { id: 'colleges', label: 'Open Colleges' }, followUps: ['How do I get verified?', 'My college is missing'] },
  event: { page: { id: 'events', label: 'Open Events' }, followUps: ['Tell me about clubs', 'How do I make friends?'] },
  gallery: { page: { id: 'gallery', label: 'Open Gallery' } },
  profile: { page: { id: 'profile', label: 'Open Profile' }, followUps: ['How do I get verified?', 'Who can see my email?'] },
  report: { followUps: ['How do I block someone?', 'Who can see my email?'] },
  placement: { followUps: ['Resume tips', 'Interview tips', 'How do I find an internship?'] },
  resume: { followUps: ['Interview tips', 'How do I find an internship?'] },
  interview: { followUps: ['Resume tips', 'How do I prepare for placements?'] },
  internship: { followUps: ['Resume tips', 'Project ideas'] },
  study: { followUps: ['How do I prepare for exams?', 'Time management tips', 'How to take good notes?'] },
  exam: { followUps: ['Tips to study better', 'Time management tips', 'I feel stressed'] },
  stress: { followUps: ['Tips to sleep better', 'Time management tips'] },
  coding: { followUps: ['Project ideas', 'How do I prepare for placements?'] },
  friends: { page: { id: 'chat', label: 'Open Chat' }, followUps: ['Tell me about clubs', 'Show me events'] },
};

const GENERIC_FOLLOWUPS = ['How do I get verified?', 'Tips to study better', 'How do I prepare for placements?'];

/** Full reply: the answer text plus an optional page button and related-question chips. */
export function getReply(question: string): Reply {
  const { topic, text } = match(question);
  const meta = topic ? META[topic.keywords[0]] : undefined;
  return { text, page: meta?.page, followUps: meta?.followUps ?? GENERIC_FOLLOWUPS };
}

function match(question: string): { topic: Topic | null; text: string } {
  const q = normalize(question);
  if (!q) return { topic: null, text: FALLBACK };
  const words = q.split(' ').map(stem);
  const padded = ' ' + q + ' ';

  let best: Topic | null = null;
  let bestScore = 0;
  for (const t of TOPICS) {
    let score = 0;
    for (const raw of t.keywords) {
      const k = normalize(raw);
      const parts = k.split(' ');
      if (parts.length > 1) {
        if (padded.includes(' ' + k + ' ')) score += parts.length * 2; // phrases count more
      } else {
        const ks = stem(k);
        if (words.some((w) => nearlyEqual(w, ks))) score += 1;
      }
    }
    if (score > bestScore) {
      best = t;
      bestScore = score;
    }
  }
  return best ? { topic: best, text: best.answer } : { topic: null, text: FALLBACK };
}
