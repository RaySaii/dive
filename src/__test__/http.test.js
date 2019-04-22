import dive from '../index'
import {BehaviorSubject, combineLatest, Subject} from 'rxjs'
import {map} from 'rxjs/operators'
import React from 'react'
import {create} from 'react-test-renderer'
import Sinon from 'sinon'

const timer = Sinon.useFakeTimers()
const timeToDelay = 2000
dive.applyHTTPDriver({
  GET: () => Promise.resolve(1),
})

describe('applyHTTPDriver should work correctly', () => {


  it('applyHTTPDriver will work correctly', async done => {
    let test = null

    const Index = dive({
      state: {
        value: 1,
      },
      globalEvent: ['add'],
    })(({ state$, eventHandle, HTTP }) => {

      eventHandle.event('add').subscribe(_ => {
        HTTP.withLoading('add').GET()
      })

      HTTP.loading$.subscribe(loading => {
        test = loading
      })

      return combineLatest(
          state$,
      ).pipe(
          map(([state]) => {
            return <div>
              <h2>value:{state.value}</h2>
              <button onClick={eventHandle.handle('add')}>+</button>
            </div>
          }),
      )
    })

    const IndexC = create(<Index/>)

    const addButton = IndexC.root.findByType('button')

    addButton.props.onClick()

    expect(test).toEqual({ add: true })

    await timer.tick(timeToDelay)

    expect(test).toEqual({ add: false })

    done()

  })


})
