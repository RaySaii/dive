import { componentFromStream } from './componentFromStream'
import { Observable, Subject } from 'rxjs'
import globalState$, { globalState, actions$ } from './globalState'
import { distinctUntilChanged, filter, map, withLatestFrom } from 'rxjs/operators'
import { isEmpty, uniqueId, isPlainObject } from 'lodash'
import _setDevTool from './devTool'
import _applyDrive from './applyDriver'
import { IHttpComponent } from './HttpComponent'
import _shallowEqual from './shallowEqual'
import { _And, _debug, _Or } from './utils'
import { ComponentClass, ReactElement } from 'react'
import { Drivers, Props, Reducer, ReducerFn, State } from './type'
import IHTTP from './http'

type GetFn = (globalState: State) => State
type GetFnOnly = (globalState: State, ownState: State) => State
type SetFn = (globalState: State, ownState: State) => State

export type ComponentFactory = (streamsToSinks: StreamsToSinksFn) => ComponentClass<Props, State>

export type UpdateGlobalFn = (state: State) => void

export type UpdateFn = (reducer: Reducer, init?: boolean) => void

export type SinksSources = {
    state$: Subject<State>,
    props$: Observable<Props>,
    eventHandle: {
        event: (eventName: string) => Observable<any>,
        handle: (eventName: string) => (...args: any[]) => void
    }
} & Drivers

export type Sinks = Observable<null | ReactElement<any>> | {
    DOM: Observable<null | ReactElement<any>>
    reducer: Observable<Reducer>
}

export type StreamsToSinksFn = (sinksSources: SinksSources) => Sinks

export type Lens = string | { get: GetFnOnly } | { get?: GetFn, set: SetFn }

export type DiveSources = { lens?: Lens, state: State } | { lens: Lens, state?: State }

export type StateStreamFactory = (state$: Observable<State>) => Observable<State>

export default function dive(x?: DiveSources): ComponentFactory | void {
    let state$: Subject<State>
    let update: any
    let myId: string
    if (!x) {
        return (streamsToSinks: StreamsToSinksFn) => componentFromStream({
            initState: {},
            streamsToSinks,
            type: 'empty-lens',
        })
    }
    if (!isPlainObject(x)) {
        console.error('[dive] expected a object or nothing')
        return
    }

    if (!('lens' in x) && !('state' in x)) {
        console.error('[dive] object expected fields lens or state or both')
        return
    }

    let { lens, state: initState } = x

    if (!lens) {
        return streamsToSinks => componentFromStream({
            initState,
            streamsToSinks,
            type: 'empty-lens',
        })
    }
    if (typeof lens == 'object') {
        const get = lens['get']
        const set = lens['set']
        if (!get && !set) {
            console.error('[dive] lens expected fields lens or state or both')
            return
        } else if (!get && set) {
            const updateGlobal = (ownState: State) => {
                let reducer = (state: State) => set(state, ownState)
                globalState$.next(reducer)
            }
            return streamsToSinks => componentFromStream({
                updateGlobal,
                initState,
                streamsToSinks,
                type: 'only-set-lens',
            })
        } else if (!set && get) {
            let stateStreamFactory = (ownState$: Observable<State>) => globalState$.pipe(
                withLatestFrom(ownState$, (state, ownState) => (<GetFnOnly>get)(state, ownState || {})),
            )
            return streamsToSinks => componentFromStream({
                stateStreamFactory,
                initState,
                streamsToSinks,
                type: 'only-get-lens',
            })
        } else {
            myId = uniqueId('dive')
            // const handledInit = Object.assign(initState, lens.get(globalState))
            update = (ownReducer: Reducer, init = false) => {
                if (ownReducer == null) return  // 当下一个reducer为null时放弃更新
                let reducer = null
                if (typeof ownReducer == 'function') {
                    reducer = (state: State) => {
                        const prevState: State = (<GetFn>get)(state)
                        const nextState: State = (<ReducerFn>ownReducer)(prevState)
                        // 当下一个reducer函数返回值仍为state时放弃更新
                        if (nextState == prevState) {
                            actions$.next({ id: myId, unChanged: true })
                            return state
                        }
                        const nextGlobalState = set(state, nextState)
                        actions$.next({ id: myId, state, nextState: nextGlobalState })
                        return nextGlobalState
                    }
                } else {
                    // reducer为对象与setState同
                    reducer = (state: State) => {
                        const nextGlobalState = set(state, Object.assign({}, init ? {} : (<GetFn>get)(state), ownReducer))
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
                map((<GetFn>get)),
                distinctUntilChanged(shallowEqual),
            ) as Subject<State>
        }
    } else if (typeof lens == 'string') {
        myId = lens
        update = (ownReducer: Reducer, init = false) => {
            if (ownReducer == null) return
            let reducer = null
            if (typeof ownReducer == 'function') {
                reducer = (state: State) => {
                    const prevState = state[myId]
                    const nextState = (<ReducerFn>ownReducer)(prevState)
                    if (nextState == prevState) {
                        actions$.next({ id: myId, unChanged: true })
                        return state
                    }
                    const nextGlobalState = { ...state, [myId]: nextState }
                    actions$.next({ id: myId, state, nextState: nextGlobalState })
                    return nextGlobalState
                }
            } else {
                reducer = (state: State) => {
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
        )  as Subject<State>
    }

    return streamsToSinks => componentFromStream({ myId, state$, update, streamsToSinks })
}

export const applyDriver = _applyDrive
export const setDevTool = _setDevTool

export const And = _And

export const Or = _Or

export const HttpComponent = IHttpComponent

export const shallowEqual = _shallowEqual

export const HTTP = new IHTTP()

export const fromHttp = HTTP.fromHttp

export const fromPureHttp = HTTP.fromPureHttp

export const debug = _debug
