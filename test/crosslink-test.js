const tape = require('tape')

const _ = require('../build/crosslink.min.js')

const finalizeTest = t => {
  const state = _.stats().getState()
  t.same(state.queue, [], 'queue must be empty when done')
  t.equal(state.currentCalc, null, 'currentCalc must be set back to null')
  t.equal(state.currentPut, null, 'currentPut must be set back to null')
  t.end()
}

tape.test('test self-inserting node', t => {

  let errorRaised = false

  const source = _.cell('source') // the name string is solely debug aid
  const sink = _.cell('sink', [source], function(d) {
    _.put(this, 'some value')
  })

  try {
    _.put(source, 'whatever')
  } catch(error) {
    errorRaised = error.toString()
  } finally {
    t.ok(errorRaised, 'some error was at least encountered')
    t.equal(
      errorRaised,
      'Error: Self-inserting nodes now unsupported.',
      'specific error on self-inserting node was raised')
  }
  finalizeTest(t)
})

tape.test('test with only two cells', t => {

  let testVar = 1
  let callCount = 0
  let undefinedErrorRaised = false

  t.equal(testVar, 1) // obv...

  // source --> sink
  const source = _.cell('source') // the name string is solely debug aid
  const sink = _.cell('sink', [source], d => {
    testVar = d * 3
    callCount++
    // no ret val - cells may exist for just side effects, as here for testing
  })

  t.equal(testVar, 1, 'DAG is set up, but no input happened yet')
  t.equal(callCount, 0, 'no calls so far')
  t.equal(sink.argFlags[0], 0, 'no args flagged as updated')

  _.put(source, 2)
  t.equal(testVar, 6, 'sink was invoked')
  t.equal(callCount, 1, 'single call')
  t.equal(sink.argFlags[0], 1, 'argument 0 (mask: 2^0) flagged')

  _.put(source, 5)
  t.equal(testVar, 15, 'sink was invoked again')
  t.equal(callCount, 2, 'two calls')

  try {
    _.put(source, _.invalid)
  } catch(error) {
    undefinedErrorRaised = error.toString()
  } finally {
    t.ok(undefinedErrorRaised, 'some error was at least encountered')
    t.equal(
      undefinedErrorRaised,
      "Error: Value undefined isn't currently supported.",
      'specific error on invalid data was raised')
    t.equal(testVar, 15, 'sink was not invoked again')
    t.equal(callCount, 2, 'still just two calls')
  }

  finalizeTest(t)
})

tape.test('test node removal - leaf node', t => {

  let testVar = 1
  let callCount = 0

  t.equal(testVar, 1) // obv...

  // source --> sink
  const source = _.cell('source') // the name string is solely debug aid
  const sink = _.cell('sink', [source], d => {
    testVar = d * 3
    callCount++
    // no ret val - cells may exist for just side effects, as here for testing
  })

  t.equal(testVar, 1, 'DAG is set up, but no input happened yet')
  t.equal(callCount, 0, 'no calls so far')

  _.put(source, 2)
  t.equal(testVar, 6, 'sink was invoked')
  t.equal(callCount, 1, 'single call')

  _.put(source, 5)
  t.equal(testVar, 15, 'sink was invoked again')
  t.equal(callCount, 2, 'two calls')

  _.remove(sink)

  _.put(source, 7)
  t.equal(testVar, 15, 'no change to result despite sink was invoked again')
  t.equal(callCount, 2, 'no increase to call count as sink no longer present')

  finalizeTest(t)
})

tape.test('test node removal with pruning', t => {

  let testVar = 1
  let callCount = 0
  let mediatorCallCount = 0

  t.equal(testVar, 1) // obv...

  // source --> sink
  const source = _.cell('source') // the name string is solely debug aid
  const mediator = _.cell('mediator', [source], d => {
    mediatorCallCount++
    return d
  })
  const sink = _.cell('sink', [mediator], d => {
    testVar = d * 3
    callCount++
    // no ret val - cells may exist for just side effects, as here for testing
  })

  t.equal(testVar, 1, 'DAG is set up, but no input happened yet')
  t.equal(callCount, 0, 'no calls so far')

  _.put(source, 2)
  t.equal(testVar, 6, 'sink was invoked')
  t.equal(callCount, 1, 'single call')
  t.equal(mediatorCallCount, 1, 'single call')

  _.put(source, 5)
  t.equal(testVar, 15, 'sink was invoked again')
  t.equal(callCount, 2, 'two calls')
  t.equal(mediatorCallCount, 2, 'two calls')

  _.remove(sink)

  _.put(source, 7)
  t.equal(testVar, 15, 'no change to result despite sink was invoked again')
  t.equal(callCount, 2, 'no increase to call count as sink no longer present')
  t.equal(mediatorCallCount, 2, 'no increase to mediator call count')

  finalizeTest(t)
})

tape.test('test node removal with default pruning of _.lift', t => {

  let testVar = 1
  let callCount = 0
  let mediatorCallCount = 0

  t.equal(testVar, 1) // obv...

  // source --> sink
  const source = _.cell('source') // the name string is solely debug aid
  const mediator = _(d => {
    mediatorCallCount++
    return d
  })(source)
  const sink = _.cell('sink', [mediator], d => {
    testVar = d * 3
    callCount++
    // no ret val - cells may exist for just side effects, as here for testing
  })

  t.equal(testVar, 1, 'DAG is set up, but no input happened yet')
  t.equal(callCount, 0, 'no calls so far')

  _.put(source, 2)
  t.equal(testVar, 6, 'sink was invoked')
  t.equal(callCount, 1, 'single call')
  t.equal(mediatorCallCount, 1, 'single call')

  _.put(source, 5)
  t.equal(testVar, 15, 'sink was invoked again')
  t.equal(callCount, 2, 'two calls')
  t.equal(mediatorCallCount, 2, 'two calls')

  _.remove(sink)

  _.put(source, 7)
  t.equal(testVar, 15, 'no change to result despite sink was invoked again')
  t.equal(callCount, 2, 'no increase to call count as sink no longer present')
  t.equal(mediatorCallCount, 2, 'no increase to mediator call count')

  finalizeTest(t)
})

tape.test('test node removal - avoid pruning a `persist` node', t => {

  let testVar = 1
  let callCount = 0
  let mediatorCallCount = 0

  t.equal(testVar, 1) // obv...

  // source --> sink
  const source = _.cell('source') // the name string is solely debug aid
  const mediator = _.cell('mediator', [source], d => {
    mediatorCallCount++
    return d
  }, true) // <--- this `true` flag causes that pruning doesn't reach this cell
  const sink = _.cell('sink', [mediator], d => {
    testVar = d * 3
    callCount++
    // no ret val - cells may exist for just side effects, as here for testing
  })

  t.equal(testVar, 1, 'DAG is set up, but no input happened yet')
  t.equal(callCount, 0, 'no calls so far')

  _.put(source, 2)
  t.equal(testVar, 6, 'sink was invoked')
  t.equal(callCount, 1, 'single call')
  t.equal(mediatorCallCount, 1, 'single call')

  _.put(source, 5)
  t.equal(testVar, 15, 'sink was invoked again')
  t.equal(callCount, 2, 'two calls')
  t.equal(mediatorCallCount, 2, 'two calls')

  _.remove(sink)

  _.put(source, 7)
  t.equal(testVar, 15, 'no change to result despite sink was invoked again')
  t.equal(callCount, 2, 'no increase to call count as sink no longer present')
  t.equal(mediatorCallCount, 3, 'mediator left in place due to `persist`')

  finalizeTest(t)
})

tape.test('test node removal - avoid pruning after a `persist` call', t => {

  let testVar = 1
  let callCount = 0
  let mediatorCallCount = 0

  t.equal(testVar, 1) // obv...

  // source --> sink
  const source = _.cell('source') // the name string is solely debug aid
  const mediator = _.retain(_(d => {
      mediatorCallCount++
      return d
    })(source)
  )
  const sink = _.cell('sink', [mediator], d => {
    testVar = d * 3
    callCount++
    // no ret val - cells may exist for just side effects, as here for testing
  })

  t.equal(testVar, 1, 'DAG is set up, but no input happened yet')
  t.equal(callCount, 0, 'no calls so far')

  _.put(source, 2)
  t.equal(testVar, 6, 'sink was invoked')
  t.equal(callCount, 1, 'single call')
  t.equal(mediatorCallCount, 1, 'single call')

  _.put(source, 5)
  t.equal(testVar, 15, 'sink was invoked again')
  t.equal(callCount, 2, 'two calls')
  t.equal(mediatorCallCount, 2, 'two calls')

  _.remove(sink)

  _.put(source, 7)
  t.equal(testVar, 15, 'no change to result despite sink was invoked again')
  t.equal(callCount, 2, 'no increase to call count as sink no longer present')
  t.equal(mediatorCallCount, 3, 'mediator left in place due to `persist`')

  finalizeTest(t)
})

tape.test('circularity', t => {

  let errorRaised = false
  var A = _.cell('A')

  try {
    var B = _.cell('B', [A, D], (a, d) => a + d)
  } catch(error) {
    errorRaised = true // todo make and check for specific error? tho, deopt...
  } finally {
    t.ok(errorRaised, 'no circularity is possible directly')
  }

  // ofc the rest would then fail as B is undefined here
  // var C = cell('C', [B], b => b)
  // var D = cell('D', [C], c => c)

  finalizeTest(t)
})

tape.test('only source nodes can be put into', t => {

  let errorRaised = false

  const source1 = _.cell()
  const source2 = _.cell('just another source; default input is []')
  const source3 = _.cell('source with explicit empty input', [])
  const nonSource = _.cell('a non-source', [source1], s1 => s1)

  _.put(source1, 0) // no error
  _.put(source2, 0) // no error
  _.put(source3, 0) // no error

  try {
    _.put(nonSource, 0)
  } catch(error) {
    errorRaised = error.toString()
  } finally {
    t.ok(errorRaised, 'got some error on non-source putting attempt')
    t.equal(errorRaised, 'Error: Values can only be put in source nodes.',
      'got a specific error on non-source putting attempt')
  }

  finalizeTest(t)
})

tape.test('test presence of previous value', t => {

  const values = []
  const prevValues = []

  const source = _.cell('source')
  const sink = _.cell('sink', [source], function(d) {
    const value = 2 * d + 1
    values.push(value)
    prevValues.push(this.value)
    return value
  })

  t.same(values, [], 'DAG is set up, but no input happened yet')
  t.same(prevValues, [], 'DAG is set up, cannot have captured prev values')

  _.put(source, 3)
  t.same(values, [7], '1st')
  t.same(prevValues, [_.invalid], '1st - no valid prevVal')

  _.put(source, 5)
  t.same(values, [7, 11], '2nd')
  t.same(prevValues, [_.invalid, 7], '2nd - valid prevVal')

  _.put(source, -81)
  t.same(values, [7, 11, -161], '3rd')
  t.same(prevValues, [_.invalid, 7, 11], '3rd - valid prevVal')

  finalizeTest(t)
})

tape.test('test with two sources, one target', t => {

  let testVar = 1
  let callCount = 0

  t.equal(testVar, 1) // obv...

  // source --> sink
  const S1 = _.cell('source 1')
  const S2 = _.cell('source 1')
  const sink = _.cell('sink', [S1, S2], (s1, s2) => {
    testVar = s1 * s2
    callCount++
  })

  t.equal(testVar, 1, 'DAG is set up, but no input happened yet')
  t.equal(callCount, 0, 'no calls so far')
  t.equal(sink.argFlags[0], 0, 'argument 0, 1 NOT flagged')

  _.put(S1, 2)
  t.equal(testVar, 1, 'sink 1 got data')
  t.equal(callCount, 0, 'no call yet')
  t.equal(sink.argFlags[0], 1, 'argument 0 (mask 2^0) flagged')

  _.put(S2, 21)
  t.equal(testVar, 42, 'sink 2 got data now')
  t.equal(callCount, 1, 'single call happened')
  t.equal(sink.argFlags[0], 3, 'argument 0, 1 (mask 2^1 + 2^0) flagged')
  // ^^ both args are flagged b/c even though S1 happened earlier, it didn't
  // then involve function execution due to S2 being `invalid` then

  _.put(S1, 5)
  t.equal(testVar, 105, 'sink 1 was invoked again')
  t.equal(callCount, 2, 'third call - updated as `s2` dependency already met')
  t.equal(sink.argFlags[0], 1, 'argument 0 (mask 2 ^ 0) flagged')
  // ^^ now only S1 changed; S2 already had a legit value

  _.put(S2, 5)
  t.equal(testVar, 25, 'sink 2 was invoked again')
  t.equal(callCount, 3, 'fourth call')
  t.equal(sink.argFlags[0], 2, 'argument 1 (mask 2 ^ 1) flagged')
  // ^^ now only S2 changed; S1 already had a legit value

  finalizeTest(t)
})

tape.test('reverse ordering', t => {

  let testVar = 1
  let callCount = 0

  t.equal(testVar, 1) // obv...

  // source --> sink
  const source = _.cell('source') // the name string is solely debug aid
  _.put(source, 2)
  t.equal(testVar, 1, 'DAG is not fully set up, input happened already')
  t.equal(callCount, 0, 'no calls to sink so far, it does not exist yet')

  const sink = _.cell('sink', [source], d => {
    testVar = d * 3
    callCount++
  })

  t.equal(testVar, 6, 'sink was invoked as it had sufficient input when added')
  t.equal(callCount, 1, 'a single call happened')

  finalizeTest(t)
})

tape.test('graph propagation; atomicity (single calc per node)', t => {

  let testVar = 1
  let calls = 0
  let dCalcs = 0
  let eCalcs = 0

  t.equal(testVar, 1) // obv...

  // A --> E
  const A = _.cell('A') // 3, 5
  const B = _.cell('B', [A], a => a + 1) // 4, 6
  const C = _.cell('C', [A], a => a * 2) // 6, 10
  const D = _.cell('D', [B, C], (b, c) => {dCalcs++; return b / c}) // 2/3, 3/5
  const E = _.cell('E', [D, A, C], (d, a, c) => {
    eCalcs++
    return 3 * d + 2 * a + c // 14, 9/5 + 10 + 10
  })
  const F = _.cell('F', [E], f => {
    testVar = f
    calls++
  })

  t.equal(testVar, 1, 'DAG is set up, but no input happened yet')
  t.equal(calls, 0, 'no calls so far')
  t.equal(B.argFlags[0], 0)
  t.equal(C.argFlags[0], 0)
  t.equal(D.argFlags[0], 0)
  t.equal(E.argFlags[0], 0)

  _.put(A, 3)
  t.equal(testVar, 14, 'E was invoked')
  t.equal(calls, 1, 'single call')
  t.equal(dCalcs, 1, 'single call, though depends multiply on A')
  t.equal(eCalcs, 1, 'single call, though directly and indirectly under A')
  t.equal(B.argFlags[0], 0b1)
  t.equal(C.argFlags[0], 0b1)
  t.equal(D.argFlags[0], 0b11)
  t.equal(E.argFlags[0], 0b111)

  _.put(A, 5)
  t.equal(testVar, 9/5 + 10 + 10, 'E was invoked - 2')
  t.equal(calls, 2, 'single call - 2')
  t.equal(dCalcs, 2, 'single call, though depends multiply on A - 2')
  t.equal(eCalcs, 2, 'single call, though under A both ways - 2')
  t.equal(B.argFlags[0], 0b1)
  t.equal(C.argFlags[0], 0b1)
  t.equal(D.argFlags[0], 0b11)
  t.equal(E.argFlags[0], 0b111) // all three inputs get renewed when A changes

  finalizeTest(t)
})

tape.test('graph propagation with common subgraphs preserves prevValue', t => {

  const values = {B: [], C: [], D: [], E: [], F: []}
  const prevVl = {B: [], C: [], D: [], E: [], F: []}

  // A --> E
  const A = _.cell('A') // 3, 5
  const B = _.cell('B', [A], function(a) {
    const res = a + 1
    values.B.push(res)
    prevVl.B.push(this.value)
    return res
  }) // 4, 6
  const C = _.cell('C', [A], function(a) {
    const res = a * 2
    values.C.push(res)
    prevVl.C.push(this.value)
    return res
  }) // 6, 10
  const D = _.cell('D', [B, C], function(b, c) {
    const res = b / c
    values.D.push(res)
    prevVl.D.push(this.value)
    return res
  }) // 2/3, 3/5
  const E = _.cell('E', [D, A, C], function(d, a, c) {
    const res = 3 * d + 2 * a + c // 14, 9/5 + 10 + 10
    values.E.push(res)
    prevVl.E.push(this.value)
    return res
  })
  const F = _.cell('F', [E], function(f) {
    const res = f + 1
    values.F.push(res)
    prevVl.F.push(this.value)
    return res
  })

  t.same(values, { B: [], C: [], D: [], E: [], F: [] })
  t.same(prevVl, { B: [], C: [], D: [], E: [], F: [] })

  _.put(A, 3)
  t.same(values, { B: [ 4 ], C: [ 6 ], D: [ 2/3 ], E: [ 14 ], F: [ 15 ] })
  t.same(prevVl, { B: [ _.invalid ], C: [ _.invalid ], D: [ _.invalid ], E: [ _.invalid ], F: [ _.invalid ] })

  _.put(A, 5)
  t.same(values, { B: [ 4, 6 ], C: [ 6, 10 ], D: [ 2/3, 0.6 ], E: [ 14, 21.8 ], F: [ 15, 22.8 ] })
  t.same(prevVl, { B: [ _.invalid, 4 ], C: [ _.invalid, 6 ], D: [ _.invalid, 2/3 ], E: [ _.invalid, 14 ], F: [ _.invalid, 15 ] })

  finalizeTest(t)
})

tape.test('propagation is topologically ordered, no duplicates', t => {

  const l = []

  // A --> E
  const A = _.cell('A') // 3, 5
  const B = _.cell('B', [A], a => {l.push('B'); return a + 1}) // 4, 6
  const C = _.cell('C', [A], a => {l.push('C'); return a * 2}) // 6, 10
  const D = _.cell('D', [B, C], (b, c) => {l.push('D'); return b / c}) // 2/3, 3/5
  const E = _.cell('E', [D, A, C], (d, a, c) => {
    l.push('E')
    return 3 * d + 2 * a + c // 14, 9/5 + 10 + 10
  })
  const F = _.cell('F', [E], f => {l.push('F')})

  t.same(l, [], 'no calls yet')

  _.put(A, 3)
  t.same(l, ['B', 'C', 'D', 'E', 'F'], 'topo ordered')

  _.put(A, 5)
  t.same(l, ['B', 'C', 'D', 'E', 'F', 'B', 'C', 'D', 'E', 'F'], '2nd is same')

  finalizeTest(t)
})

tape.test('full propagation done before processing arising input', t => {

  const l = []
  let loopCount = 2
  const warnings = []

  console.warnSaved = console.warn
  console.warn = w => warnings.push(w)

  // A --> E
  const A = _.cell('A') // 3, 5
  const B = _.cell('B', [A], a => {l.push('B'); return a + 1}) // 4, 6
  const C = _.cell('C', [A], a => {
    if(loopCount--) // don't iterate forever...
      _.put(A, 5) // <<<<<<======= here we insert something in a (source) node
    l.push('C')
    return a * 2
  }) // 6, 10
  const D = _.cell('D', [B, C], (b, c) => {l.push('D'); return b / c}) // 2/3, 3/5
  const E = _.cell('E', [D, A, C], (d, a, c) => {
    l.push('E')
    return 3 * d + 2 * a + c // 14, 9/5 + 10 + 10
  })
  const F = _.cell('F', [E], f => {l.push('F')})

  _.put(A, 3)

  console.warn = console.warnSaved
  delete console.warnSaved

  t.same(l, [
    'B', 'C', 'D', 'E', 'F',
    'B', 'C', 'D', 'E', 'F',
    'B', 'C', 'D', 'E', 'F'
  ], 'normal prop')

  t.same(warnings, [
    'Circularity detected: A <-- C',
    'Circularity detected: A <-- C'
  ], 'warnings arise from the induced circularity which we test on the side')

  finalizeTest(t)
})

tape.test('merge test', t => {

  const result = []

  const source1 = _.cell('source 1')
  const source2 = _.cell('source 2')

  const merged = _.merge(source1, source2)

  _.cell('sink', [merged], m => result.push(m))

  t.same(result, [], 'nothing happened yet')
  _.put(source1, 3)
  t.same(result, [3], '1st arrived')
  _.put(source1, 4)
  t.same(result, [3, 4], '2nd arrived')
  _.put(source2, 4)
  t.same(result, [3, 4, 4], '3rd arrived')
  _.put(source2, 5)
  t.same(result, [3, 4, 4, 5], '4th arrived')
  _.put(source1, 3)
  t.same(result, [3, 4, 4, 5, 3], '5th arrived')
  try {
    _.put(source1, _.invalid)
  } catch(error) {
    t.equal(
      error.toString(),
      "Error: Value undefined isn't currently supported.",
      'specific error on invalid data was raised'
    )
  } finally {
    t.same(result, [3, 4, 4, 5, 3], 'no change as invalid is ignored')
  }

  finalizeTest(t)
})

tape.test('delay test', t => {

  const result = []
  const msDelay = 50
  const source = _.cell('source')
  const middle = _.delay(msDelay, source)

  _.cell('sink', [middle], d => {result.push(d)})

  t.same(result, [], 'no input pushed yet')

  _.put(source, 3)
  t.same(result, [], 'nothing happened yet, we are in synchronous line')

  setTimeout(() => {

    t.same(result, [], 'still waiting...')

    setTimeout(() => {
      t.same(result, [3], 'value arrived')
      finalizeTest(t)
    }, msDelay)

  }, msDelay / 1.5)
})

tape.test('lift test', t => {

  const result = []

  const source = _.cell('source')

  _.lift(value => {
    const r = value * 3
    result.push(r) // collecting for testing
    return r
  })(source)

  t.same(result, [], 'nothing happened yet')
  _.put(source, 3)
  t.same(result, [9], '1st val')
  _.put(source, 4)
  t.same(result, [9, 12], '2nd val')

  finalizeTest(t)
})

tape.test('lift test that checks for passing on the previous value', t => {

  const result = []
  const prevVl = []

  const source = _.cell('source')

  _.lift(function(value) {
    prevVl.push(this.value)
    const r = value * 3
    result.push(r) // collecting for testing
    return r
  })(source)

  t.same(result, [], 'nothing happened yet')
  t.same(prevVl, [], 'nothing happened yet')

  _.put(source, 3)
  t.same(result, [9], '1st val')
  t.same(prevVl, [_.invalid], '1st val')

  _.put(source, 4)
  t.same(result, [9, 12], '2nd val')
  t.same(prevVl, [_.invalid, 9], '2nd val')

  finalizeTest(t)
})

tape.test('lift test with preexisting value', t => {

  const result = []

  const source = _.cell('source')
  _.put(source, 3)
  _.put(source, 4)
  t.same(result, [], 'nothing happened yet, it is a hot observable' )

  _.lift(value => {
    const r = value * 3
    result.push(r) // collecting for testing
    return r
  })(source)

  t.same(result, [12], 'lifted function applied to current value')

  _.put(source, 10)
  t.same(result, [12, 30], '2nd val')

  finalizeTest(t)
})

tape.test('scan test', t => {

  const result = []

  const source = _.cell('source')

  const scanner = _.scan((prev, next) => 2 * prev + 3 * next, 1, source)

  _.cell('sink', [scanner], s => result.push(s))

  t.same(result, [], 'nothing happened, yet the initial value is present')
  _.put(source, 3)
  t.same(result, [11], '1st reduced input')
  _.put(source, 4)
  t.same(result, [11, 34], '2nd reduced input')

  finalizeTest(t)
})

tape.test('scan plus lift test', t => {

  const result = []

  const source = _.cell('source')
  const otherSource = _.cell('other source')
  _.put(otherSource, 0)
  const weirdSum = _.scan((prev, next) => {
    return 2 * prev + 3 * next
  }, 7, source)
  _.lift((o, w) => result.push(w + o))(otherSource, weirdSum)

  t.same(result, [], 'nothing happened yet')
  _.put(source, 3)
  t.same(result, [23], '1st val')
  _.put(source, 4)
  t.same(result, [23, 58], '2nd val')

  finalizeTest(t)
})
