const { EcarteBleueApiClient } = require("./providers/banque_populaire")

async function main(){
    let client = new EcarteBleueApiClient();
    client.getSavedSession();
    const logged = await client.login()
        .catch(error => {
            console.log(error)
            process.exit()
        })
    console.log("Logged !")
    await client.generateCreditCard(16, 3).then(r => { console.log(r)}).catch(e => { console.log(e)})
}

main()