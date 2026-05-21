import { supabase }
from './supabase.js'

window.saveData = async function(){

const id =
document.getElementById('id').value

const name =
document.getElementById('name').value

const course =
document.getElementById('course').value

const mark =
document.getElementById('mark').value

const email =
document.getElementById('email').value

const { error } =
await supabase
.from('students')
.insert([{

id,
name,
course,
mark,
email

}])

if(error){

document.getElementById('message')
.innerHTML = error.message

}else{

document.getElementById('message')
.innerHTML =
'Student Added Successfully'

}

}
