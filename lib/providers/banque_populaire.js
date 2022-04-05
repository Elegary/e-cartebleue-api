const fs = require("fs")
const process = require("process")

const axios = require("axios")
const cheerio = require('cheerio');
const url = require('url');

const BASE_URL = "https://service.e-cartebleue.com/fr/banquepopulaire"
const INDEX_URL = "/index"
const LOGIN_URL = "/login"
const PAY_URL = "/payer"
const CPN_URL = "/cpn"

class EcarteBleueApiClient {
    constructor(){
        this.cpnToken = ""
        this.session = null
        // Retrieve the last saved session
    }

    sessionExist(){
        return fs.existsSync(`${process.cwd()}/session.dat`)
    }
    
    getSavedSession(){
        if(this.sessionExist()){
            this.session = fs.readFileSync(`${process.cwd()}/session.dat`)
            console.log("Session loaded")
            return this.session
        } 
        
        else {
            return null
        }
    }
    
    saveSession(headers){
        if(headers['set-cookie'] != null || headers['set-cookie'] != undefined){
            if(headers['set-cookie'] instanceof Array){
                headers['set-cookie'].forEach(element => {
                    if(element.startsWith("JSESSIONID")){
                        const SESSION_ID = element.split(';')[0] + ';'
                        fs.writeFileSync(`${process.cwd()}/session.dat`, SESSION_ID)
                        this.session = SESSION_ID
                    }
                });
            }
        }
    }
    
    async isLogged(){
        return new Promise((resolve, reject) => {
            axios.get(BASE_URL + PAY_URL, {headers: {Cookie: this.session}})
                .then(response => {
                    if(this.isLoginSuccessful(response.data)){
                        this.cpnToken = this.getCpnToken(response.data)
                        resolve(true)
                    } else {
                        console.log("Login not successfull")
                        reject(false)
                    }
                })
                .catch(error => {
                    console.log(error)
                })
        })
    }
    
    getLoginPostToken(dom){
        const $ = cheerio.load(dom);
        return $("#token").attr("value")
    }

    getCpnToken(dom){
        const $ = cheerio.load(dom);
        return $("#cpn-token").attr("value")
    }

    parseCreditCard(dom){
        const $ = cheerio.load(dom);

        if($("#generated-code-dd").length != 0){
            let card_number_splited = $("#generated-code-dd").children(".restricted-only").children(".generated-code-span")
            let card_number = ""
            for (let block = 0; block < 4; block++) {
                const element = card_number_splited.eq(block)
                card_number = card_number + element.text()             
            }
            let card_expiration = $("#content-expiration-date").children("dd").text().trim()
            let card_cvv = $("#content-cryptogramme").children("dd").children(".restricted-only").text()
            return {card_number, card_expiration, card_cvv}
        } 

        else {
            console.log(dom)
            if($("#form-error-confirmation").length != 0){
                console.log(this.getErrorMessage(dom))
            }
            return null
        }
    }
    
    getErrorMessage(dom){
        const $ = cheerio.load(dom);
        if($("#form-error-confirmation").length != 0){
            return $("#form-error-confirmation").children("p").text().trim()
        } 
        
        else {
            if(need3DS(dom)){
                return "3DS secure is required"
            }
            // Not perfect
            return null
        }
    }
    
    isLoginSuccessful(dom){
        const $ = cheerio.load(dom);
        //#cpn-token
        return $("#form-3ds-authentificate").length == 0 && $("#form-error-confirmation").length == 0
    }
    
    need3DS(dom){
        const $ = cheerio.load(dom);
        return $("#form-3ds-authentificate").length != 0
    }
    
    async loginWithForm(username, password){
        return new Promise((resolve, reject) => {
            axios.get(BASE_URL + INDEX_URL)
                .then(response => {
                    let token = this.getLoginPostToken(response.data)
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
                            let dom = response.data
                            if(this.isLoginSuccessful(dom)){
                                this.saveSession(response.headers)
                                resolve(dom)
                            } 
                            
                            else {
                                reject(this.getErrorMessage(dom))
                            }
                        })
                })
        })
    }
    
    async generateCreditCard(amount, expirationMonths){

        return new Promise((resolve, reject) => {
            let params = {
                request: "ocode",
                token: this.cpnToken,
                montant: amount,
                devise: "1.000000",
                dateValidite: expirationMonths
            }

            const encoded_params = new url.URLSearchParams(params).toString()
            
            axios.post(BASE_URL + CPN_URL, encoded_params, {headers: {Cookie: this.session}})
                .then(response => {

                    let dom = response.data
                    let creditCard = this.parseCreditCard(dom)

                    if(creditCard){
                        resolve(creditCard)
                    } 
                    
                    else {
                        reject("Unable to gen credit card, please try to log in again")
                    }
                })
                .catch(error => {
                    resolve(error)
                })
        })
    }

    async login(){

        let logged = false;

        if(this.sessionExist()){
            logged = await this.isLogged()
                .catch(error => {
                    return error
                })
        }

        return new Promise((resolve, reject) => {
            if(logged){
                resolve(true)
            }
            else {
                console.log("Trying to log in with the form")
                this.loginWithForm(process.env.B_USERNAME, process.env.B_PASSWORD)
                    .then(dom => {
                        this.cpnToken = this.getCpnToken(dom)
                        resolve(dom)
                    })
                    .catch(error => {
                        if(error == "Votre accès au service e-Carte Bleue est temporairement bloqué. Veuillez contacter votre banque."){
                            console.log("You have been blocked by the bank provider. Please contact your bank to get new credentials.")
                        }
                        reject(error)
                    })
            }
        })
    }

}

exports.EcarteBleueApiClient = EcarteBleueApiClient