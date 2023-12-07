#!/usr/bin/env node

let PORT = 8075

import {open, readdir} from 'node:fs/promises'
import {createServer} from 'node:http'

let server = createServer()
server.listen({host: '0.0.0.0', port: PORT})
server.on('listening', function () {
    console.info(`tilt:${PORT}`)
})
server.on('request', async function (req, res) {
    let response = ''
    let url = req.url ? req.url : '/'
    if (url == '/') response = await index()
    if (url == '/list') response = await list()

    let match = url.match(/\/(?<symbol>[A-Z0-9]{4})\/?(?<after>\d+)?-?(?<before>\d+)?$/)
    if (match?.groups?.symbol) {
        let after = parseInt(match.groups.after) || new Date().getTime() - 60 * 10_000 // 10 minutes ago
        let before = parseInt(match.groups.before) || new Date().getTime()
        response = await data(match.groups.symbol, after, before)
    }

    res.end(response)
})

async function index() {
    let fd = await open('./index.html')
    let buffer = await fd.readFile()
    fd.close()
    return buffer.toString()
}
async function list() {
    let files = await readdir('./data/')
    let symbols = []
    for (let file of files) {
        let match = file.match(/^(?<symbol>[A-Z0-9]{4})\.jsonl$/)
        if (!match?.groups?.symbol) continue
        symbols.push(match.groups.symbol)
    }
    return JSON.stringify(symbols)
}

async function data(symbol, after, before) {
    let data = ''
    let fd
    try {fd = await open(`./data/${symbol}.jsonl`)
    } catch (error) {return data}
    for await (let line of fd.readLines()) {
        if (!line) continue
        let json = JSON.parse(line)
        if (json.t <= after) continue
        if (json.t >= before) break
        data += JSON.stringify(json) + '\n'
    }
    fd.close()
    return data
}
