const student = JSON.parse(localStorage.getItem('student'))

if (!student) {
  window.location.href = 'login.html'
}

const studentData = document.getElementById('studentData')

studentData.innerHTML = `
  <div class="student-box">
    <h3>${student.full_name}</h3>
    <p><strong>Email:</strong> ${student.email}</p>
    <p><strong>Course:</strong> ${student.course}</p>
    <p><strong>Marks:</strong> ${student.marks}</p>
  </div>
`

window.logout = function() {
  localStorage.removeItem('student')
  window.location.href = 'login.html'
}
