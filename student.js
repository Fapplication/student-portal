import { supabase } from './supabase.js'

const form = document.getElementById('registerForm')

form.addEventListener('submit', async (e) => {
  e.preventDefault()

  const full_name = document.getElementById('full_name').value
  const email = document.getElementById('email').value
  const password = document.getElementById('password').value
  const course = document.getElementById('course').value

  const { error } = await supabase
    .from('students')
    .insert([
      {
        full_name,
        email,
        password,
        course,
        marks: 0
      }
    ])

  if (error) {
    alert(error.message)
  } else {
    alert('Registration Successful')
    window.location.href = 'login.html'
  }
})
