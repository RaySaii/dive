import { componentFromStream } from './componentFromStream'
import { BehaviorSubject } from 'rxjs'
import globalState$, { globalState, actions$ } from './globalState'
import { distinctUntilChanged, filter, map, share, shareReplay, tap, withLatestFrom } from 'rxjs/operators'
import { cloneDeep, isEmpty, isEqual, pick, uniqueId } from 'lodash'
import _setDevTool from './devTool'
import _applyDrive from './applyDriver'
import { IHttpComponent } from './HttpComponent'
import _shallowEqual from './shallowEqual'
import _HTTP, { _fromHttp, _fromPureHttp } from './http'
import { _And, _debug, _Get, _Map, _Or } from './utils'
import { ComponentClass } from 'react'


type GetFn<State> = (globalState: State) => State
type GetFnOnly<State> = (globalState: State, ownState: State) => State
type SetFn<State> = (globalState: State, ownState: State) => State

type ComponentFactory = (streamsToSinks: any) => ComponentClass<any>

export default function dive<State>(x: { lens: { get: GetFnOnly<State> }, state?:object }): ComponentFactory;
export default function dive<State>(x: { lens: { get?: GetFn<State>, set: SetFn<State> }, state?:object }): ComponentFactory;
export default function dive(x: { state:object }): ComponentFactory;
export default function dive(x): ComponentFactory;
export default function dive({ lens = {}, state: initState = {} }): ComponentFactory {
    let state$
    let update
    let myId
    if (typeof lens == 'object') {
        lens = pick(lens, 'get', 'set')
        if (isEmpty(lens)) {
            return streamsToSinks => componentFromStream({
                myId,
                initState,
                streamsToSinks,
                type: 'empty-lens',
            })
        } else if (!lens.get && lens.set) {
            const updateGlobal = (ownState) => {
                let reducer = state => lens.set(state, ownState)
                globalState$.next(reducer)
            }
            return streamsToSinks => componentFromStream({
                updateGlobal,
                initState,
                streamsToSinks,
                type: 'only-set-lens',
            })
        } else if (!lens.set && lens.get) {
            state$ = (ownState$) => globalState$.pipe(
                withLatestFrom(ownState$, (state, ownState) => lens.get(state, ownState || {})),
            )
            return streamsToSinks => componentFromStream({
                state$,
                initState,
                streamsToSinks,
                type: 'only-get-lens',
            })
        } else {
            myId = uniqueId('dive')
            // const handledInit = Object.assign(initState, lens.get(globalState))
            update = (ownReducer, init = false) => {
                if (ownReducer == null) return  // 当下一个reducer为null时放弃更新
                let reducer = null
                if (typeof ownReducer == 'function') {
                    reducer = state => {
                        const prevState = lens.get(state)
                        const nextState = ownReducer(prevState)
                        // 当下一个reducer函数返回值仍为state时放弃更新
                        if (nextState == prevState) {
                            actions$.next({ id: myId, unChanged: true })
                            return state
                        }
                        const nextGlobalState = lens.set(state, nextState)
                        actions$.next({ id: myId, state, nextState: nextGlobalState })
                        return nextGlobalState
                    }
                } else {
                    // reducer为对象与setState同
                    reducer = state => {
                        const nextGlobalState = lens.set(state, Object.assign({}, init ? {} : lens.get(state), ownReducer))
                        actions$.next({ id: myId, state, nextState: nextGlobalState })
                        return nextGlobalState
                    }
                }
                globalState$.next(reducer)
            }
            update(initState, true)
            state$ = globalState$.pipe(
                filter(state => {
                    if (isEmpty(globalState)) return true
                    return shallowEqual(state, globalState)
                }),
                map(lens.get),
                distinctUntilChanged(shallowEqual),
            )
        }
    } else if (typeof lens == 'string') {
        myId = lens
        update = (ownReducer, init = false) => {
            if (ownReducer == null) return
            let reducer = null
            if (typeof ownReducer == 'function') {
                reducer = state => {
                    const prevState = state[myId]
                    const nextState = ownReducer(prevState)
                    if (nextState == prevState) {
                        actions$.next({ id: myId, unChanged: true })
                        return state
                    }
                    const nextGlobalState = { ...state, [myId]: nextState }
                    actions$.next({ id: myId, state, nextState: nextGlobalState })
                    return nextGlobalState
                }
            } else {
                reducer = state => {
                    const nextGlobalState = { ...state, [myId]: Object.assign({}, init ? {} : state[myId], ownReducer) }
                    actions$.next({ id: myId, state, nextState: nextGlobalState })
                    return nextGlobalState
                }
            }
            globalState$.next(reducer)
        }
        update(initState, true)
        state$ = globalState$.pipe(
            filter(state => {
                if (isEmpty(globalState)) return true
                return shallowEqual(state, globalState)
            }),
            map(state => state[myId]),
            distinctUntilChanged(shallowEqual),
        )
    }

    return streamsToSinks => componentFromStream({ myId, state$, update, streamsToSinks })
}

export const applyDriver = _applyDrive
export const setDevTool = _setDevTool

export const And = _And

export const Or = _Or

export const Map = _Map

export const Get = _Get

export const HttpComponent = IHttpComponent

export const shallowEqual = _shallowEqual

export const HTTP = _HTTP

export const fromHttp = _fromHttp

export const fromPureHttp = _fromPureHttp

export const debug = _debug
