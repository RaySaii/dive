import dive from '../index'
import React from 'react'
import {create} from 'react-test-renderer'
import {mapTo, map, tap, concatAll, concat, switchMapTo} from 'rxjs/operators'
import {marbles, observe} from 'rxjs-marbles/jest'
import {EMPTY, of, combineLatest, merge} from 'rxjs'
import Sinon from 'sinon'

export function find(node, type) {
  return node.find((node) => node.type === type)
}

const timer = Sinon.useFakeTimers()
const timeToDelay = 200

describe('dive sharedState and sharedEvent', () => {

  it('should sync state and event', (done) => {

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


  it('should globalEvent shareReplay(1) when component didMount which use this globalEvent', (done) => {
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
                  foo:{state.foo}
                  <button className={'add'} onClick={eventHandle.handle('add')}>foo add event</button>
                </div>,
            ),
        ),
        reducer: merge(
            eventHandle.event('add').pipe(mapTo(state => ({ ...state, foo: state.foo + 1 }))),
        ),
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
            map(({ bar, foo }) => {
              return <div>
                <h3>Bar Component:</h3>
                bar:<h1 className={'bar'}>{bar}</h1>
              </div>
            }),
        ),
        reducer: Foo.globalEvent.event('add').pipe(
            mapTo(state => ({ ...state, bar: state.bar + 1 })),
        ),
      }
    })

    const FooC = create(<Foo/>)
    const addButton = FooC.root.findByType('button')
    addButton.props.onClick()
    addButton.props.onClick()
    addButton.props.onClick()
    const BarC = create(<Bar/>)
    const bar = BarC.root.findByType('h1')
    expect(bar.children).toEqual(['3'])
    done()
  })

  it('should multiple same component shared their globalEvent but handle own event', done => {

    const Foo = dive({
      state: { foo: 1 },
      globalEvent: ['add'],
    })(({ state$, eventHandle }) => {
      return {
        DOM: state$.pipe(
            map(state =>
                <div>
                  <h3>Foo Component:</h3>
                  foo:<h1>{state.foo}</h1>
                  <button onClick={eventHandle.handle('add')}>foo add event</button>
                </div>,
            ),
        ),
        reducer: merge(
            eventHandle.event('add').pipe(mapTo(state => ({ ...state, foo: state.foo + 1 }))),
        ),
      }
    })

    const Index = dive()(({ state$, eventHandle }) => {
      return {
        DOM: combineLatest(
            state$,
            Foo.globalState$,
        ).pipe(
            map(([state, fooState]) => {
              return <div>
                <button onClick={Foo.globalEvent.handle('add')}>+</button>
              </div>
            }),
        ),
      }
    })


    const IndexC = create(<Index/>)
    const FooNode = <Foo/>
    const Foo1 = create(FooNode)
    const Foo2 = create(FooNode)
    const fooGlobalAdd = IndexC.root.findByType('button')
    const foo1Add = Foo1.root.findByType('button')
    const foo2Add = Foo2.root.findByType('button')
    foo1Add.props.onClick()
    const foo1 = Foo1.root.findByType('h1')
    const foo2 = Foo2.root.findByType('h1')
    expect(foo1.children).toEqual(['2'])
    expect(foo2.children).toEqual(['1'])
    fooGlobalAdd.props.onClick()
    // timer.tick(timeToDelay)
    expect(foo1.children).toEqual(['3'])
    expect(foo2.children).toEqual(['2'])
    done()
  })

  it('should component globalState will be pause when unmount and will be activate when mount again', done => {

    const Index = dive({
      state: {
        value: 1,
      },
      globalEvent: ['add'],
    })(({ state$, eventHandle }) => {
      return {
        DOM: combineLatest(
            state$,
            Foo.globalState$,
        ).pipe(
            map(([state, fooState]) => {
              return <div>
                <h2>value:{state.value}</h2>
                <h1>{fooState.foo}</h1>
                <button onClick={eventHandle.handle('add')}>+</button>
              </div>
            }),
        ),
        reducer: merge(
            eventHandle.event('add').pipe(mapTo(state => ({ ...state, value: state.value + 1 }))),
            eventHandle.event('sub').pipe(mapTo(state => ({ ...state, value: state.value - 1 }))),
        ),
      }
    })

    const Foo = dive({
      state: { foo: 1 },
      globalState: ['foo'],
    })(({ state$, eventHandle }) => {
      return {
        DOM: state$.pipe(
            map(state =>
                <div>
                  <h3>Foo Component:</h3>
                  foo:{state.foo}
                </div>,
            ),
        ),
        reducer: merge(
            Index.globalEvent.event('add').pipe(mapTo(state => ({ ...state, foo: state.foo + 1 }))),
        ),
      }
    })

    const IndexC = create(<Index/>)

    const addButton = IndexC.root.findByType('button')

    const FooC = create(<Foo/>)

    const fooInIndex = IndexC.root.findByType('h1')
    expect(fooInIndex.children).toEqual(['1'])
    addButton.props.onClick()
    expect(fooInIndex.children).toEqual(['2'])
    FooC.unmount()
    addButton.props.onClick()
    expect(fooInIndex.children).toEqual(['2'])
    create(<Foo/>)
    expect(fooInIndex.children).toEqual(['3'])
    done()
  })


  it('should globalEvent params pass correct', done => {

    const Foo = dive({
      state: { foo: 1 },
      globalEvent: ['set'],
    })(({ state$, eventHandle }) => {
      return {
        DOM: state$.pipe(
            map(state => {
                  return <div>
                    <h3>{JSON.stringify(state.foo)}</h3>
                    <button className={'num'} onClick={() => eventHandle.handle('set')(1)}>set num</button>
                    <button className={'two'} onClick={() => eventHandle.handle('set')(1, 1)}>set two</button>
                    <button className={'arr'} onClick={() => eventHandle.handle('set')([1])}>set array</button>
                  </div>
                },
            ),
        ),
        reducer: eventHandle.event('set').pipe(map(args => ({ foo: args }))),
      }
    })

    const foo = create(<Foo/>)
    const numButton = foo.root.findByProps({ className: 'num' })
    const twoButton = foo.root.findByProps({ className: 'two' })
    const arrButton = foo.root.findByProps({ className: 'arr' })
    const val = foo.root.findByType('h3')
    numButton.props.onClick()
    expect(val.children).toEqual(['1'])
    twoButton.props.onClick()
    expect(val.children).toEqual(['[1,1]'])
    arrButton.props.onClick()
    expect(val.children).toEqual(['[1]'])
    Foo.globalEvent.handle('set')(1)
    expect(val.children).toEqual(['1'])
    Foo.globalEvent.handle('set')(1, 1)
    expect(val.children).toEqual(['[1,1]'])
    Foo.globalEvent.handle('set')([1])
    expect(val.children).toEqual(['[1]'])
    Foo.globalEvent.handle('set')([1],[1,2])
    expect(val.children).toEqual(['[[1],[1,2]]'])
    done()
  })


})



