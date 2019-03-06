import dive from '../index'
import React from 'react'
import {create} from 'react-test-renderer'
import {mapTo, map, tap, concatAll, concat, switchMapTo} from 'rxjs/operators'
import {marbles, observe} from 'rxjs-marbles/jest'
import {EMPTY, of,combineLatest} from 'rxjs'

export function find(node, type) {
  return node.find((node) => node.type === type)
}

const Foo = dive({
  state: { foo: 1 },
  globalState: ['foo'],
  globalEvent: ['add'],
})(({ state$, eventHandle }) => {
  return {
    DOM: state$.pipe(
        map(state =>
            <div>
              <h3>Foo Component:</h3>
              foo:<span>{state.foo}</span>
              <button onClick={eventHandle.handle('add')}>foo add event</button>
            </div>,
        ),
    ),
    reducer: eventHandle.event('add').pipe(mapTo(state => ({ ...state, foo: state.foo + 1 }))),
  }
})


const Bar = dive({
  state: { bar: 2 },
})(({ state$ }) => {
  return {
    DOM: combineLatest(
        state$,
        Foo.globalState$,
        (state, fooState) => Object.assign({}, state, fooState),
    ).pipe(
        map(({ bar, foo }) => <div>
          <h3>Bar Component:</h3>
          bar:<span>{bar}</span>
          foo:<i>{foo}</i>
        </div>),
    ),
    reducer: Foo.globalEvent.event('add').pipe(
        mapTo(state => ({ ...state, bar: state.bar + 1 })),
    ),
  }
})

describe('dive sharedState and sharedEvent', () => {

  it('should sync state and event', (done) => {
    const FooC = <Foo/>
    const BarC = <Bar/>
    const FooRender = create(FooC)
    const BarRender = create(BarC)
    const button = find(FooRender.root, 'button')
    const foo = find(FooRender.root, 'span')
    const fooInBar = find(BarRender.root, 'i')
    const bar = find(BarRender.root, 'span')
    button.props.onClick()
    expect(foo.children).toEqual(['2'])
    expect(bar.children).toEqual(['3'])
    expect(fooInBar.children).toEqual(['2'])
    done()
  })

})
