import { supabase } from "./supabase.js"

window.addStudent = async function () {

    const id = document.getElementById("id").value
    const name = document.getElementById("name").value
    const course = document.getElementById("course").value
    const mark = document.getElementById("mark").value

    const { error } = await supabase
        .from("students")
        .insert([{
            id,
            name,
            course,
            mark
        }])

    if (error) {
        document.getElementById("msg").innerText = error.message
    } else {
        document.getElementById("msg").innerText = "Saved successfully!"
    }
}
