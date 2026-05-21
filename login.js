import { supabase } from './supabase.js'

const loginForm = document.getElementById('loginForm')

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault()

  const email = document.getElementById('loginEmail').value
  const password = document.getElementById('loginPassword').value

  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('email', email)
    .eq('password', password)
    .single()

  if (error || !data) {
    alert('Invalid login credentials')
  } else {
    localStorage.setItem('student', JSON.stringify(data))
    window.location.href = 'dashboard.html'
  }
})
