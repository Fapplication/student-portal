const form = document.getElementById("form")

form.addEventListener("submit", async (e)=>{

e.preventDefault()

const data = {
  name: document.getElementById("name").value,
  email: document.getElementById("email").value,
  password: document.getElementById("password").value,
  course: document.getElementById("course").value,
  marks: 0
}

await fetch("https://script.google.com/macros/s/AKfycbybBPkGOmXbMf10aJ8ZV-W_Z-_9kjrk74RgHgpO3i5Yi0YgTlcSCO2Yv4FbOkkwyD9O/exec",{
  method:"POST",
  body:JSON.stringify(data)
})

alert("Registration Successful")

form.reset()

})
