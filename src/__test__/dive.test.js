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
      eventHandle.event('add').reduce(_ => state => {
        state.foo += 1
      })
      return state$.pipe(
          map(state =>
              <div>
                <h3>Foo Component:</h3>
                foo:<span>{state.foo}</span>
                <button onClick={eventHandle.handle('add')}>foo add event</button>
              </div>,
          ),
      )
    })


    const Bar = dive({
      state: { bar: 2 },
    })(({ state$ }) => {
      Foo.globalEvent.event('add').reduce(_ => state => {
        state.bar += 1
      })
      return combineLatest(
          state$,
          Foo.globalState$,
          (state, fooState) => Object.assign({}, state, fooState),
      ).pipe(
          map(({ bar, foo }) => <div>
            <h3>Bar Component:</h3>
            bar:<span>{bar}</span>
            foo:<i>{foo}</i>
          </div>),
      )
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
      eventHandle.event('add').reduce(_ => state => {
        state.foo += 1
      })

      return state$.pipe(
          map(state =>
              <div>
                <h3>Foo Component:</h3>
                foo:{state.foo}
                <button className={'add'} onClick={eventHandle.handle('add')}>foo add event</button>
              </div>,
          ),
      )
    })

    const Bar = dive({
      state: { bar: 2 },
    })(({ state$ }) => {
      Foo.globalEvent.event('add').reduce(_ => state => {
        state.bar += 1
      })
      return combineLatest(
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
      )
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

      eventHandle.event('add').reduce(_ => state => {
        state.foo += 1
      })

      return state$.pipe(
          map(state =>
              <div>
                <h3>Foo Component:</h3>
                foo:<h1>{state.foo}</h1>
                <button onClick={eventHandle.handle('add')}>foo add event</button>
              </div>,
          ),
      )
    })

    const Index = dive()(({ state$, eventHandle }) => {
      return combineLatest(
          state$,
          Foo.globalState$,
      ).pipe(
          map(([state, fooState]) => {
            return <div>
              <button onClick={Foo.globalEvent.handle('add')}>+</button>
            </div>
          }),
      )
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
      eventHandle.event('add').reduce(_ => state => {
        state.value += 1
      })
      eventHandle.event('sub').reduce(_ => state => {
        state.value -= 1
      })
      return combineLatest(
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
      )
    })

    const Foo = dive({
      state: { foo: 1 },
      globalState: ['foo'],
    })(({ state$, eventHandle }) => {
      Index.globalEvent.event('add').reduce(_ => state => {
        state.foo += 1
      })

      return state$.pipe(
          map(state =>
              <div>
                <h3>Foo Component:</h3>
                foo:{state.foo}
              </div>,
          ),
      )
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
      eventHandle.event('set').reduce(args => state => {
        state.foo = args
      })
      return state$.pipe(
          map(state => {
                return <div>
                  <h3>{JSON.stringify(state.foo)}</h3>
                  <button className={'num'} onClick={() => eventHandle.handle('set')(1)}>set num</button>
                  <button className={'two'} onClick={() => eventHandle.handle('set')(1, 1)}>set two</button>
                  <button className={'arr'} onClick={() => eventHandle.handle('set')([1])}>set array</button>
                </div>
              },
          ),
      )
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
    Foo.globalEvent.handle('set')([1], [1, 2])
    expect(val.children).toEqual(['[[1],[1,2]]'])
    done()
  })

  it('should eventHandle.willUnmount produce a undefined value when unmount', () => {
    let test = 1
    const Foo = dive()(({ eventHandle, state$ }) => {
      eventHandle.willUnmount.subscribe(value => {
        test = value
      })
      return state$.pipe(
          map(state => {
            return <div>foo</div>
          }),
      )
    })
    const FooC = create(<Foo/>)
    expect(test).toEqual(1)
    FooC.unmount()
    expect(test).toEqual(undefined)
  })

  it('should state$ be active when willUnmount', () => {
    let test = 1
    const Foo = dive(
        { state: { foo: 'ok' } },
    )(({ eventHandle, state$ }) => {
      eventHandle.willUnmount
          .pipe(switchMapTo(state$))
          .subscribe(state => {
            test = state.foo
          })
      return state$.pipe(
          map(state => {
            return <div>foo</div>
          }),
      )
    })
    const FooC = create(<Foo/>)
    expect(test).toEqual(1)
    FooC.unmount()
    expect(test).toEqual('ok')
  })

  it('should willUnmount can not reduce new state', () => {
    let test = 1
    const Foo = dive(
        { state: { foo: 'ok' } },
    )(({ eventHandle, state$ }) => {
      eventHandle.willUnmount
          .reduce(_ => state => {
            state.foo = 'new'
          })
      return state$.pipe(
          map(state => {
            test = state.foo
            return <div>{state.foo}</div>
          }),
      )
    })
    const FooC = create(<Foo/>)
    expect(test).toEqual('ok')
    FooC.unmount()
    expect(test).toEqual('ok')
  })

})



