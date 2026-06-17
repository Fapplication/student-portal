// ═══════════════════════════════════════════════════════════════════
//  CE DEPARTMENT ACADEMIC PORTAL — Google Apps Script Backend
//  Paste this entire file into your Google Apps Script project.
//  Deploy as Web App: Execute as Me, Anyone can access.
// ═══════════════════════════════════════════════════════════════════

// ─── CONFIGURATION ──────────────────────────────────────────────────
const CONFIG = {
  SPREADSHEET_ID:  'YOUR_SPREADSHEET_ID_HERE',   // Replace after creating master sheet
  TELEGRAM_TOKEN:  'YOUR_TELEGRAM_BOT_TOKEN_HERE',
  TELEGRAM_API:    'https://api.telegram.org/bot',
  ANTHROPIC_KEY:   'YOUR_ANTHROPIC_API_KEY_HERE', // For AI assistant
  SESSION_HOURS:   8,
  DEPT_NAME:       'Civil Engineering',
  ACADEMIC_YEAR:   2026,
};

// ─── MASTER SHEET NAMES ─────────────────────────────────────────────
const SHEETS = {
  USERS:         'Users',
  STUDENTS:      'Students',
  INSTRUCTORS:   'Instructors',
  COURSES:       'Courses',
  ASSESSMENTS:   'Assessments',
  ENROLLMENTS:   'Enrollments',
  RESULTS:       'Results',
  NOTIFICATIONS: 'Notifications',
  COMPLAINTS:    'Complaints',
  NOTICES:       'Notices',
  SESSIONS:      'Sessions',
};

// ════════════════════════════════════════════════════════════════════
//  ENTRY POINTS
// ════════════════════════════════════════════════════════════════════

function doGet(e) {
  try {
    const action = e.parameter.action || '';
    const token  = e.parameter.token  || '';

    // Public routes — no auth required
    if (action === 'login') return handleLogin(e);
    if (action === 'ping')  return jsonOk({ status: 'ok', time: new Date().toISOString() });

    // Protected routes
    const session = validateSession(token);
    if (!session && action !== 'login') {
      // Allow demo mode when no token
    }

    switch (action) {
      case 'getStudentResults':   return getStudentResults(e);
      case 'getClassRanking':     return getClassRanking(e);
      case 'getInstructorCourses':return getInstructorCourses(e);
      case 'getNotifications':    return getNotifications(e);
      case 'getComplaints':       return getComplaints(e);
      case 'getNotices':          return getNotices(e);
      case 'aiChat':              return handleAiChat(e);
      default:                    return jsonError('Unknown GET action: ' + action);
    }
  } catch (err) {
    return jsonError('Server error: ' + err.message);
  }
}

function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents || '{}');
    const action = body.action || '';

    // Public
    if (action === 'login')              return handleLoginPost(body);
    if (action === 'registerStudent')    return registerStudent(body);
    if (action === 'registerInstructor') return registerInstructor(body);

    switch (action) {
      // Course management
      case 'createCourse':          return createCourse(body);
      case 'updateCourse':          return updateCourse(body);
      case 'deleteCourse':          return deleteCourse(body);
      case 'archiveCourse':         return archiveCourse(body);

      // Assessment management
      case 'addAssessment':         return addAssessment(body);
      case 'removeAssessment':      return removeAssessment(body);
      case 'updateAssessmentWeight':return updateAssessmentWeight(body);

      // Student management
      case 'enrollStudent':         return enrollStudent(body);
      case 'removeStudent':         return removeStudentFromCourse(body);
      case 'bulkEnrollStudents':    return bulkEnrollStudents(body);

      // Grades
      case 'saveGrades':            return saveGrades(body);
      case 'publishResults':        return publishResults(body);

      // Communication
      case 'sendNotice':            return sendNotice(body);
      case 'submitComplaint':       return submitComplaint(body);
      case 'resolveComplaint':      return resolveComplaint(body);
      case 'respondComplaint':      return respondComplaint(body);

      // Settings
      case 'updateProfile':         return updateProfile(body);
      case 'changePassword':        return changePassword(body);

      default: return jsonError('Unknown POST action: ' + action);
    }
  } catch (err) {
    return jsonError('Server error: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════════════
//  SPREADSHEET HELPERS
// ════════════════════════════════════════════════════════════════════

function getSpreadsheet() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function getOrCreateSheet(name) {
  const ss    = getSpreadsheet();
  let   sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function sheetToObjects(sheetName) {
  const sheet  = getOrCreateSheet(sheetName);
  const data   = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(h => String(h).trim());
  return data.slice(1)
    .filter(row => row.some(cell => cell !== ''))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
}

function appendRow(sheetName, rowObj) {
  const sheet   = getOrCreateSheet(sheetName);
  const data    = sheet.getDataRange().getValues();
  const headers = data.length > 0 ? data[0].map(h => String(h).trim()) : [];

  if (headers.length === 0) {
    // First row — write headers then data
    const keys = Object.keys(rowObj);
    sheet.appendRow(keys);
    sheet.appendRow(keys.map(k => rowObj[k] !== undefined ? rowObj[k] : ''));
    return;
  }
  const row = headers.map(h => rowObj[h] !== undefined ? rowObj[h] : '');
  sheet.appendRow(row);
}

function findRowIndex(sheetName, keyCol, keyVal) {
  const sheet = getOrCreateSheet(sheetName);
  const data  = sheet.getDataRange().getValues();
  if (data.length < 2) return -1;
  const headers = data[0].map(h => String(h).trim());
  const col     = headers.indexOf(keyCol);
  if (col === -1) return -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][col]) === String(keyVal)) return i + 1; // 1-based
  }
  return -1;
}

function updateRowByKey(sheetName, keyCol, keyVal, updates) {
  const sheet   = getOrCreateSheet(sheetName);
  const data    = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const keyIdx  = headers.indexOf(keyCol);
  if (keyIdx === -1) return false;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][keyIdx]) === String(keyVal)) {
      Object.entries(updates).forEach(([col, val]) => {
        const cIdx = headers.indexOf(col);
        if (cIdx !== -1) sheet.getRange(i + 1, cIdx + 1).setValue(val);
      });
      return true;
    }
  }
  return false;
}

function deleteRowByKey(sheetName, keyCol, keyVal) {
  const sheet   = getOrCreateSheet(sheetName);
  const data    = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const col     = headers.indexOf(keyCol);
  if (col === -1) return false;
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][col]) === String(keyVal)) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

// ════════════════════════════════════════════════════════════════════
//  INITIALISATION — run once to create master sheet structure
// ════════════════════════════════════════════════════════════════════

function initializeMasterSheets() {
  const ss = getSpreadsheet();

  const schema = {
    [SHEETS.USERS]: ['UserID','Role','Name','Email','PasswordHash','TelegramID','TelegramUsername','CreatedAt','LastLogin','Status'],
    [SHEETS.STUDENTS]: ['StudentID','FullName','Email','Department','Year','TelegramID','TelegramUsername','PasswordHash','Status','CreatedAt'],
    [SHEETS.INSTRUCTORS]: ['InstructorID','FullName','Email','Department','Specialization','TelegramID','TelegramUsername','PasswordHash','Status','CreatedAt'],
    [SHEETS.COURSES]: ['CourseCode','CourseName','Credits','Semester','AcademicYear','Department','InstructorID','Status','CreatedAt','SheetTabName'],
    [SHEETS.ASSESSMENTS]: ['CourseCode','AssessmentName','Weight','MaxScore','OrderIndex','CreatedAt'],
    [SHEETS.ENROLLMENTS]: ['CourseCode','StudentID','StudentName','EnrolledAt','Status'],
    [SHEETS.RESULTS]: ['CourseCode','StudentID','AssessmentName','Score','MaxScore','Weight','WeightedScore','UpdatedAt','PublishedAt'],
    [SHEETS.NOTIFICATIONS]: ['NotifID','RecipientID','RecipientRole','Title','Body','Type','Read','CourseCode','CreatedAt'],
    [SHEETS.COMPLAINTS]: ['ComplaintID','StudentID','StudentName','CourseCode','AssessmentName','ObtainedScore','ExpectedScore','Reason','Status','InstructorResponse','CreatedAt','ResolvedAt'],
    [SHEETS.NOTICES]: ['NoticeID','InstructorID','Title','Body','Target','SentViaTelegram','SentViaPortal','CreatedAt'],
    [SHEETS.SESSIONS]: ['Token','UserID','Role','CreatedAt','ExpiresAt'],
  };

  Object.entries(schema).forEach(([name, headers]) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length)
        .setBackground('#1E293B')
        .setFontColor('#FFFFFF')
        .setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  });

  // Seed demo data
  seedDemoData();

  return jsonOk({ message: 'Master sheets initialized successfully.' });
}

function seedDemoData() {
  const ss = getSpreadsheet();

  // Demo instructor
  const instrSheet = ss.getSheetByName(SHEETS.INSTRUCTORS);
  if (instrSheet.getLastRow() < 2) {
    instrSheet.appendRow(['INS/001/24','Dr. Tesfaye Alemu','tesfaye@aait.edu.et','Civil Engineering',
      'Highway Engineering','','','pass123',hashPassword('pass123'),'active',new Date().toISOString()]);
  }

  // Demo students
  const studSheet = ss.getSheetByName(SHEETS.STUDENTS);
  if (studSheet.getLastRow() < 2) {
    const students = [
      ['UGR/82533/16','Abomsa Dida Wake','abomsa@student.aait.edu.et','Civil Engineering','4th Year','','',hashPassword('pass123'),'active'],
      ['UGR/82534/16','Birtukan Haile','birtukan@student.aait.edu.et','Civil Engineering','4th Year','','',hashPassword('pass123'),'active'],
      ['UGR/82535/16','Chala Gemechu','chala@student.aait.edu.et','Civil Engineering','4th Year','','',hashPassword('pass123'),'active'],
    ];
    students.forEach(s => studSheet.appendRow([...s, new Date().toISOString()]));
  }
}

// ════════════════════════════════════════════════════════════════════
//  AUTHENTICATION
// ════════════════════════════════════════════════════════════════════

function handleLogin(e) {
  const role = e.parameter.role || '';
  const id   = e.parameter.id   || '';
  const pw   = e.parameter.pw   || '';
  return processLogin(role, id, pw);
}

function handleLoginPost(body) {
  return processLogin(body.role, body.id, body.pw);
}

function processLogin(role, id, pw) {
  if (!id || !pw || !role) return jsonError('Missing credentials.');

  const sheetName = role === 'student' ? SHEETS.STUDENTS : SHEETS.INSTRUCTORS;
  const idCol     = role === 'student' ? 'StudentID'     : 'InstructorID';
  const nameCol   = 'FullName';

  const rows = sheetToObjects(sheetName);
  const user = rows.find(r => String(r[idCol]) === String(id));

  if (!user) return jsonError('User not found.');

  // Check password (plain text for demo; use hash in production)
  const stored = user['PasswordHash'] || user['Password'] || '';
  if (stored !== pw && stored !== hashPassword(pw)) {
    return jsonError('Incorrect password.');
  }

  if (user['Status'] && user['Status'] !== 'active') {
    return jsonError('Account is not active. Contact admin.');
  }

  const token = generateToken();
  const expiry = new Date(Date.now() + CONFIG.SESSION_HOURS * 3600 * 1000).toISOString();

  // Save session
  appendRow(SHEETS.SESSIONS, {
    Token: token, UserID: id, Role: role,
    CreatedAt: new Date().toISOString(), ExpiresAt: expiry
  });

  // Update last login
  updateRowByKey(sheetName, idCol, id, { LastLogin: new Date().toISOString() });

  return jsonOk({
    success: true,
    token,
    role,
    id,
    name: user[nameCol] || id,
    email: user['Email'] || '',
  });
}

function validateSession(token) {
  if (!token) return null;
  const rows = sheetToObjects(SHEETS.SESSIONS);
  const session = rows.find(r => r['Token'] === token);
  if (!session) return null;
  if (new Date(session['ExpiresAt']) < new Date()) return null;
  return session;
}

function generateToken() {
  return Utilities.getUuid().replace(/-/g, '') + Date.now().toString(36);
}

function hashPassword(pw) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pw);
  return bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

// ════════════════════════════════════════════════════════════════════
//  COURSE MANAGEMENT
// ════════════════════════════════════════════════════════════════════

function createCourse(body) {
  const { code, name, credits, semester, year, dept, instructorId } = body;
  if (!code || !name) return jsonError('Course code and name are required.');

  const courses = sheetToObjects(SHEETS.COURSES);
  if (courses.find(c => c['CourseCode'] === code)) {
    return jsonError('Course code already exists.');
  }

  const tabName = generateSheetTabName(code, name);

  appendRow(SHEETS.COURSES, {
    CourseCode:   code,
    CourseName:   name,
    Credits:      credits || 3,
    Semester:     semester || 1,
    AcademicYear: year || CONFIG.ACADEMIC_YEAR,
    Department:   dept || CONFIG.DEPT_NAME,
    InstructorID: instructorId || '',
    Status:       'active',
    CreatedAt:    new Date().toISOString(),
    SheetTabName: tabName,
  });

  // Auto-create course sheet tab
  generateCourseSheet(code, name, tabName);

  // Notify instructor
  sendPortalNotification(instructorId, 'instructor',
    `Course ${code} created`,
    `${name} has been created. Google Sheet tab "${tabName}" is ready.`,
    'system', code);

  return jsonOk({ success: true, tabName, message: `Course ${code} created. Sheet tab "${tabName}" generated.` });
}

function updateCourse(body) {
  const { code, name, credits, semester, year, dept } = body;
  if (!code) return jsonError('Course code required.');
  updateRowByKey(SHEETS.COURSES, 'CourseCode', code, {
    CourseName: name, Credits: credits,
    Semester: semester, AcademicYear: year, Department: dept
  });
  return jsonOk({ success: true, message: 'Course updated.' });
}

function deleteCourse(body) {
  const { code } = body;
  if (!code) return jsonError('Course code required.');

  // Remove course row
  deleteRowByKey(SHEETS.COURSES, 'CourseCode', code);

  // Remove assessments
  const ss = getSpreadsheet();
  const aSheet = ss.getSheetByName(SHEETS.ASSESSMENTS);
  if (aSheet) {
    const data = aSheet.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][0]) === String(code)) aSheet.deleteRow(i + 1);
    }
  }

  // Archive the course tab (rename, don't delete to preserve data)
  const courses = sheetToObjects(SHEETS.COURSES);
  const course  = courses.find(c => c['CourseCode'] === code);
  const tabName = course ? course['SheetTabName'] : code;
  const tab     = ss.getSheetByName(tabName);
  if (tab) tab.setName('DELETED_' + tabName);

  return jsonOk({ success: true, message: `Course ${code} deleted.` });
}

function archiveCourse(body) {
  const { code, status } = body;
  if (!code) return jsonError('Course code required.');
  updateRowByKey(SHEETS.COURSES, 'CourseCode', code, { Status: status || 'archived' });
  return jsonOk({ success: true, message: `Course ${code} status updated to ${status}.` });
}

// ════════════════════════════════════════════════════════════════════
//  GOOGLE SHEET TAB GENERATION
// ════════════════════════════════════════════════════════════════════

function generateSheetTabName(code, name) {
  const clean = name.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_').slice(0, 25);
  return code + '_' + clean;
}

function generateCourseSheet(code, name, tabName) {
  const ss  = getSpreadsheet();
  let   tab = ss.getSheetByName(tabName);
  if (!tab) tab = ss.insertSheet(tabName);

  // Base columns — assessments added later
  const baseHeaders = ['Student ID', 'Student Name'];
  tab.getRange(1, 1, 1, baseHeaders.length).setValues([baseHeaders]);

  // Style header row
  styleHeaderRow(tab, baseHeaders.length);

  return tab;
}

function styleHeaderRow(sheet, numCols) {
  sheet.getRange(1, 1, 1, numCols)
    .setBackground('#1E293B')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);
}

// ════════════════════════════════════════════════════════════════════
//  ASSESSMENT MANAGEMENT
// ════════════════════════════════════════════════════════════════════

function addAssessment(body) {
  const { code, assessments } = body;
  if (!code || !assessments) return jsonError('Course code and assessments required.');

  // Remove old assessments for this course
  const ss     = getSpreadsheet();
  const aSheet = ss.getSheetByName(SHEETS.ASSESSMENTS);
  if (aSheet) {
    const data = aSheet.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][0]) === String(code)) aSheet.deleteRow(i + 1);
    }
  }

  // Insert new assessments
  assessments.forEach((a, i) => {
    appendRow(SHEETS.ASSESSMENTS, {
      CourseCode:     code,
      AssessmentName: a.name,
      Weight:         a.weight,
      MaxScore:       a.max || 100,
      OrderIndex:     i + 1,
      CreatedAt:      new Date().toISOString(),
    });
  });

  // Rebuild course sheet columns
  rebuildCourseSheetColumns(code, assessments);

  return jsonOk({ success: true, message: `${assessments.length} assessments saved for ${code}.` });
}

function removeAssessment(body) {
  const { code, assessmentName } = body;
  if (!code || !assessmentName) return jsonError('Missing params.');
  const ss     = getSpreadsheet();
  const aSheet = ss.getSheetByName(SHEETS.ASSESSMENTS);
  const data   = aSheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === code && String(data[i][1]) === assessmentName) {
      aSheet.deleteRow(i + 1);
    }
  }
  return jsonOk({ success: true });
}

function updateAssessmentWeight(body) {
  const { code, assessmentName, weight } = body;
  const ss     = getSpreadsheet();
  const aSheet = ss.getSheetByName(SHEETS.ASSESSMENTS);
  const data   = aSheet.getDataRange().getValues();
  const headers= data[0];
  const wIdx   = headers.indexOf('Weight');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === code && String(data[i][1]) === assessmentName) {
      aSheet.getRange(i + 1, wIdx + 1).setValue(weight);
      break;
    }
  }
  recalculateCourseGrades(code);
  return jsonOk({ success: true });
}

function rebuildCourseSheetColumns(code, assessments) {
  const courses = sheetToObjects(SHEETS.COURSES);
  const course  = courses.find(c => c['CourseCode'] === code);
  if (!course) return;

  const ss     = getSpreadsheet();
  const tabName= course['SheetTabName'];
  let   tab    = ss.getSheetByName(tabName);
  if (!tab) tab = generateCourseSheet(code, course['CourseName'], tabName);

  const newHeaders = [
    'Student ID', 'Student Name',
    ...assessments.map(a => `${a.name} (/${a.max})`),
    'Total (%)', 'Grade', 'Grade Point', 'Status'
  ];

  // Preserve existing student data (columns 1-2)
  const existingData = tab.getLastRow() > 1
    ? tab.getRange(2, 1, tab.getLastRow() - 1, 2).getValues()
    : [];

  tab.clearContents();
  tab.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
  styleHeaderRow(tab, newHeaders.length);

  // Restore student rows
  if (existingData.length > 0) {
    existingData.forEach((row, i) => {
      tab.getRange(i + 2, 1, 1, 2).setValues([row]);
      // Fill score columns with 0
      const zeroScores = new Array(assessments.length).fill(0);
      tab.getRange(i + 2, 3, 1, assessments.length).setValues([zeroScores]);
    });
    // Add grade formula columns
    addGradeFormulas(tab, existingData.length, assessments);
  }
}

function addGradeFormulas(tab, numStudents, assessments) {
  const totalCol  = 3 + assessments.length;     // Column index for Total
  const gradeCol  = totalCol + 1;
  const gpCol     = totalCol + 2;
  const statusCol = totalCol + 3;

  for (let row = 2; row <= numStudents + 1; row++) {
    // Weighted total formula
    let totalFormula = '=';
    assessments.forEach((a, i) => {
      const colLetter = columnToLetter(3 + i);
      totalFormula += `(${colLetter}${row}/${a.max}*${a.weight})`;
      if (i < assessments.length - 1) totalFormula += '+';
    });
    tab.getRange(row, totalCol).setFormula(totalFormula);

    // Grade formula (Ethiopian system)
    const totalCellRef = columnToLetter(totalCol) + row;
    const gradeFormula = `=IF(${totalCellRef}>=90,"A",IF(${totalCellRef}>=85,"A-",IF(${totalCellRef}>=80,"B+",IF(${totalCellRef}>=75,"B",IF(${totalCellRef}>=70,"B-",IF(${totalCellRef}>=65,"C+",IF(${totalCellRef}>=60,"C",IF(${totalCellRef}>=50,"D","F"))))))))`;
    tab.getRange(row, gradeCol).setFormula(gradeFormula);

    // Grade point formula
    const gradeCellRef = columnToLetter(gradeCol) + row;
    const gpFormula = `=IF(${gradeCellRef}="A",4.0,IF(${gradeCellRef}="A-",3.75,IF(${gradeCellRef}="B+",3.5,IF(${gradeCellRef}="B",3.0,IF(${gradeCellRef}="B-",2.75,IF(${gradeCellRef}="C+",2.5,IF(${gradeCellRef}="C",2.0,IF(${gradeCellRef}="D",1.0,0))))))))`;
    tab.getRange(row, gpCol).setFormula(gpFormula);

    // Status
    const statusFormula = `=IF(${totalCellRef}>=50,"Pass","Fail")`;
    tab.getRange(row, statusCol).setFormula(statusFormula);
  }
}

function columnToLetter(col) {
  let letter = '';
  while (col > 0) {
    const rem = (col - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
}

// ════════════════════════════════════════════════════════════════════
//  STUDENT ENROLLMENT
// ════════════════════════════════════════════════════════════════════

function enrollStudent(body) {
  const { courseCode, studentId, studentName } = body;
  if (!courseCode || !studentId) return jsonError('Missing params.');

  // Check not already enrolled
  const enrollments = sheetToObjects(SHEETS.ENROLLMENTS);
  if (enrollments.find(e => e['CourseCode'] === courseCode && e['StudentID'] === studentId)) {
    return jsonError('Student already enrolled in this course.');
  }

  appendRow(SHEETS.ENROLLMENTS, {
    CourseCode:  courseCode,
    StudentID:   studentId,
    StudentName: studentName || studentId,
    EnrolledAt:  new Date().toISOString(),
    Status:      'active',
  });

  // Add student row to course sheet
  addStudentToSheet(courseCode, studentId, studentName);

  // Notify student
  sendPortalNotification(studentId, 'student',
    `Enrolled in ${courseCode}`,
    `You have been enrolled in ${courseCode}. Your grade sheet is now active.`,
    'grade', courseCode);

  return jsonOk({ success: true, message: `${studentName} enrolled in ${courseCode}.` });
}

function bulkEnrollStudents(body) {
  const { courseCode, students } = body; // students = [{id, name}]
  if (!courseCode || !students) return jsonError('Missing params.');

  let count = 0;
  students.forEach(s => {
    const res = enrollStudent({ courseCode, studentId: s.id, studentName: s.name });
    try { const parsed = JSON.parse(res.getContent()); if (parsed.success) count++; } catch {}
  });

  return jsonOk({ success: true, enrolled: count, message: `${count} students enrolled.` });
}

function removeStudentFromCourse(body) {
  const { courseCode, studentId } = body;
  if (!courseCode || !studentId) return jsonError('Missing params.');

  // Update enrollment status
  updateRowByKey(SHEETS.ENROLLMENTS, 'StudentID', studentId, { Status: 'removed' });

  // Remove from course sheet
  const courses = sheetToObjects(SHEETS.COURSES);
  const course  = courses.find(c => c['CourseCode'] === courseCode);
  if (course) {
    const ss  = getSpreadsheet();
    const tab = ss.getSheetByName(course['SheetTabName']);
    if (tab) {
      const data = tab.getDataRange().getValues();
      for (let i = data.length - 1; i >= 1; i--) {
        if (String(data[i][0]) === String(studentId)) { tab.deleteRow(i + 1); break; }
      }
    }
  }

  return jsonOk({ success: true, message: `Student ${studentId} removed from ${courseCode}.` });
}

function addStudentToSheet(courseCode, studentId, studentName) {
  const courses = sheetToObjects(SHEETS.COURSES);
  const course  = courses.find(c => c['CourseCode'] === courseCode);
  if (!course) return;

  const ss  = getSpreadsheet();
  const tab = ss.getSheetByName(course['SheetTabName']);
  if (!tab) return;

  const lastRow  = tab.getLastRow();
  const lastCol  = tab.getLastColumn();
  const newRow   = [studentId, studentName, ...new Array(Math.max(lastCol - 2, 0)).fill(0)];
  tab.getRange(lastRow + 1, 1, 1, newRow.length).setValues([newRow]);
}

// ════════════════════════════════════════════════════════════════════
//  GRADE ENTRY & CALCULATION
// ════════════════════════════════════════════════════════════════════

function saveGrades(body) {
  const { courseCode, grades } = body; // grades = [{id, scores:[]}]
  if (!courseCode || !grades) return jsonError('Missing params.');

  const courses = sheetToObjects(SHEETS.COURSES);
  const course  = courses.find(c => c['CourseCode'] === courseCode);
  if (!course) return jsonError('Course not found.');

  const ss  = getSpreadsheet();
  const tab = ss.getSheetByName(course['SheetTabName']);
  if (!tab) return jsonError('Course sheet not found.');

  const data    = tab.getDataRange().getValues();
  const headers = data[0];

  grades.forEach(g => {
    // Find student row
    for (let r = 1; r < data.length; r++) {
      if (String(data[r][0]) === String(g.id)) {
        // Update score columns (start at col index 2)
        g.scores.forEach((score, i) => {
          tab.getRange(r + 1, 3 + i).setValue(score);
        });
        break;
      }
    }
  });

  // Also save to Results sheet
  const assessments = sheetToObjects(SHEETS.ASSESSMENTS).filter(a => a['CourseCode'] === courseCode);
  grades.forEach(g => {
    g.scores.forEach((score, i) => {
      const a = assessments[i];
      if (!a) return;
      const weighted = (score / (a['MaxScore'] || 100)) * (a['Weight'] || 0);
      // Upsert result row
      const existing = findRowIndex(SHEETS.RESULTS, 'StudentID', g.id);
      if (existing > 0) {
        updateRowByKey(SHEETS.RESULTS, 'StudentID', g.id, {
          Score: score, WeightedScore: weighted, UpdatedAt: new Date().toISOString()
        });
      } else {
        appendRow(SHEETS.RESULTS, {
          CourseCode: courseCode, StudentID: g.id,
          AssessmentName: a['AssessmentName'],
          Score: score, MaxScore: a['MaxScore'] || 100,
          Weight: a['Weight'] || 0, WeightedScore: weighted,
          UpdatedAt: new Date().toISOString(), PublishedAt: ''
        });
      }
    });
  });

  return jsonOk({ success: true, message: `Grades saved for ${courseCode}.` });
}

function publishResults(body) {
  const { courseCode } = body;
  if (!courseCode) return jsonError('Course code required.');

  const now     = new Date().toISOString();
  const courses = sheetToObjects(SHEETS.COURSES);
  const course  = courses.find(c => c['CourseCode'] === courseCode);
  const name    = course ? course['CourseName'] : courseCode;

  // Get all enrolled students for this course
  const enrollments = sheetToObjects(SHEETS.ENROLLMENTS)
    .filter(e => e['CourseCode'] === courseCode && e['Status'] === 'active');

  enrollments.forEach(e => {
    const studentId = e['StudentID'];
    updateRowByKey(SHEETS.RESULTS, 'StudentID', studentId, { PublishedAt: now });

    // Portal notification
    sendPortalNotification(studentId, 'student',
      `Results published — ${courseCode}`,
      `Your grades for ${name} have been published. Log in to view your result.`,
      'grade', courseCode);

    // Telegram notification
    const student = sheetToObjects(SHEETS.STUDENTS).find(s => s['StudentID'] === studentId);
    if (student && student['TelegramID']) {
      sendTelegramMessage(
        student['TelegramID'],
        `📊 *Results Published*\n\nCourse: *${name}* (${courseCode})\nLog in to the portal to view your grade breakdown.\n\nhttps://your-portal-url.github.io`
      );
    }
  });

  return jsonOk({ success: true, message: `Results published for ${courseCode}. ${enrollments.length} students notified.` });
}

function calculateCourseTotal(courseCode, studentId) {
  const assessments = sheetToObjects(SHEETS.ASSESSMENTS)
    .filter(a => a['CourseCode'] === courseCode)
    .sort((a, b) => a['OrderIndex'] - b['OrderIndex']);

  const results = sheetToObjects(SHEETS.RESULTS)
    .filter(r => r['CourseCode'] === courseCode && r['StudentID'] === studentId);

  let total = 0;
  assessments.forEach(a => {
    const r = results.find(res => res['AssessmentName'] === a['AssessmentName']);
    if (r) total += parseFloat(r['WeightedScore']) || 0;
  });

  return Math.round(total * 100) / 100;
}

function calculateGrade(percentage) {
  if (percentage >= 90) return { letter: 'A',  gp: 4.00 };
  if (percentage >= 85) return { letter: 'A-', gp: 3.75 };
  if (percentage >= 80) return { letter: 'B+', gp: 3.50 };
  if (percentage >= 75) return { letter: 'B',  gp: 3.00 };
  if (percentage >= 70) return { letter: 'B-', gp: 2.75 };
  if (percentage >= 65) return { letter: 'C+', gp: 2.50 };
  if (percentage >= 60) return { letter: 'C',  gp: 2.00 };
  if (percentage >= 50) return { letter: 'D',  gp: 1.00 };
  return { letter: 'F', gp: 0.00 };
}

function recalculateCourseGrades(courseCode) {
  const enrollments = sheetToObjects(SHEETS.ENROLLMENTS)
    .filter(e => e['CourseCode'] === courseCode && e['Status'] === 'active');
  enrollments.forEach(e => calculateCourseTotal(courseCode, e['StudentID']));
}

// ════════════════════════════════════════════════════════════════════
//  STUDENT RESULTS RETRIEVAL
// ════════════════════════════════════════════════════════════════════

function getStudentResults(e) {
  const studentId = e.parameter.studentId || '';
  if (!studentId) return jsonError('Student ID required.');

  const student = sheetToObjects(SHEETS.STUDENTS).find(s => s['StudentID'] === studentId);
  if (!student) return jsonError('Student not found.');

  // Get enrolled courses
  const enrollments = sheetToObjects(SHEETS.ENROLLMENTS)
    .filter(en => en['StudentID'] === studentId && en['Status'] === 'active');

  const courses = sheetToObjects(SHEETS.COURSES);
  const assessmentsMaster = sheetToObjects(SHEETS.ASSESSMENTS);
  const resultsMaster     = sheetToObjects(SHEETS.RESULTS);

  const courseResults = enrollments.map(en => {
    const course      = courses.find(c => c['CourseCode'] === en['CourseCode']) || {};
    const assessments = assessmentsMaster
      .filter(a => a['CourseCode'] === en['CourseCode'])
      .sort((a, b) => (a['OrderIndex'] || 0) - (b['OrderIndex'] || 0));

    const studentResults = resultsMaster
      .filter(r => r['CourseCode'] === en['CourseCode'] && r['StudentID'] === studentId);

    const assessmentBreakdown = assessments.map(a => {
      const res = studentResults.find(r => r['AssessmentName'] === a['AssessmentName']);
      return {
        name:     a['AssessmentName'],
        weight:   parseFloat(a['Weight']) || 0,
        max:      parseFloat(a['MaxScore']) || 100,
        score:    res ? parseFloat(res['Score']) || 0 : 0,
        weighted: res ? parseFloat(res['WeightedScore']) || 0 : 0,
      };
    });

    const total     = assessmentBreakdown.reduce((sum, a) => sum + a.weighted, 0);
    const rounded   = Math.round(total * 10) / 10;
    const gradeInfo = calculateGrade(rounded);
    const published = studentResults.some(r => r['PublishedAt']);

    return {
      code:        en['CourseCode'],
      name:        course['CourseName'] || en['CourseCode'],
      credits:     parseFloat(course['Credits']) || 3,
      instructor:  course['InstructorID'] || '',
      semester:    course['Semester'] || 1,
      assessments: assessmentBreakdown,
      total:       rounded,
      grade:       gradeInfo.letter,
      gp:          gradeInfo.gp,
      published,
    };
  });

  // Calculate CGPA and semester GPA
  const gradedCourses = courseResults.filter(c => c.total > 0);
  let cgpaNum = 0, cgpaDen = 0;
  gradedCourses.forEach(c => { cgpaNum += c.gp * c.credits; cgpaDen += c.credits; });
  const cgpa = cgpaDen > 0 ? Math.round((cgpaNum / cgpaDen) * 100) / 100 : 0;

  const scores = gradedCourses.map(c => c.total);
  const avgScore = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;

  // ── Compute class rank ───────────────────────────────────────────
  const allStudents     = sheetToObjects(SHEETS.STUDENTS).filter(s => s['Status'] === 'active');
  const allEnrollments  = sheetToObjects(SHEETS.ENROLLMENTS);
  const allResults      = sheetToObjects(SHEETS.RESULTS);
  const allAssessments  = sheetToObjects(SHEETS.ASSESSMENTS);

  const classRanking = allStudents.map(s => {
    const sid    = s['StudentID'];
    const sEnr   = allEnrollments.filter(e => e['StudentID'] === sid && e['Status'] === 'active');
    const sGraded = sEnr.map(en => {
      const asm = allAssessments.filter(a => a['CourseCode'] === en['CourseCode']);
      const res = allResults.filter(r => r['CourseCode'] === en['CourseCode'] && r['StudentID'] === sid);
      const tot = asm.reduce((sum, a) => {
        const r = res.find(x => x['AssessmentName'] === a['AssessmentName']);
        return sum + (r ? parseFloat(r['WeightedScore']) || 0 : 0);
      }, 0);
      return Math.round(tot * 10) / 10;
    }).filter(t => t > 0);
    const avg = sGraded.length ? Math.round(sGraded.reduce((a,b)=>a+b,0)/sGraded.length) : 0;
    return { id: sid, name: s['FullName'], avg };
  }).sort((a, b) => b.avg - a.avg);

  const totalStudents = classRanking.length;
  const myRankIndex   = classRanking.findIndex(s => s.id === studentId);
  const classRank     = myRankIndex >= 0 ? myRankIndex + 1 : totalStudents;
  // ────────────────────────────────────────────────────────────────

  return jsonOk({
    success: true,
    student: {
      name:           student['FullName'],
      id:             studentId,
      email:          student['Email'] || '',
      department:     student['Department'] || CONFIG.DEPT_NAME,
      cgpa,
      sgpa:           cgpa,
      credits:        cgpaDen,
      avgScore,
      classRank,
      totalStudents,
      openComplaints: sheetToObjects(SHEETS.COMPLAINTS).filter(c => c['StudentID']===studentId && c['Status']==='pending').length,
      courses:        courseResults,
    }
  });
}

// ════════════════════════════════════════════════════════════════════
//  REGISTRATION
// ════════════════════════════════════════════════════════════════════

function registerStudent(body) {
  const { id, fname, lname, email, dept, year, password } = body;
  if (!id || !fname || !lname || !password) return jsonError('Missing required fields.');

  const existing = sheetToObjects(SHEETS.STUDENTS).find(s => s['StudentID'] === id);
  if (existing) return jsonError('A student with this ID already exists.');

  appendRow(SHEETS.STUDENTS, {
    StudentID:    id,
    FullName:     `${fname} ${lname}`,
    Email:        email || '',
    Department:   dept || CONFIG.DEPT_NAME,
    Year:         year || '',
    TelegramID:   '',
    TelegramUsername: '',
    PasswordHash: hashPassword(password),
    Status:       'active',
    CreatedAt:    new Date().toISOString(),
  });

  return jsonOk({ success: true, message: `Account created for ${fname} ${lname}. You can now log in.` });
}

function registerInstructor(body) {
  const { id, fname, lname, email, spec, password } = body;
  if (!id || !fname || !lname || !email || !password) return jsonError('Missing required fields.');

  const existing = sheetToObjects(SHEETS.INSTRUCTORS).find(i => i['InstructorID'] === id);
  if (existing) return jsonError('An instructor with this ID already exists.');

  appendRow(SHEETS.INSTRUCTORS, {
    InstructorID:     id,
    FullName:         `${fname} ${lname}`,
    Email:            email,
    Department:       CONFIG.DEPT_NAME,
    Specialization:   spec || '',
    TelegramID:       '',
    TelegramUsername: '',
    PasswordHash:     hashPassword(password),
    Status:           'active',
    CreatedAt:        new Date().toISOString(),
  });

  return jsonOk({ success: true, message: `Instructor account created for Dr. ${lname}. You can now log in.` });
}

// ════════════════════════════════════════════════════════════════════
//  CLASS RANKING
// ════════════════════════════════════════════════════════════════════

function getClassRanking(e) {
  const courseCode = e.parameter.courseCode || 'all';

  const allStudents    = sheetToObjects(SHEETS.STUDENTS).filter(s => s['Status'] === 'active');
  const allEnrollments = sheetToObjects(SHEETS.ENROLLMENTS);
  const allResults     = sheetToObjects(SHEETS.RESULTS);
  const allAssessments = sheetToObjects(SHEETS.ASSESSMENTS);

  const ranking = allStudents.map(s => {
    const sid  = s['StudentID'];
    let enrollments = allEnrollments.filter(e => e['StudentID'] === sid && e['Status'] === 'active');
    if (courseCode !== 'all') {
      enrollments = enrollments.filter(e => e['CourseCode'] === courseCode);
    }

    const courseTotals = enrollments.map(en => {
      const asm = allAssessments.filter(a => a['CourseCode'] === en['CourseCode']);
      const res = allResults.filter(r => r['CourseCode'] === en['CourseCode'] && r['StudentID'] === sid);
      const tot = asm.reduce((sum, a) => {
        const r = res.find(x => x['AssessmentName'] === a['AssessmentName']);
        return sum + (r ? parseFloat(r['WeightedScore']) || 0 : 0);
      }, 0);
      return Math.round(tot * 10) / 10;
    }).filter(t => t > 0);

    const avg = courseTotals.length
      ? Math.round(courseTotals.reduce((a, b) => a + b, 0) / courseTotals.length * 10) / 10
      : 0;

    // CGPA
    let cgpaNum = 0, cgpaDen = 0;
    enrollments.forEach(en => {
      const asm = allAssessments.filter(a => a['CourseCode'] === en['CourseCode']);
      const res = allResults.filter(r => r['CourseCode'] === en['CourseCode'] && r['StudentID'] === sid);
      const tot = asm.reduce((sum, a) => {
        const r = res.find(x => x['AssessmentName'] === a['AssessmentName']);
        return sum + (r ? parseFloat(r['WeightedScore']) || 0 : 0);
      }, 0);
      const rounded = Math.round(tot * 10) / 10;
      if (rounded > 0) {
        const gp = calculateGrade(rounded).gp;
        cgpaNum += gp * 3; cgpaDen += 3; // default 3 credits
      }
    });
    const cgpa = cgpaDen > 0 ? Math.round((cgpaNum / cgpaDen) * 100) / 100 : 0;

    return { id: sid, name: s['FullName'], avg, cgpa };
  })
  .filter(s => s.avg > 0)
  .sort((a, b) => b.avg - a.avg);

  return jsonOk({ success: true, ranking, total: ranking.length });
}

// ════════════════════════════════════════════════════════════════════
//  INSTRUCTOR COURSES
// ════════════════════════════════════════════════════════════════════

function getInstructorCourses(e) {
  const instructorId = e.parameter.instructorId || '';
  const courses      = sheetToObjects(SHEETS.COURSES)
    .filter(c => c['InstructorID'] === instructorId || !instructorId);

  const assessmentsMaster = sheetToObjects(SHEETS.ASSESSMENTS);
  const enrollmentsMaster = sheetToObjects(SHEETS.ENROLLMENTS);

  const result = courses.map(c => {
    const assessments = assessmentsMaster
      .filter(a => a['CourseCode'] === c['CourseCode'])
      .map(a => ({ name: a['AssessmentName'], weight: parseFloat(a['Weight']), max: parseFloat(a['MaxScore'])||100 }));

    const students = enrollmentsMaster
      .filter(e => e['CourseCode'] === c['CourseCode'] && e['Status'] === 'active')
      .map(e => ({ id: e['StudentID'], name: e['StudentName'], scores: [] }));

    return {
      code:        c['CourseCode'],
      name:        c['CourseName'],
      credits:     parseFloat(c['Credits']) || 3,
      semester:    c['Semester'],
      year:        c['AcademicYear'],
      dept:        c['Department'],
      instructor:  c['InstructorID'],
      status:      c['Status'] || 'active',
      tabName:     c['SheetTabName'],
      assessments,
      students,
    };
  });

  return jsonOk({ success: true, courses: result });
}

// ════════════════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ════════════════════════════════════════════════════════════════════

function sendPortalNotification(recipientId, role, title, body, type, courseCode) {
  appendRow(SHEETS.NOTIFICATIONS, {
    NotifID:       Utilities.getUuid(),
    RecipientID:   recipientId,
    RecipientRole: role,
    Title:         title,
    Body:          body,
    Type:          type,
    Read:          'false',
    CourseCode:    courseCode || '',
    CreatedAt:     new Date().toISOString(),
  });
}

function getNotifications(e) {
  const userId = e.parameter.userId || '';
  const role   = e.parameter.role   || '';
  const notifs = sheetToObjects(SHEETS.NOTIFICATIONS)
    .filter(n => n['RecipientID'] === userId)
    .sort((a, b) => new Date(b['CreatedAt']) - new Date(a['CreatedAt']))
    .slice(0, 50)
    .map(n => ({
      id:        n['NotifID'],
      title:     n['Title'],
      body:      n['Body'],
      type:      n['Type'],
      read:      n['Read'] === 'true',
      courseCode:n['CourseCode'],
      time:      timeAgo(n['CreatedAt']),
    }));
  return jsonOk({ success: true, notifications: notifs });
}

function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ════════════════════════════════════════════════════════════════════
//  COMPLAINTS
// ════════════════════════════════════════════════════════════════════

function submitComplaint(body) {
  const { studentId, course, assessment, score, expected, reason } = body;
  if (!studentId || !course || !reason) return jsonError('Missing required fields.');

  const student = sheetToObjects(SHEETS.STUDENTS).find(s => s['StudentID'] === studentId);
  const id      = 'C' + Date.now().toString(36).toUpperCase();

  appendRow(SHEETS.COMPLAINTS, {
    ComplaintID:        id,
    StudentID:          studentId,
    StudentName:        student ? student['FullName'] : studentId,
    CourseCode:         course,
    AssessmentName:     assessment || '',
    ObtainedScore:      score || '',
    ExpectedScore:      expected || '',
    Reason:             reason,
    Status:             'pending',
    InstructorResponse: '',
    CreatedAt:          new Date().toISOString(),
    ResolvedAt:         '',
  });

  // Notify instructor
  const courseData = sheetToObjects(SHEETS.COURSES).find(c => c['CourseCode'] === course);
  if (courseData) {
    sendPortalNotification(courseData['InstructorID'], 'instructor',
      `New complaint — ${course}`,
      `${student ? student['FullName'] : studentId} filed a complaint for ${assessment}.`,
      'complaint', course);
  }

  return jsonOk({ success: true, complaintId: id, message: 'Complaint submitted.' });
}

function getComplaints(e) {
  const userId = e.parameter.userId || '';
  const role   = e.parameter.role   || '';
  let complaints = sheetToObjects(SHEETS.COMPLAINTS);
  if (role === 'student')    complaints = complaints.filter(c => c['StudentID'] === userId);
  // Instructor: filter by courses they teach
  return jsonOk({ success: true, complaints });
}

function resolveComplaint(body) {
  const { complaintId } = body;
  updateRowByKey(SHEETS.COMPLAINTS, 'ComplaintID', complaintId, {
    Status: 'resolved', ResolvedAt: new Date().toISOString()
  });
  return jsonOk({ success: true });
}

function respondComplaint(body) {
  const { complaintId, response } = body;
  updateRowByKey(SHEETS.COMPLAINTS, 'ComplaintID', complaintId, {
    Status: 'resolved', InstructorResponse: response, ResolvedAt: new Date().toISOString()
  });
  // Notify student
  const complaints = sheetToObjects(SHEETS.COMPLAINTS);
  const complaint  = complaints.find(c => c['ComplaintID'] === complaintId);
  if (complaint) {
    sendPortalNotification(complaint['StudentID'], 'student',
      `Complaint resolved — ${complaint['CourseCode']}`,
      `Your complaint for ${complaint['AssessmentName']} has been reviewed: "${response}"`,
      'complaint', complaint['CourseCode']);
  }
  return jsonOk({ success: true });
}

// ════════════════════════════════════════════════════════════════════
//  NOTICES
// ════════════════════════════════════════════════════════════════════

function sendNotice(body) {
  const { title, body: msg, target, telegram, instructorId } = body;
  if (!title || !msg) return jsonError('Title and message required.');

  const noticeId = 'N' + Date.now().toString(36).toUpperCase();
  appendRow(SHEETS.NOTICES, {
    NoticeID:       noticeId,
    InstructorID:   instructorId || '',
    Title:          title,
    Body:           msg,
    Target:         target || 'All Students',
    SentViaTelegram:telegram ? 'true' : 'false',
    SentViaPortal:  'true',
    CreatedAt:      new Date().toISOString(),
  });

  // Get target students
  let students = sheetToObjects(SHEETS.STUDENTS);
  if (target && target !== 'All Students') {
    const code = target.split(' — ')[0];
    const enrolled = sheetToObjects(SHEETS.ENROLLMENTS)
      .filter(e => e['CourseCode'] === code && e['Status'] === 'active')
      .map(e => e['StudentID']);
    students = students.filter(s => enrolled.includes(s['StudentID']));
  }

  students.forEach(s => {
    sendPortalNotification(s['StudentID'], 'student', title, msg, 'notice', '');
    if (telegram && s['TelegramID']) {
      sendTelegramMessage(s['TelegramID'], `📢 *${title}*\n\n${msg}`);
    }
  });

  return jsonOk({ success: true, sent: students.length, message: `Notice sent to ${students.length} students.` });
}

function getNotices(e) {
  const notices = sheetToObjects(SHEETS.NOTICES)
    .sort((a, b) => new Date(b['CreatedAt']) - new Date(a['CreatedAt']))
    .slice(0, 20);
  return jsonOk({ success: true, notices });
}

// ════════════════════════════════════════════════════════════════════
//  PROFILE MANAGEMENT
// ════════════════════════════════════════════════════════════════════

function updateProfile(body) {
  const { userId, role, name, email, telegram } = body;
  const sheetName = role === 'student' ? SHEETS.STUDENTS : SHEETS.INSTRUCTORS;
  const idCol     = role === 'student' ? 'StudentID'     : 'InstructorID';
  updateRowByKey(sheetName, idCol, userId, {
    FullName: name, Email: email, TelegramUsername: telegram
  });
  return jsonOk({ success: true, message: 'Profile updated.' });
}

function changePassword(body) {
  const { userId, role, oldPw, newPw } = body;
  const sheetName = role === 'student' ? SHEETS.STUDENTS : SHEETS.INSTRUCTORS;
  const idCol     = role === 'student' ? 'StudentID'     : 'InstructorID';
  const rows      = sheetToObjects(sheetName);
  const user      = rows.find(r => r[idCol] === userId);
  if (!user) return jsonError('User not found.');
  const stored = user['PasswordHash'] || user['Password'] || '';
  if (stored !== oldPw && stored !== hashPassword(oldPw)) return jsonError('Old password incorrect.');
  updateRowByKey(sheetName, idCol, userId, { PasswordHash: hashPassword(newPw) });
  return jsonOk({ success: true, message: 'Password changed.' });
}

// ════════════════════════════════════════════════════════════════════
//  TELEGRAM BOT
// ════════════════════════════════════════════════════════════════════

function sendTelegramMessage(chatId, text) {
  if (!CONFIG.TELEGRAM_TOKEN || CONFIG.TELEGRAM_TOKEN === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') return;
  try {
    UrlFetchApp.fetch(`${CONFIG.TELEGRAM_API}${CONFIG.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
      muteHttpExceptions: true,
    });
  } catch (e) { Logger.log('Telegram error: ' + e.message); }
}

// Webhook handler for Telegram bot commands
function handleTelegramUpdate(update) {
  const msg = update.message;
  if (!msg) return;

  const chatId = msg.chat.id;
  const text   = msg.text || '';
  const userId = String(chatId);

  // Find student by telegram ID
  const student    = sheetToObjects(SHEETS.STUDENTS).find(s => s['TelegramID'] === userId);
  const instructor = sheetToObjects(SHEETS.INSTRUCTORS).find(i => i['TelegramID'] === userId);

  if (text === '/start') {
    sendTelegramMessage(chatId,
      `🏛 *Welcome to CE Department Portal Bot!*\n\nAvailable commands:\n/mymarks — View your grades\n/mycourses — List your courses\n/notices — Recent announcements\n/gpa — View your GPA\n/help — Show this menu`);
    return;
  }

  if (!student && !instructor) {
    sendTelegramMessage(chatId, '⚠ Your Telegram account is not linked to the portal. Please update your Telegram username in Settings.');
    return;
  }

  // Student commands
  if (student) {
    const sid = student['StudentID'];
    if (text === '/mymarks' || text === '/marks') {
      const enrollments = sheetToObjects(SHEETS.ENROLLMENTS).filter(e => e['StudentID'] === sid && e['Status'] === 'active');
      if (!enrollments.length) { sendTelegramMessage(chatId, '📭 You are not enrolled in any courses.'); return; }
      let reply = `📊 *Your Marks*\n\n`;
      enrollments.forEach(e => {
        const total = calculateCourseTotal(e['CourseCode'], sid);
        const grade = calculateGrade(total);
        reply += `*${e['CourseCode']}*: ${total}% — ${grade.letter} (GP: ${grade.gp})\n`;
      });
      sendTelegramMessage(chatId, reply);
    } else if (text === '/mycourses') {
      const enr = sheetToObjects(SHEETS.ENROLLMENTS).filter(e => e['StudentID'] === sid && e['Status'] === 'active');
      const courses = sheetToObjects(SHEETS.COURSES);
      let reply = `📚 *Your Courses*\n\n`;
      enr.forEach(e => {
        const c = courses.find(c => c['CourseCode'] === e['CourseCode']);
        reply += `• *${e['CourseCode']}* — ${c ? c['CourseName'] : ''}\n`;
      });
      sendTelegramMessage(chatId, reply || '📭 No courses found.');
    } else if (text === '/notices') {
      const notices = sheetToObjects(SHEETS.NOTICES).slice(-5);
      let reply = `📢 *Recent Notices*\n\n`;
      notices.forEach(n => { reply += `*${n['Title']}*\n${n['Body']}\n\n`; });
      sendTelegramMessage(chatId, reply || 'No notices.');
    } else if (text === '/gpa') {
      const enr = sheetToObjects(SHEETS.ENROLLMENTS).filter(e => e['StudentID'] === sid && e['Status'] === 'active');
      const courses = sheetToObjects(SHEETS.COURSES);
      let gpNum = 0, gpDen = 0;
      enr.forEach(e => {
        const total  = calculateCourseTotal(e['CourseCode'], sid);
        const grade  = calculateGrade(total);
        const course = courses.find(c => c['CourseCode'] === e['CourseCode']);
        const cr     = parseFloat(course ? course['Credits'] : 3) || 3;
        gpNum += grade.gp * cr; gpDen += cr;
      });
      const cgpa = gpDen > 0 ? (gpNum / gpDen).toFixed(2) : '0.00';
      sendTelegramMessage(chatId, `🎓 *Your GPA*\n\nCGPA: *${cgpa}* / 4.0\nCredit Hours: *${gpDen}*`);
    } else {
      sendTelegramMessage(chatId, 'Unknown command. Type /start to see available commands.');
    }
  }

  // Instructor commands
  if (instructor) {
    const iid = instructor['InstructorID'];
    if (text === '/students') {
      const courses = sheetToObjects(SHEETS.COURSES).filter(c => c['InstructorID'] === iid);
      const total   = sheetToObjects(SHEETS.ENROLLMENTS)
        .filter(e => courses.map(c=>c['CourseCode']).includes(e['CourseCode']) && e['Status']==='active').length;
      sendTelegramMessage(chatId, `👥 *Your Students*\n\nTotal enrolled across ${courses.length} courses: *${total}*`);
    } else if (text === '/complaints') {
      const complaints = sheetToObjects(SHEETS.COMPLAINTS).filter(c => c['Status'] === 'pending');
      sendTelegramMessage(chatId, `📨 *Pending Complaints*: ${complaints.length}`);
    } else {
      sendTelegramMessage(chatId, 'Instructor commands:\n/students\n/complaints\n/sendnotice');
    }
  }
}

// Register webhook
function setTelegramWebhook() {
  const url = ScriptApp.getService().getUrl();
  const res = UrlFetchApp.fetch(
    `${CONFIG.TELEGRAM_API}${CONFIG.TELEGRAM_TOKEN}/setWebhook?url=${url}`,
    { muteHttpExceptions: true }
  );
  Logger.log(res.getContentText());
}

// ════════════════════════════════════════════════════════════════════
//  AI ASSISTANT
// ════════════════════════════════════════════════════════════════════

function handleAiChat(e) {
  const msg     = e.parameter.msg     || '';
  const context = e.parameter.context || '{}';

  if (!CONFIG.ANTHROPIC_KEY || CONFIG.ANTHROPIC_KEY === 'YOUR_ANTHROPIC_API_KEY_HERE') {
    return jsonOk({ reply: buildRuleBasedReply(msg, context) });
  }

  try {
    const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-api-key':         CONFIG.ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      payload: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: `You are the academic assistant for the Civil Engineering Department portal at Addis Ababa Institute of Technology.
You help students understand their grades, GPA, courses and navigate the portal.
Ethiopian grading: A(90-100)=4.0, A-(85-89)=3.75, B+(80-84)=3.5, B(75-79)=3.0, B-(70-74)=2.75, C+(65-69)=2.5, C(60-64)=2.0, D(50-59)=1.0, F(<50)=0.
Keep answers concise and helpful. Student context: ${context}`,
        messages: [{ role: 'user', content: msg }],
      }),
      muteHttpExceptions: true,
    });

    const data = JSON.parse(response.getContentText());
    const reply = data.content && data.content[0] ? data.content[0].text : buildRuleBasedReply(msg, context);
    return jsonOk({ reply });
  } catch (err) {
    return jsonOk({ reply: buildRuleBasedReply(msg, context) });
  }
}

function buildRuleBasedReply(msg, contextStr) {
  const m = msg.toLowerCase();
  let ctx = {};
  try { ctx = JSON.parse(contextStr); } catch {}

  if (m.includes('gpa') || m.includes('grade point')) {
    return `Your current CGPA is ${ctx.cgpa || '—'} / 4.0. Ethiopian grading: A=4.0, A-=3.75, B+=3.5, B=3.0, B-=2.75, C+=2.5, C=2.0, D=1.0, F=0.`;
  }
  if (m.includes('course') || m.includes('enroll')) {
    const courses = (ctx.courses || []).map(c => `${c.code}: ${c.grade}`).join(', ');
    return `You are enrolled in ${(ctx.courses||[]).length} course(s): ${courses || 'none yet'}.`;
  }
  if (m.includes('fail') || m.includes('pass')) {
    return 'The passing threshold is 50% (Grade D). Below 50% is F and the course must be repeated.';
  }
  if (m.includes('complaint')) {
    return 'To raise a grade complaint, go to the Complaints section, select your course and assessment, enter your obtained and expected score, and describe the issue.';
  }
  if (m.includes('telegram')) {
    return 'Connect Telegram by adding your @username in Settings. You will then receive grade notifications and can use bot commands like /mymarks and /gpa.';
  }
  if (m.includes('hello') || m.includes('hi') || m.includes('hey')) {
    return `Hello ${ctx.student || 'there'}! 👋 I can help you with grades, GPA, courses and portal navigation. What do you need?`;
  }
  return 'I can help with grades, GPA calculation, course information, complaints and portal navigation. Please ask a more specific question!';
}

// ════════════════════════════════════════════════════════════════════
//  RESPONSE HELPERS
// ════════════════════════════════════════════════════════════════════

function jsonOk(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonError(message) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: false, error: message }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ════════════════════════════════════════════════════════════════════
//  TRIGGERS — set up time-based automation
// ════════════════════════════════════════════════════════════════════

function createTriggers() {
  // Clean expired sessions daily
  ScriptApp.newTrigger('cleanExpiredSessions')
    .timeBased().everyDays(1).create();
  // Daily digest at 7am
  ScriptApp.newTrigger('sendDailyDigest')
    .timeBased().atHour(7).everyDays(1).create();
  Logger.log('Triggers created.');
}

function cleanExpiredSessions() {
  const sheet = getOrCreateSheet(SHEETS.SESSIONS);
  const data  = sheet.getDataRange().getValues();
  const now   = new Date();
  for (let i = data.length - 1; i >= 1; i--) {
    const expiry = new Date(data[i][4]);
    if (expiry < now) sheet.deleteRow(i + 1);
  }
  Logger.log('Expired sessions cleaned.');
}

function sendDailyDigest() {
  const students = sheetToObjects(SHEETS.STUDENTS).filter(s => s['TelegramID']);
  students.forEach(s => {
    const unread = sheetToObjects(SHEETS.NOTIFICATIONS)
      .filter(n => n['RecipientID'] === s['StudentID'] && n['Read'] === 'false').length;
    if (unread > 0) {
      sendTelegramMessage(s['TelegramID'],
        `🔔 You have ${unread} unread notification(s) on the CE Portal.\nLogin to view: https://your-portal-url.github.io`);
    }
  });
}

// ════════════════════════════════════════════════════════════════════
//  SETUP FUNCTION — run this ONCE from Apps Script editor
// ════════════════════════════════════════════════════════════════════

function SETUP_RUN_ONCE() {
  Logger.log('=== CE Portal Setup ===');
  Logger.log('Step 1: Initializing master sheets…');
  initializeMasterSheets();
  Logger.log('Step 2: Creating triggers…');
  createTriggers();
  Logger.log('Step 3: Setting Telegram webhook…');
  if (CONFIG.TELEGRAM_TOKEN !== 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
    setTelegramWebhook();
  } else {
    Logger.log('Skipped: Telegram token not configured.');
  }
  Logger.log('=== Setup complete! ===');
  Logger.log('Web App URL: ' + ScriptApp.getService().getUrl());
}
