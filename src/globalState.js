import {Subject} from 'rxjs'
import {scan, shareReplay, distinctUntilChanged} from 'rxjs/operators'

const globalState$ = new Subject().pipe(
    scan((state, reducer) => reducer(state), {}),
    distinctUntilChanged(),
    shareReplay(1),
)
export let globalState = {}
globalState$.subscribe(state => {
  if (process.env.NODE_ENV == 'development') {
    console.log('global', state)
  }
  globalState = state
  // console.log('global', state)
})
export default globalState$
