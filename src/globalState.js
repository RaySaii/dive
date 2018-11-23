import {ReplaySubject, Subject} from 'rxjs'
import {scan, shareReplay, distinctUntilChanged} from 'rxjs/operators'
import {isEmpty, omit, omitBy} from 'lodash'

const globalState$ = new Subject().pipe(
    scan((state, [reducer, id]) => {
      const nextState = reducer(state)
      actions$.next({ state, nextState, id })
      return nextState
    }, {}),
    distinctUntilChanged(),
    shareReplay(1),
)
export let globalState = {}
export const devGlobalState$ = new ReplaySubject()
globalState$.subscribe(state => {
  devGlobalState$.next(state)
  if (process.env.NODE_ENV == 'development') {
    // console.log('global', state)
  }
  globalState = state
  // console.log('global', state)
})
export const actions$ = new ReplaySubject()
export default globalState$
