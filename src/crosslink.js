import {cell, put, remove, invalid, stats} from './crosslink-cell'

let names = {}
const unique = id => id + (names[id] ? ' ' + ++names[id] : (names[id] = 1, ''))

const lift = fn => (...inputs) => {
  const streamInputs = inputs.filter(s => s.ownUses)
  if(streamInputs.length) {
    let c
    const toBeArgs = inputs.map(s => s.ownUses
      ? s
      : (c = cell('lift const'), put(c, s), c)
    )
    return cell(unique(fn.name || fn.toString()), toBeArgs, fn)
  } else {
    return fn.apply(0, inputs)
  }
}

const retain = liftedFunction => {
  if(liftedFunction.ownUses)
    liftedFunction.persist = true
  return liftedFunction
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

const scan = (fn, acc, S) => cell(
  'scanned ' + (fn.name || fn.toString()) + ' ' + S.alias, [S],
  function(s) {
    return fn(this.value === invalid ? acc : this.value, s)
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

export {cell, lift, put, scan, merge, delay, retain, remove, invalid, stats}