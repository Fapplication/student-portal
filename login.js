import { supabase } from "./supabase.js"

window.login = async function () {

    const email = document.getElementById("email").value
    const password = document.getElementById("password").value

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password
    })

    if (error) {
        document.getElementById("msg").innerText = error.message
    } else {
        window.location.href = "student.html"
    }
}
