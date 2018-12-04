import {ReplaySubject, Subject} from 'rxjs'
import {scan, shareReplay, distinctUntilChanged, map, share} from 'rxjs/operators'
import {isEmpty, omit, omitBy} from 'lodash'
import diff from 'shallow-diff'
import {shallowEqual} from './index'


class State {
  constructor() {
    this._globalState = {}
    this._globalState$ = new Subject().pipe(
        scan((state, reducer) => reducer(state), {}),
        distinctUntilChanged(),
        shareReplay(1),
    )
    this._devGlobalState$ = new ReplaySubject()
    this._actions$ = new ReplaySubject().pipe(
        map(({ state, nextState, id, unChanged }) => {
          if (unChanged) return id + ' action but unchanged'
          let difference = diff(state, nextState)
          difference = omitBy(difference, isEmpty)
          difference = omit(difference, 'unchanged')
          let action = {}
          Object.keys(difference).forEach(key => {
            difference[key].forEach(prop => {
              action[key] = action[key] || {}
              action[key][prop] = nextState[prop]
            })
          })
          return isEmpty(action) ? id + ' action but unchanged' : { [id]: action }
        }),
    )
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
