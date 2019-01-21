import { Observable, ReplaySubject, Subject } from 'rxjs'
import { scan, shareReplay, distinctUntilChanged, map } from 'rxjs/operators'
import { isEmpty, omit, omitBy } from 'lodash'
import diff from 'shallow-diff'
import { ReducerFn, State } from './type'

type Action = { state?: State, nextState?: State, id: string, unChanged?: boolean }
type Changed = {
    unchanged?: string[],
    updated?: string[],
    deleted?: string[],
    added?: string[]
}

class DiveState {
    public globalState: State = {}
    public globalState$: Observable<State>
    public devGlobalState$: Subject<State> = new ReplaySubject()
    public actions$: Observable<string | Changed> = new ReplaySubject<Action>().pipe(
        map(({ state, nextState, id, unChanged }) => {
            if (unChanged) return id + ' action but unchanged'
            let difference = diff(state, nextState)
            difference = omitBy(difference, isEmpty)
            difference = omit(difference, 'unchanged')
            let action = {}
            Object.keys(difference).forEach(key => {
                difference[key].forEach((prop: string) => {
                    action[key] = action[key] || {}
                    action[key][prop] = nextState![prop]
                })
            })
            return isEmpty(action) ? id + ' action but unchanged' : { [id]: action }
        }),
    )

    constructor() {
        this.globalState$ = new Subject().pipe(
            scan((state: State, reducer: ReducerFn | any) => reducer(state), {}),
            distinctUntilChanged(),
            shareReplay(1),
        )
        this.globalState$.subscribe(state => {
            this.devGlobalState$.next(state)
            if (process.env.NODE_ENV == 'development') {
                // console.log('global', state)
            }
            this.globalState = Object.assign(this.globalState, state)
            // console.log('global', state)
        })
    }
}

const state = new DiveState()
export const devGlobalState$ = state.devGlobalState$
export const globalState = state.globalState

export const actions$ = state.actions$ as Subject<Action>
export default state.globalState$ as Subject<ReducerFn>
