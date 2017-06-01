# crosslink.js

A compact and fast data propagation core for use with higher level libraries or reactive programming directly. Under development, [the API](https://github.com/monfera/crosslink#api) is still evolving. 

Install: 
```
npm install crosslink
``` 
or `clone`, `npm install`  and `npm build` this package, then use the bundle as a script (see the `examples` directory).

Goals: 

* suitable for linking input, calculation and rendering components
* small footprint (around 1kB minified and gzipped)
* small API, focusing on the `lift` operation
* fast, with lots of headroom
* predictable
* glitch free
* also suitable for asynchronous updates
* reasonably safe and debuggable
* covered with test cases

The library implements the spreadsheet model. Cells can be created explicitly, and values can be `put` in source cells directly. But the real power comes from the spreadsheet formulas, technically, the `lift` operator, which takes a plain function eg. `(a, b) => a + b` and yields a _lifted_ function, in this case, a function that makes a cell whose value is the sum of the values of two referenced cells. A lifted function can be used to make one or more cells in the spreadsheet. Unneeded cells can also be `remove`d. The spreadsheet model is temporal: certain API functions rely on past values of the cell (`scan`), impact future values (`delay`) or mirror values from multiple cells (`merge`).

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
    // The cell value is 8
```

The cells need to be managed as resources: if they're generated continuously or upon incoming data, they need to be `remove`d to avoid memory leaks. Even if the cells are established once on an initial execution and there is no subsequent cell creation, the cells remain operational even after they are not actually used, for example, if the DOM elements they influence had been removed from the document DOM - potentially expensive calculations continue to run on each input update, which may be left in by accident, and the DOM nodes may be prevented from garbage collection by the cell function continuing to hold a reference to them.

The dependency links among cells form a [directed acyclic graph](https://en.wikipedia.org/wiki/Directed_acyclic_graph). Following the spreadsheet model - [which is, at its core](https://en.wikipedia.org/wiki/Spreadsheet), a directed acyclic graph -, it uses [topological sorting](https://en.wikipedia.org/wiki/Topological_sorting) to propagate updates to dependencies (cells downstream in the DAG), as [commonly done](http://www.geeksforgeeks.org/topological-sorting/) in the case of spreadsheets.

It is possible for a DAG to have a node that depend on some upstream node through different paths. For example, `B` and `C` both depend on `A`, and `D` depends on both of `B` and `C`, therefore an update to `A` will reach `D` in two 'waves'. This is prone to cause _glitches_ as `D` will be inconsistent for a brief moment, before the second update. These glitches are avoided by invalidating all direct and indirect dependencies first; in the second step, values are propagated, and `D` will only be recomputed once it got sufficient input i.e. when it also got even the last piece input stemming from updating `A`.

It _is_ possible for a cell update function to `put` a value in any cell, but if the data propagation from _that_ cell causes a recalculation of the initiating cell, a circularity error will be signaled.

The speed and predictable updates are due to synchronous operations. Data are propagated in the DAG synchronously. By consequence, to avoid UI lock-up, long-running cell operations are best done asynchronously, e.g. in a `setTimeout`, Web Worker, or some method of incremental recalculation. Currently, the output of the asynchronously scheduled operation needs to update a cell different from the one doing the scheduling, but this restricion might be lifted in the future.

Compact size is achieved by relying on no dependencies and trying to capture a minimal set of functions, from which useful functionality can be composed. The primary method of composition is the use of `lift`, which is currently suitable for stateless calculations. Currently, few other operators are supported: `scan`, `merge` and `delay`. New functionality will be added as needed.  

Note to users of observables libraries: The cells are analogous to [hot observables](https://medium.com/@benlesh/hot-vs-cold-observables-f8094ed53339) in that creating a cell will _not_ cause the reexecution of code upstream in the DAG. For example, a new cell that has the result of AJAX calls as an upstream will not cause a new AJAX request. Features analogous to cold observables can currently only be emulated, for example, by using factory functions or retaining the history of the downstream cells for replay.

More mature libraries with generally broader scope, a diversity of objectives and various overlaps with `crosslink` functionality (and one another):

- [flyd](https://github.com/paldepind/flyd) which, being closest in goals, was also an inspiration
- [xstream](https://github.com/staltz/xstream) has a carefully crafted API and commented source
- [most](https://github.com/cujojs/most) focuses on async operations and fast at that
- [RxJS](https://github.com/Reactive-Extensions/RxJS) where it started in JS land
- [MobX](https://github.com/mobxjs/mobx) a more magical take on data propagation
- [Redux](https://github.com/reactjs/redux) predictable state container, and `scan` on steroids

Links:

- [The Essence and Origins of Functional Reactive Programming](https://www.youtube.com/watch?v=j3Q32brCUAI) is the vision relative to which this library and other JavaScript libraries are overly operational, less declarative, and leave the continuity of time as an exercise to the user. It is possible to sample, integrate and differentiate variables that are considered continuous, for example, by implementing a backward looking [five point stencil](https://en.wikipedia.org/wiki/Five-point_stencil) to numerically differentiate values, for example, for modeling pointer speed. Modeling with continuous time might be a future abstraction.
- [RxMarbles](http://rxmarbles.com/) by André Staltz is a wonderful resource for visualizing events and data propagation across time. Several current and future `crosslink` operations are covered.

The library name is a nod to [crossfilter.js](http://square.github.io/crossfilter/), [linked brushing](http://www.infovis-wiki.net/index.php?title=Linking_and_Brushing) and [crosstalk](https://github.com/rstudio/crosstalk) as `crosslink` will be a basis for related functionality.

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

While it's good practice to _lift_ pure functions, they may also cause side effects, for example, changing some attribute of a DOM element. The side effecting cells are best done as leaf (or sink) nodes in the DAG. There may be good reasons for making other nodes have side effect, e.g. for logging data that flows through for debugging, for caching an expensive calculation or for initiating a calculation asynchronously, e.g. in a Web Worker. As this is a low level library, a future higher level API layer may have dedicated primitives or plugins for capturing DOM events, making changes, scheduling work, [LRU caching](https://en.wikipedia.org/wiki/Cache_replacement_policies#Least_Recently_Used_.28LRU.29) etc.

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

<a name="remove" href="#remove">#</a> _.<b>remove</b>(<i>cell</i>)

Removes a cell from the DAG. Its lifted function will not be called again even if its former upstream cells change. Not only the cell is removed, but also, the DAG is pruned: 

- all downstream cells are recursively `remove`d as they can no longer receive updates
- all upstream cells are recursively `remove`d that only served this cell being removed
    - by extension, the downstream of removed upstream cells are also removed, and
    - the upstreams of downstream cells are also pruned

Naturally, only those upstreams are removed which don't have, or no longer have other uses (direct sinks) downstream.
    
As a consequence, ensure that a permanent cell that may have `remove`d downstream cells is `_.retain`ed. Such cells are typically part of a data model or view model that need to be present even if there is no data point to render at the moment.

<a name="retain" href="#retain">#</a> _.<b>retain</b>(<i>cell</i>)

Retains a cell which would otherwise be subject to pruning (recursive cell removal) in case a downstream cell is removed. 

For example:
 
- there is some model or view model cell carrying aggregate data, config etc. i.e. that need to be there, whether there is some number of data points currently rendered or not
- a downstream (sink, leaf) cell is responsible for updating a DOM element that corresponds to a data point - let's assume it's the only data point
- removing that data point, and freeing up the DOM element modifier cell with a `remove` will cause upstream cells to also be removed
- if the model / view model cell is protected with a `_.retain(viewModelCell)` then it will not be pruned, and newly arriving data points can render (which needs the model / view model cell to function)

Manual resource management, i.e. calling `remove` on a retained cell (or one of its direct or indirect sources) is necessary even if its usages are removed, as there's no automatic pruning from the downstream. A problematic memory leak may occur if retained cells are not removed eventually. Consequently, ensure that `_.retain` is used only as needed and such cells are freed up once they're of no use.

Calling `_.retain` does not affect terminal sinks, as those nodes have no downstreams, i.e. pruning can not propagate to them in an upwards direction. Such cells can be removed either directly, or by removing one of their direct or indirect sources, in which case `retain` is not going to block pruning (removal) anyway. Wrapping is still advised with such cells as it's easy to search the source code for places where memory may leak, and such terminal sinks are the riskiest cells because they typically effect HTML nodes etc. which can get created prolifically but eventually get removed from the DOM. As it's crucial to free up such terminal sinks (in part, to release the reference to removed HTML elements ec.) and prune their upstreams after disuse (e.g. DOM element removal), using `retain` is an easy to search warning sign for untied loose ends. Library abstractions over `crosslink` don't need to do this wrapping if they automatically manage removal (eg. doing it together with the DOM element removal).

_Not_ using `retain` is not going to prevent memory leaks. Pruning only happens when a cell is removed, and only impacts the cells that can be reached downstream (all of them) and upstream (those not protected with `retain`), and their downstreams and unprotected upstreams recursively. Therefore, the only purpose of pruning is to make resource management easier, as typically, only terminal sinks and retained cells will need to be explicitly deleted.
