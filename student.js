import { supabase } from "./supabase.js"

window.getResult = async function () {

    const id = document.getElementById("studentId").value

    const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("id", id)
        .single()

    if (data) {
        document.getElementById("result").innerHTML = `
            <h3>${data.name}</h3>
            <p>Course: ${data.course}</p>
            <p>Mark: ${data.mark}</p>
        `
    } else {
        document.getElementById("result").innerText = "No record found"
    }
}
