const login = require("./providers/banque_populaire").login

login(process.env.B_USERNAME, process.env.B_PASSWORD)
    .then(response => {
        console.log(response)
        if(response == "Votre accès au service e-Carte Bleue est temporairement bloqué. Veuillez contacter votre banque."){
            console.log("T'es bloqué connard")
        }
    })