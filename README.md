# dive 

An experimental library that allows using rxjs as a reactive dataflow framework for React.Inspired by cycle-onionify and componentFromStream API in recompose.

Example:

<https://codesandbox.io/s/github/RaySaii/dive-example>

Quick look:

```javascript
npm i divejs
```



```js
import React from 'react'
import ReactDOM from 'react-dom'
import dive from 'divejs'
import {map,mapTo} from 'rxjs/operators'
// ...
const Counter=dive({state:{count:1}})(({state$,eventHandle})=>{
    const count$=eventHandle.event('add').pipe(
        // reducer
    	mapTo(state=>({...state,count:state.count+1}))
    )
    
    // update state (pass by stream of reducer function)
    // (more stream : state$.update(merge(...streams)))
    state$.update(count$)
    
    // dive creates a React component by mapping an this stream of state$ to a stream of React nodes (vdom).

    return state$.pipe(
    	map(state=>(
        	<div>
                {state.count}
                <button onClick={eventHandle.handle('add')}>
                    +
                </button>
            </div>
        ))
    )
})
const App=dive({state:{a:1}})(({state$})=>{
    return state$.pipe(
    	map((state)=>(
            <div>
            	<div>{state.a}</div>
            	<Counter/>
            </div>
        ))
    )
})

ReactDOM.render(
  <App />,
  document.getElementById('root')
);
```

##More important

Manage state in a single state atom.

- **Simple:** all state lives in one place only
- **Predictable:** use the same pattern to build any component

### How it works?

Looks like cycle-onionify:

```js
// without lens
const WithoutLens=dive({state:{a:1}})(()=>{})
// -> global state:{dive0:{a:1}}
// dive give some name

// string lens
const SimpleLens=dive({lens:'simple',state:{a:1}})(()=>{})
// -> global state:{dive0:{a:1},simple:{a:1}}
                                      
```

#### How to share data among components?

```js
// -> global state:{dive0:{a:1},simple:{a:1}}
const Foo=dive({
    lens:{
        get:state=>({...state.foo,a:state.simple.a}),
        // -> Foo components state:{a:1,b:1}
        set:(state,ownState)=>({
            ...state,
            foo:ownState,
            simple:{...state.simple,a:ownState.a}
        })
    },
    state:{b:1}
})(()=>{})
// -> global state:{dive0:{a:1},simple:{a:1},foo:{a:1,b:1}}
```

The `lens` is composed of a `get` function that extracts the `.foo` sub-state, and a `set` function that returns the updated state whenever the sub-state is modified by the child component. 

#### What is the different among cycle-onionify?

Cycle-onionify`s state tree is same as component tree,because cyclesjs is strict implementing functional programming.Child returns its dom sinks,state sinks and so on,parent compose children sinks and return own sinks.This is a good abstraction.But in real-world ,this way cause some problem.The biggest problem is modify a deep state will be so trouble.So in dive state tree is flat struct.

### API

#### `dive`

```js
dive({lens?:string|{get:function,set:function},state:object}):({state$,props$,eventHandle})=>Observable<ReactNode>
```

```js
state$:Observable<object&{update(Observable<function>)}>
```

```js
eventHandle:{handle:(string)=>function,event:(string)=>Observable<any>}
```

