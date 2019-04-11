# dive 

An experimental library that allows using rxjs as a reactive dataflow framework for React.Inspired by cycle-onionify and componentFromStream API in recompose.

Example:

<https://codesandbox.io/s/github/RaySaii/dive-example>

Quick look:

```javascript
npm i divejs
```



```javascript
import React from 'react'
import ReactDOM from 'react-dom'
import dive from 'divejs'
import {map,mapTo} from 'rxjs/operators'
const Counter=dive({state:{count:1}})(({state$,eventHandle})=>{
  // update state 
    eventHandle.event('add').reduce(
        _=> state=>{
          //this function will be use in immer produce
          state.count+=1
        }
    )
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

#### How to share data among components?

```javascript
const Foo=dive({
    state:{foo:1},
    globalState:['foo']
})(()=>{})

const Bar=dive({
    state:{bar:2},
})(({state$})=>{
  return combineLatest(
        state$,
        Foo.globalState$,
        (state,fooState)=>Object.assign({},state,globalState)
    ).pipe(
        map(({bar,foo})=><div>bar:{bar} foo:{foo}</div>)
    )
})

``` 

#### How to share event among components?
```javascript
const Foo=dive({
    state:{foo:1},
    globalState:['foo'],
    globalEvent:['add']
})(({state$,eventHandle})=>{
  eventHandle.event('add').reduce(_=>state=>{
      state.foo+=1
  })
  return state$.pipe(
        map(state=>
          <div>{state.foo}<button onClick={eventHandle.handle('add')}>+</button></div>
        )
    )
})

const Bar=dive({
    state:{bar:2},
})(({state$})=>{
  Foo.globalEvent.event('add').reduce(
      _ => state=>{
        state.bar+=1
      }
  )
  return combineLatest(
        state$,
        Foo.globalState$,
        (state,fooState)=>Object.assign({},state,fooState)
    ).pipe(
        map(({bar,foo})=><div>bar:{bar} foo:{foo}</div>)
    )
})

``` 

### API

#### `dive({state,globalState,globalEvent})`

It returns function which expects a state *stream* and eventHandle which can transform event to *stream* and  props *stream*. 

**Arguments:**

- `state:Object `give component initial state.

- `globalState:String[] `define which state can be use out of component.

- `globalEvent:String[] `define which event can be use out of component.


**Returns:**


*`(Function)`* which expect `{state$,props$,eventHandle}`,and return `Observable<ReactNode>`

- `state$` state stream.
- `props$` props stream.
- `eventHandle` handle any event to stream.`eventHandle.handle(string)` return a function to handle event.`eventHandle.event(string)` get the event *stream*.`eventHandle.didMount`get the componentDidMount stream.

#### dive/utils

- `xhr` expected a function return promise. Everytime will produce a array.

  example:

  ```javascript
  import {xhrWithStatus} from 'divejs'
  //...
  eventHandle.event('some').pipe(
      xhrWithStatus(params=>fetch(`some-url?params=${params}`).then(res=>res.json())),
  )
    .reduce(([data,loading])=>state=>{
        state.data=data
        state.loading=loading
  })
  // -> state:{data:undefined,loading:true}
  // -> state:{data:someData,loading:false}
  //...
  ```

- `xhr` without loading,everytime will only produce promise resolve value.

- `And,Or` as the name say.

- `shouldUpdate` a custom operator to implement shouldComponentUpdate lifecycle:
  ```js
  import {shouldUpdate} from 'divejs'
  ...
  return combineLatest(
      props$,
      state$,
      (props,state)=>Object.assign({},props,state)
    ).pipe(
      shouldUpdate((previous,current)=>{
        //...some compare
        return boolean
      })  
    )
  
  ```

- `shallowEqual` a function as the name say.

