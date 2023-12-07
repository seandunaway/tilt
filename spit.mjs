#!/usr/bin/env node

let INTERVAL = 60_000
let SPIT_URL = 'http://devel.seandunaway.com:8001/spit/tilt/'

import {execSync} from 'node:child_process'

let last_spit = ''
setInterval(function () {
    let es_buffer = execSync(`tail -n1 ./data/ESZ3.jsonl`)
    let es_text = es_buffer.toString()
    if (!es_text) return
    let es = JSON.parse(es_text)

    let nq_buffer = execSync(`tail -n1 ./data/NQZ3.jsonl`)
    let nq_text = nq_buffer.toString()
    if (!nq_text) return
    let nq = JSON.parse(nq_text)

    let spit = ''
    spit += `**${es.n}** ${es.p.toFixed(2)} __${es.l}%__ $${es['+$']}/$${es['-$']} ${es['+']}% `
    spit += `**${nq.n}** ${nq.p.toFixed(2)} __${nq.l}%__ $${nq['+$']}/$${nq['-$']} ${nq['+']}%`

    if (spit == last_spit) return
    last_spit = spit

    fetch(SPIT_URL + encodeURIComponent(spit))
    process.stdout.write('.')
}, INTERVAL)
