const queue = []
let currentCalc = null
let currentPut = null

const invalid = void 0

const invalidateSubgraph = cc => {
  for(var u = 0; u < cc.ownUses.length; u++) cc.ownUses[u].invalidate()
}

const remove = cc => {
  let c
  while(c = cc.inputs.pop()) {
    const index = c.ownUses.findIndex(u => u.c === c)
    c.ownUses.splice(index, 1)
  }
  for(var u = 0; u < cc.ownUses.length; u++) remove(u)
}

const propagate = cc => {
  currentCalc = cc
  if (cc.inputValues.indexOf(invalid) + 1) return // todo:consider O(0) counter
  var applyResult = cc.calc.apply(cc, cc.inputValues)
  if (applyResult === invalid)
    return
  cc.value = applyResult
  for (var u = 0; u < cc.ownUses.length; u++) cc.ownUses[u].propagate()
}

// todo consider transactions to allow rollback (tempValue and crawl)
// todo consider error & invalid propagation or rollback transaction on error
// ^^ balance these with performance requirements
const protoRollback = text => {
  currentCalc = null
  currentPut = null
  queue.splice(0, queue.length)
  throw new Error(text)
}

const put = (c, d) => {
  if(c === currentCalc) protoRollback('Self-inserting nodes now unsupported.')
  if(!c.isSource) protoRollback('Values can only be put in source nodes.')
  if(c === currentPut)
    console.warn(`Circularity detected: ${c.alias} <-- ${currentCalc.alias}`)
  if(d === invalid) protoRollback(`Value ${d} isn't currently supported.`)
  if(currentPut)
    queue.push([c, d])
  else {
    currentPut = c
    c.inputValues[0] = d
    invalidateSubgraph(c)
    propagate(c)
    currentCalc = null
    currentPut = null
    if(queue.length)
      put.apply(0, queue.shift())
  }
}

let statistics = {
  cellsMade: [],
  cellsMadeCount: 0
}

function sourceEmitter() {return this.inputValues[0]} // node w/ no cell input

const cell = (alias, inputs = [], calc = sourceEmitter, live = false) => {

  const c = {
    alias,
    live,
    isSource: !inputs.length, // doesn't depend on anything; a starter node,
    value: invalid,
    inputValues: inputs.map(cc => cc.value),
    ownUses: [],
    calc,
    inputs: inputs.slice()
  }

  for(let i = 0; i < inputs.length; i++) {
    const cc = inputs[i]
    //const currentLength = cc.ownUses.length
    cc.ownUses.push({
      c,
      invalidate: () => {
        if (c.inputValues[i] !== invalid) {
          c.inputValues[i] = invalid
          invalidateSubgraph(c)
        }
      },
      propagate: () => {
        c.inputValues[i] = cc.value
        propagate(c)
      }
    })
  }

  if((live || (c.live = c.inputValues.indexOf(invalid) === -1)) && calc)
    c.value = calc.apply(c, c.inputValues)

  //statistics.cellsMade.push(l)
  statistics.cellsMadeCount++

  return c
}

const stats = () => ({
    statistics,
    getState: () => ({
      queue,
      currentCalc,
      currentPut
    }),
    currentCalc: () => currentCalc,
    currentPut: () => currentPut
  }
)

let names = {}
const unique = id => id + (names[id] ? ' ' + ++names[id] : (names[id] = 1, ''))

const lift = fn => (...inputs) => {
  const streamInputs = inputs.filter(s => s.ownUses)
  if(streamInputs.length) {
    let c
    const toBeArgs = inputs.map(s => s.ownUses
      ? s
      : (c = cell('genconst'), put(c, s), c)
    )
    return cell(unique(fn.name || fn.toString()), toBeArgs, fn)
  } else {
    return fn.apply(0, inputs)
  }
}

const merge = (S1, S2) => {
  const result = cell(`merger of ${S1.alias} and ${S2.alias}`)
  cell('merge from left ' + S1.alias, [S1], s => put(result, s))
  cell('merge from right ' + S2.alias, [S2], s => put(result, s))
  return result
}

const scanOld = (fn, acc, S) => {
  // this works okay in timeslip but being deprecated
  let accumulator = acc
  const updates = cell('scanned ' + (fn.name || fn.toString()) + ' ' + S.alias, [S], function(s) {
    accumulator = fn(accumulator, s)
    return accumulator
  })

  const starter = cell('scan initial value')
  put(starter, acc)

  return merge(starter, updates)
}

const scan = (fn, acc, S) => {
  // this doesn't work okay in timeslip (maybe unrelated reason)
  const starter = cell('scan starter')
  put(starter, acc)
  return merge(
    starter,
    cell(
      'scanned ' + (fn.name || fn.toString()) + ' ' + S.alias, [S],
      function(s) {
        return fn(this.value === invalid ? acc : this.value, s)
      }
    )
  )
}

// todo test it
const scan0 = (fn, acc, S) => cell(
  'scanned ' + (fn.name || fn.toString()) + ' ' + S.alias, [S],
  function(s) {
    return fn(this.value === invalid ? acc : this.value, s)
  }
)

// todo test it
const multiscan = (fn, acc, ...SS) => cell(
  'multiscanned ' + (fn.name || fn.toString()), SS,
  function(...ss) {
    return fn(this.value === invalid ? acc : this.value, ...ss)
  }
)

const delay = (delay, S) => {
  let emitter = cell('delayed with' + (delay + 'ms of') + S.alias)
  cell('delaying with' + (delay + 'ms of') + S.alias, [S], function(s) {
    setTimeout(() => {
      put(emitter, s)
    }, delay)
  })
  return emitter
}

export {cell, lift, put, scan, merge, delay, remove, invalid, stats}