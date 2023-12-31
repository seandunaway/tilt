#!/usr/bin/env node

let PORT = 8075
let DEFAULT_AFTER = 60_000 * 10 // 10 minutes ago

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

    let match_index = url.match(/^\/(?<search>\?.+)?$/)
    if (match_index) response = await index()

    // https://regex101.com/r/pz1MB1
    let match_data = url.match(/\/(?:data\/)?(?<symbol>[A-Z0-9]{4})(?:\.jsonl)?\/?\??(?<after>\d+)?-?(?<before>\d+)?/)
    if (match_data?.groups?.symbol) {
        let after = parseInt(match_data.groups.after) ?? new Date().getTime() - DEFAULT_AFTER
        let before = parseInt(match_data.groups.before) ?? new Date().getTime()
        response = await data(match_data.groups.symbol, after, before)
    }

    if (url == '/list') response = await list()

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
