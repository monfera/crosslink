const queue = []
let currentCalc = null
let currentPut = null

const invalid = void 0

const remove = cc => {
  let c
  while(c = cc.inputs.pop()) {
    const index = c.ownUses.findIndex(u => u.c === c)
    c.ownUses.splice(index, 1)
    if(!c.ownUses.length && !c.persist) remove(c) // prune upstream if needed
  }
  for(var u = 0; u < cc.ownUses.length; u++) remove(u) // prune downstream
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
    c.invalidate()
    c.propagate()
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

const cell = (alias, inputs = [], calc = sourceEmitter, persist = false) => {

  if(inputs.length > 32) throw new Error('Currently, up to 32 arguments are supported.')

  const argFlags = new Uint32Array([0, 0]) // [justUpdated, missing]

  const inputValues = inputs.map((cc, i) => {
    const val = cc.value
    argFlags[val === invalid ? 1 : 0] |= 1 << i // set
    return val
  })

  const ownUses = []

  const c = {
    alias,
    isSource: !inputs.length, // doesn't depend on anything; a starter node,
    value: invalid,
    argFlags,
    inputValues,
    ownUses,
    calc,
    persist,
    inputs: inputs.slice(),
    invalidate: () => {
      for(var u = 0; u < ownUses.length; u++) ownUses[u].invalidate()
    },
    propagate: () => {
      currentCalc = c
      if (argFlags[1] !== 0) return
      var applyResult = calc.apply(c, inputValues)
      if (applyResult === invalid) return
      c.value = applyResult
      for (var u = 0; u < ownUses.length; u++) ownUses[u].propagate()
    }
  }

  for(let i = 0; i < inputs.length; i++) {
    const cc = inputs[i]
    const mask = 1 << i
    cc.ownUses.push({
      c,
      invalidate: () => {
        if (c.inputValues[i] === invalid) return
        c.inputValues[i] = invalid
        c.argFlags[0] = 0 // clear all
        c.argFlags[1] |= mask // set
        c.invalidate()
      },
      propagate: () => {
        c.inputValues[i] = cc.value
        c.argFlags[0] |= mask // set
        c.argFlags[1] &= ~mask // clear
        c.propagate()
      }
    })
  }

  if(calc && !argFlags[1])
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

export {cell, put, remove, invalid, stats}