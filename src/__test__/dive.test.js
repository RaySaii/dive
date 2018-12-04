import dive from '../index'
import React from 'react'
import {create} from 'react-test-renderer'
import globalState$, {globalState} from '../globalState'
import {mapTo, map, tap, concatAll, concat, switchMapTo} from 'rxjs/operators'
import {marbles, observe} from 'rxjs-marbles/jest'
import {EMPTY, of} from 'rxjs'

export function find(node, type) {
  return node.find((node) => node.type === type)
}

const SimpleSet = dive({
  lens: {
    set: (state, ownState) => ({
      ...state,
      test: ownState,
    }),
  },
})(({ state$, eventHandle }) => {
  state$.update(
      eventHandle.event('click').pipe(
          mapTo({ a: 1 }),
      ),
  )
  return state$.pipe(
      map(state => <div>
        <h1>{state.a}</h1>
        <button onClick={eventHandle.handle('click')}/>
      </div>),
  )
})


const SimpleGet = dive({
  lens: { get: state => ({ a: state.test ? state.test.a : '' }) },
})(({ state$ }) => state$.pipe(map(state => <h2>{state.a}</h2>)))


const ComplexLens = dive({
  lens: {
    get: state => ({ ...state.test1, a: state.test ? state.test.a : '' }),
    set: (state, ownState) => ({ ...state, test1: ownState }),
  },
})(({ state$, eventHandle }) => {
  state$.update(eventHandle.event('change').pipe(mapTo({ b: 2 })))
  return state$.pipe(map(state =>
      <>
        <h3>{state.b}</h3>
        <button onClick={eventHandle.handle('change')}>{state.a}</button>
      </>,
  ))
})

describe('dive test', () => {

  it('should set global test', (done) => {
    const fixture = <SimpleSet/>
    const fixture1 = <SimpleGet/>
    const fixture2 = <ComplexLens/>
    const testRender = create(fixture)
    const testRender1 = create(fixture1)
    const testRender2 = create(fixture2)
    const button = find(testRender.root, 'button')
    const button1 = find(testRender2.root, 'button')
    const h1 = find(testRender.root, 'h1')
    const h2 = find(testRender1.root, 'h2')
    const h3 = find(testRender2.root, 'h3')
    expect(h1.children).toEqual([])
    expect(h2.children).toEqual([])
    expect(h3.children).toEqual([])
    expect(button1.children).toEqual([])
    button.props.onClick()
    expect(h1.children).toEqual(['1'])
    expect(h2.children).toEqual(['1'])
    expect(h3.children).toEqual([])
    expect(button1.children).toEqual(['1'])
    button1.props.onClick()
    globalState$.subscribe(value => {
      expect(value).toEqual({ test: { a: 1 }, test1: { a: 1, b: 2 } })
      done()
    })
  })

  // it('should set global test1', (done) => {
  //   const fixture2 = <ComplexLens/>
  //   const testRender = create(fixture)
  // })
})
