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

### More important

Manage state in a single state atom.

- **Simple:** all state lives in one place only.
- **Predictable:** use the same pattern to build any component.

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
        // -> Foo component state:{a:1,b:1}
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

Cycle-onionify`s state tree is same as component tree,because cyclesjs is strict implementing functional programming.Child returns its dom sinks,state sinks and so on,parent compose children sinks and return own sinks.This is a good abstraction.But in real-world ,this way cause some problem.The biggest problem is modify a deep state will be so trouble.So state tree is flat struct in dive.

### API

#### `dive(lens,state)`

It returns function which expects a state *stream* and eventHandle which can transform event to *stream* and  props *stream*. 

**Arguments:**

+++

- `lens?:string|{get:Function,set:Function} `the `lens`  give component state a id in global state.Or composed of a `get` function that extracts the `sub-state`, and a `set` function that returns the updated state whenever the sub-state is modified by the child component.

- `state:Object `give component initial state,if `lens  ` sets up `get` function,dive will assign `state` and `sub-state`.



**Returns:**

+++

*`(Function)`* which expect `{state$,props$,eventHandle}`,and return `Observable<ReactNode>`

- `state$` state *stream* which get from global state,once global state has changed, component will extracts `sub-state`.But `state$` may not produce next value,because dive use `distinctUntilChanged(shallowEqual)` to  extracts `sub-state`.`state$` always has `update` method which expected reducer function *stream*,the only way to update state.If `lens` sets up `set` function,global state and updated state will pass to `lens.set` to produce new global state.
- `props$  ` props stream.
- `eventHandle` handle any event to *stream*.`eventHandle.handle(string)` return a function to handle event.`eventHandle.event(string)` get the event *stream*.





#### dive/utils

- `fromHttp` expected a promise,returns a stream. Everytime will produce two value,first `{data:undefined,status:'pending'}`,second `{data:some,status:'fulfilled'}`.

  example:

  ```js
  import {fromHttp} from 'divejs/utils'
  //...
  const fetchData=params=>fromHttp(fetch(`some-url?params=${params}`).then(res=>res.json()))
  const some$=eventHandle.event('some').pipe(
  	switchMap(fetchData),
      map(some=>state=>({...state,some}))
  )
  state$.update(data$)
  // -> state:{some:{data:undefined,status:'pending'}}
  // -> state:{some:{data:someData,status:'fulfilled}}
  //...
  ```

- `fromPureHttp` without status,everytime will only produce promise resolve value.

- `And,Or` as the name say.

- `Get,Map` avoid target is empty.

  example:

  ```js
  <div>
  	{And(condition1,condition2)&&<span>and</span>}   
      {Or(condition1,condition2)&&<span>or</span>}
  	// if value is undefined will return null
  	<Get target={source} path={'a.b.c[0]'}>
          {data=><div>{data}</div>}
  	</Get>
  	// if id set, key will be item[id]
  	// if not , key will be array index or object key
  	<Map target={source} id={'id'}>
      	{(item,key)=><div key={key}>{item}<div>}   
      </Map>
  </div>
  ```

- `HttpComponent` :

  ```js
  <HttpComponent
  	data={source}
  	status={source.status}
  	loading={<div>Loading...</div>} // when status=='pending'
      empty={<div>Empty</div>} // when status=='fulfilled' and data is empty
      render={data=><div>{data}</div>}
  />
  ```

- `shallowEqual` a function as the name say.

