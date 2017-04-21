# crosslink.js

Status: under active development, the API will change significantly. 

Install: 
```
npm install crosslink
``` 
or `clone`, `npm install`  and `npm build` this package, then use the bundle as a script (see the `examples` directory).

Goals: 

* suitable for linking input, calculation and rendering components
* small footprint (around 1kB minified and gzipped)
* small API, focusing on the `lift` operation
* fast
* predictable
* glitch free
* also suitable for asynchronous updates
* reasonably safe and debuggable
* covered with test cases

The library follows the spreadsheet model: cells can be created explicitly, and values can be `put` in the cells. Cells can also be `remove`d. The real power comes from the `lift` operator, which makes a regular function eg. `(a, b) => a + b` and yields a _lifted_ function, in this case, a cell whose value is the sum of the values of two other cells. Each lifted function can be considered a cell in a spreadsheet which is a function that depends on other cells.

Example: 

```javascript
import _ from 'crosslink'

const cellA = _.cell('our cell A')
const cellB = _.cell('our cell B')

const adder = (a, b) => a + b
const logger = x => { console.log('The cell value is', x) }

const liftedAdder = _.lift(adder)
const liftedLogger = _.lift(logger)

const c = liftedAdder(cellA, cellB)
liftedLogger(c)

_.put(cellA, 3)
    // nothing happens

_.put(cellB, 6)
    // The cell value is 9

_.put(cellA, 2)
    // The cell value is 7
```

The cells need to be managed as resources: in case they're generated in runtime in proportion to runtime or incoming data, they need to be `remove`d to avoid memory leaks. Even if the cells are established once on an initial execution and there is no subsequent cell creation, the cells remain operational even after they are not actually used, for example, if the DOM elements they influence had been removed from the document DOM - potentially expensive calculations continue to run on each input update, which may be left in by accident, and the DOM nodes may be prevented from garbage collection by the cell function continuing to hold a reference to them.

The dependency links among cells form a [directed acyclic graph](https://en.wikipedia.org/wiki/Directed_acyclic_graph). Following the spreadsheet model - [which is, at its core](https://en.wikipedia.org/wiki/Spreadsheet), a directed acyclic graph -, it uses [topological sorting](https://en.wikipedia.org/wiki/Topological_sorting) to propagate updates to dependencies (cells downstream in the DAG), as [commonly done](http://www.geeksforgeeks.org/topological-sorting/) in the case of spreadsheets.

It is possible for a DAG to have a node that depend on some upstream node through different paths. For example, `B` and `C` both depend on `A`, and `D` depends on both of `B` and `C`, therefore an update to `A` will reach `D` in two 'waves'. This is prone to cause _glitches_ as `D` will be inconsistent for a brief moment, before the second update. These glitches are avoided by invalidating all direct and indirect dependencies first; in the second step, values are propagated, and `D` will only be recomputed once it got sufficient input i.e. when it also got even the last piece input stemming from updating `A`.

It _is_ possible for a cell update function to `put` a value in any cell, but if the data propagation from _that_ cell causes a recalculation of the initiating cell, a circularity error will be signaled.

The speed and predictable updates are due to synchronous operations. Data are propagated in the DAG synchronously. By consequence, to avoid UI lock-up, long-running cell operations are best done asynchronously, e.g. in a `setTimeout`, Web Worker, or some method of incremental recalculation. Currently, the output of the asynchronously scheduled operation needs to update a cell different from the one doing the scheduling, but this restricion might be lifted in the future.

Compact size is achieved by relying on no dependencies and trying to capture a minimal set of functions, from which useful functionality can be composed. The primary method of composition is the use of `lift`, which is currently suitable for stateless calculations. Currently, few other operators are supported: `scan`, `merge` and `delay`. New functionality will be added as needed.  

Note to users of observables libraries: The cells are analogous to [hot observables](https://medium.com/@benlesh/hot-vs-cold-observables-f8094ed53339) in that creating a cell will _not_ cause the reexecution of code upstream in the DAG. For example, a new cell that has the result of AJAX calls as an upstream will not cause a new AJAX request. Features analogous to cold observables can currently only be emulated, for example, by using factory functions or retaining the history of the downstream cells for replay.

Comparable, more mature libraries with generally broader scope, a diversity of objectives and various overlaps with `crosslink` functionality (and one another):

- [flyd](https://github.com/paldepind/flyd)
- [xstream](https://github.com/staltz/xstream)
- [most](https://github.com/cujojs/most)
- [RxJS](https://github.com/Reactive-Extensions/RxJS)
- [MobX](https://github.com/mobxjs/mobx)
- [Redux](https://github.com/reactjs/redux)


# API
Generally, all kinds of values can be propagated except, currently, `undefined`, which now represents an _invalid_ status. In the future, the notion of an invalid state - e.g. due to not having received all input yet - might be separated from the concept of`undefined` although it arguably represents the concept of _not having been defined_.

Prefer the use of named functions, for example, defined as `function myFun() {}` or `const myFun = () => {}` so that the function name is available when debugging cell-based code.


<a name="cell" href="#cell">#</a> _.<b>cell</b>(<i>[alias]</i>)

Creates an input cell. Use:
```javascript
const age = _.cell('age')
```
The result is a cell. The input cell can be depended on by calculated cells. The optional `alias` must be a string and helps debug cells, which inevitably arises.

<a name="put" href="#put">#</a> _.<b>put</b>(<i>cell, value</i>)

Puts a value in an input cell. Dependent cells will be synchronously updated.
It is commonly done inside event handlers, for example, to put mouse position continuously in a cell, or to update a cell from streaming data from WebSockets. Use:
```javascript
_.put(age, 5)
```

<a name="liftShorthand" href="#liftShorthand">#</a> <b>_</b>(<i>function</i>)

Shorthand for the `_.lift(function)` - it's encouraged to use it as a lightweight notation for constructing function cells.

A spreadsheet cell that contains a formula. Lifts the supplied `function` to operate on cells. The function must have a fixed arity (curried functions are fine). If the function takes `n` arguments, then the result, the _lifted function_, will also take `n` arguments. Each of those arguments can be, but does not have to be, a cell.

```javascript

const bmiFormulaSI = (w, h) => w / (h * h)
const bmiLogger = d => console.log('The BMI value is', d)

const weightKilograms = _.cell()
const heightMeters = _.cell()

const bmi = _(bmiFormulaSI)(weightKilograms, heightMeters)

_(bmiLogger)(bmi)

_.put(heightMeters, 1.83)
_.put(weightKilograms, 80)
/* The BMI value is 23.888 */

// ... dinner happens ...

_.put(weightKilograms, 81)
/* The BMI value is 24.187 */

```
This syntax is closer to the clutter-free mathematical notation than e.g. using `crosslink.lift(function)`.

<a name="lift" href="#lift">#</a> _.<b>lift</b>(<i>function</i>)

See the previous entry.

<a name="scan" href="#scan">#</a> _.<b>scan</b>(<i>function, initialValue, cell</i>)

Accumulates values based on `cell`, similar to JavaScript `reduce`. The supplied `function` must have two arguments `prev` and `next` (can be named differently) such that the accumulating value - which is initially set to `initialValue` - will be `prev`, and the new input from the cell `cell` is the value `next`. Example:

```javascript
const click = _.cell('mouseClick')
_.put(click, true)
const clickCount = _.scan((prev, next) => prev + next, 0, click)
```

<a name="merge" href="#merge">#</a> _.<b>merge</b>(<i>cell1, cell2</i>)

Results a cell that merges the values from two cells. Example:

```javascript
const click = _.cell('mouse click')
const tap = _.cell('finger tap')
const activate = _.merge(click, tap)
```

<a name="delay" href="#delay">#</a> _.<b>delay</b>(<i>delayInMs, cell</i>)

Results a cell that is a delayed version of the supplied `cell` by `delayInMs` milliseconds. Example:
```javascript
const finishSignal = _.delay(300, startSignal)
```