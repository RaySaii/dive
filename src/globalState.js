import {ReplaySubject, Subject} from 'rxjs'
import {scan, shareReplay, distinctUntilChanged} from 'rxjs/operators'
import {isEmpty, omit, omitBy} from 'lodash'


class State {
  constructor() {
    this._globalState = {}
    this._globalState$ = new Subject().pipe(
        scan((state, [reducer, id]) => {
          const nextState = reducer(state)
          this._actions$.next({ state, nextState, id })
          return nextState
        }, {}),
        distinctUntilChanged(),
        shareReplay(1),
    )
    this._devGlobalState$ = new ReplaySubject()
    this._actions$ = new ReplaySubject()
    this._globalState$.subscribe(state => {
      this._devGlobalState$.next(state)
      if (process.env.NODE_ENV == 'development') {
        // console.log('global', state)
      }
      this._globalState = state
      // console.log('global', state)
    })
  }


}

const state = new State()
export const devGlobalState$ = state._devGlobalState$
export const globalState = state._globalState

export const actions$ = state._actions$
export default state._globalState$
