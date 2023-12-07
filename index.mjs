#!/usr/bin/env node

let RATE_LIMIT = 60_000
let TOPSTEPX_LOGIN = 'https://userapi.prod.topstepx.com/Login'
let TOPSTEPX_WEBSOCKET = 'wss://chartapi.prod.topstepx.com/hubs/chart?'

import {env, exit, stdout} from 'node:process'
import {appendFile} from 'node:fs/promises'
import WebSocket from 'ws'

if (!env.u || !env.p) throw new Error('env.{u,p}')
let login_response = await fetch(TOPSTEPX_LOGIN, {
    method: 'post',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({userName: env.u, password: env.p})
})
let login_json = await login_response.json()
if (!login_json.token) throw new Error('login')

let ws = new WebSocket(TOPSTEPX_WEBSOCKET + `&access_token=${login_json.token}`)
ws.on('open', function() {
    ws.send('{"protocol":"json","version":1}\x1e')
    ws.send('{"arguments":[],"target":"SubscribeQuotes","type":1}\x1e')
    ws.send('{"arguments":[],"target":"SubscribeTilt","type":1}\x1e')
})
ws.on('close', function(code, reason) {
    console.error('error:', reason)
    exit(code)
})
ws.on('error', function(error) {
    console.error('error:', error)
    exit(1)
})
ws.on('message', function(buffer) {
    let messages = buffer_to_messages(buffer)
    for (let message of messages) {
        let objects = message_to_objects(message)
        for (let object of objects) {
            switch (message.target) {
                case 'RealTimeQuote': on_quote(object); break
                case 'RealTimeTilt': on_tilt(object); break
                default: // ignore
            }
        }
    }
})

function buffer_to_messages(buffer) {
    let text = buffer.toString()
    let split = text.split('\x1e')
    let messages = []
    for (let value of split) {
        if (!value) continue
        let object = JSON.parse(value)
        messages.push(object)
    }
    return messages
}
function message_to_objects(message) {
    let objects = []
    if (!message.arguments) return objects
    for (let argument of message.arguments) {
        for (let object of argument) {
            if (!Object.keys(object).length) continue
            objects.push(object)
        }
    }
    return objects
}

// quote.symbol: tilt.contractName[0-1]
let symbol_map = {
    'F.US.EP': 'ES',
    'F.US.ENQ': 'NQ',
    'F.US.CLE': 'CL',
    'F.US.GCE': 'GC',
}

let last_quote = {}
function on_quote(quote) {
    if (!symbol_map[quote.symbol]) return
    if (!quote.lastPrice) return
    last_quote[symbol_map[quote.symbol]] = quote.lastPrice
}

function on_tilt(tilt) {
    let quote = last_quote[tilt.contractName.slice(0, 2)]
    if (!quote) return

    let data = create_data(tilt, quote)
    if (!is_valid_data(data)) return
    if (!is_rate_allowed(data)) return
    if (!is_unique_data(data)) return
    write_data(data)
}

function create_data(object, quote) {
    let data = {
        t: new Date().getTime(),
        p: quote,
        n: object.contractName,
        l: Math.round(object.longBias),
        s: Math.round(object.shortBias),
        '+': Math.round(object.percentPositive * 100),
        '-': Math.round(object.percentNegative * 100),
        '+$': Math.round(object.positiveAvgPrice),
        '-$': Math.round(object.negativeAvgPrice),
    }
    return data
}

function is_valid_data(data) {
    if (data.l === 0 || data.l === 100) return
    return true
}

let last_timestamps = {}
function is_rate_allowed(data) {
    if (last_timestamps[data.n] + RATE_LIMIT > data.t) return
    last_timestamps[data.n] = data.t
    return true
}

let last_datas = {}
function is_unique_data(data) {
    let data_pruned = {...data}
    delete data_pruned.t
    delete data_pruned.p
    let json = JSON.stringify(data_pruned)
    if (json == last_datas[data.n]) return
    last_datas[data.n] = json
    return true
}

function write_data(data) {
    let filename = `./data/${data.n}.jsonl`
    let content = JSON.stringify(data)
    appendFile(filename, content + '\n')
    stdout.write('.')
}
