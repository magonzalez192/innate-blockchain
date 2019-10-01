const bodyParser = require('body-parser')
const express = require('express')
const request = require('request')

const Blockchain = require('./Blockchain')
const { PORT, ROOT_NODE_ADDRESS } = require('./Config')
const PubSub = require('./Server/PubSub')
const TransactionPool = require('./Wallet/TransactionPool')
const Wallet = require('./Wallet')

const app = express()
const blockchain = new Blockchain()
const pubsub = new PubSub({ blockchain })
const transactionPool = new TransactionPool()
const wallet = new Wallet()

app.use(bodyParser.json())

app.get('/v1/blocks', (req, res) => {
    res.json(blockchain.chain)
})

app.post('/v1/mine', (req, res) => {
    const { data } = req.body

    blockchain.add({ data })
    pubsub.broadcastChain()

    res.redirect('/v1/blocks')
})

app.post('/v1/transaction', (req, res) => {
    const { amount, recipient } = req.body
    let transaction

    try {
        transaction = wallet.createTransaction({ amount, recipient })
    } catch(error) {
        return res.status(400).json({ type: 'error', message: error.message })
    }

    transactionPool.add(transaction)

    res.json({ type: 'success', transaction })
})

const syncChains = () => {
    request({ url: `${ROOT_NODE_ADDRESS}/v1/blocks` }, (error, response, body) => {
        if(!error && response.statusCode === 200) {
            const rootChain = JSON.parse(body)
            blockchain.replace(rootChain)
        }
    })
}

let port = PORT

if(process.env.GENERATE_PEER_PORT === 'true') {
    port = PORT + Math.ceil(Math.random() * 1000)
}

app.listen(port, () => {
    console.info(`Escuchando en localhost:${port}`)

    if(port !== PORT) {
        syncChains()
    }
})
