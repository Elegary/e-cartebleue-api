const axios = require("axios")
const cheerio = require('cheerio');
const url = require('url');

const BASE_URL = "https://service.e-cartebleue.com/fr/banquepopulaire"
const INDEX_URL = "/index"
const LOGIN_URL = "/login"

function getLoginPostToken(dom){
    const $ = cheerio.load(dom);
    return $("#token").attr("value")
}

function isLoginSuccessful(dom){
    const $ = cheerio.load(dom);
    let result = $("#form-error-confirmation").children("p").text().trim()
    return result
}

function need3DS(dom){
    const $ = cheerio.load(dom);
    return $("#form-3ds-authentificate").length != 0
}

async function login(username, password){
    return new Promise((resolve, reject) => {
        axios.get(BASE_URL + INDEX_URL)
            .then(response => {
                let token = getLoginPostToken(response.data)
                let params = {
                    request: "login",
                    app: "",
                    identifiantCrypte: "",
                    identifiant: username,
                    memorise: false,
                    password,
                    token
                }
                const encoded_params = new url.URLSearchParams(params).toString()
                axios.post(BASE_URL + LOGIN_URL, encoded_params)
                    .then(response => {
                        resolve(isLoginSuccessful(response.data))
                    })
            })
    })
}

exports.login = login