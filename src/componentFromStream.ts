import { Component, ComponentClass, ReactElement } from 'react'
import { createChangeEmitter } from 'change-emitter'
import { Subject, BehaviorSubject, merge, EMPTY, Subscription, Observable, of } from 'rxjs'
import shallowEqual from './shallowEqual'
import { driverIn, driverOut } from './applyDriver'
import { isEmpty, uniqueId, omit } from 'lodash'
import subState$ from './subState'
import { actions$ } from './globalState'
import {
    distinctUntilChanged,
    filter,
    scan,
    share,
    shareReplay,
    takeWhile,
    tap,
    withLatestFrom,
    switchMap,
} from 'rxjs/operators'
import { UpdateFn, UpdateGlobalFn, StreamsToSinksFn, StateStreamFactory, Sinks } from './index'
import { Props, ReducerFn, State, Drivers, Reducer, StateCacheMap, StateCache$Map } from './type'

function getReducer(ownReducer: null | State | ReducerFn, id: string): ReducerFn | undefined {
    if (ownReducer == null) return
    if (typeof ownReducer !== 'function') {
        return (state: State): State => {
            const nextState = Object.assign({}, state, ownReducer)
            actions$.next({ id, state, nextState })
            return nextState
        }
    } else {
        return (state: State): State => {
            const nextState = (<ReducerFn>ownReducer)(state)
            if (state == nextState) {
                actions$.next({ id, unChanged: true })
            } else {
                actions$.next({ state, nextState, id })
            }
            return nextState
        }
    }
}

type Sources = {
    myId?: string,
    type?: string
    state$?: Subject<State>,
    update?: UpdateFn,
    initState?: State,
    updateGlobal?: UpdateGlobalFn,
    streamsToSinks: StreamsToSinksFn,
    stateStreamFactory?: StateStreamFactory,
}

type ComponentState = {
    vdom: null | ReactElement<any>
}

type EventMap = {
    [key: string]: Subject<any>
}

type ISubscription = Subscription | null

let updatingId: string = ''
const stateCacheMap: StateCacheMap = {}
const stateCache$Map: StateCache$Map = {}

export function componentFromStream(sources: Sources): ComponentClass {
    const { myId, state$, updateGlobal, initState, update, streamsToSinks, type, stateStreamFactory } = sources
    return class  extends Component<Props, ComponentState> {
        state: ComponentState = { vdom: null }
        state$: Subject<State> | undefined = state$
        propsEmitter: { listen: (...args: any[]) => void, emit: (...args: any[]) => void } = createChangeEmitter()
        props$: Subject<Props> = new Subject()
        update: UpdateFn | undefined = update
        updateGlobal: UpdateGlobalFn | undefined = updateGlobal
        subSubscription: ISubscription = null
        reducerSubscription: ISubscription = null
        driversSubscription: Subscription[] = []
        vdomSubscription: ISubscription = null
        myId: string | undefined = myId
        eventMap: EventMap = {}
        active: boolean = true
        curState: State = {}
        vdom$: Observable<null | ReactElement<any>>
        reducer$: Observable<Reducer>
        drivers: Drivers
        stateWithCache$: Observable<State> = new Subject()
        didMount: Subject<undefined> = new Subject()

        constructor(props: Props) {
            super(props)

            this.propsEmitter.listen((props: Props) => {
                if (props) {
                    this.props$.next(props)
                } else {
                    this.props$.complete()
                }
            })

            // 没有lens的组件，不与global连接，自己维护状态
            if (type == 'empty-lens') {
                this.myId = uniqueId('dive-isolate')
                this.state$ = new BehaviorSubject((_: any) => initState).pipe(
                    scan((state: State, reducer: ReducerFn | any) => reducer(state), {}),
                    distinctUntilChanged(shallowEqual),
                    tap(state => Object.assign(this.curState, state)),
                    shareReplay(1),
                    filter(state => {
                        if (isEmpty(this.curState)) return true
                        return shallowEqual(state, this.curState)
                    }),
                ) as Subject<State>
                this.update = (ownReducer) => {
                    let reducer = getReducer(ownReducer, this.myId!)
                    this.state$!.next(reducer)
                }
            } else if (type == 'only-get-lens') {
                this.myId = uniqueId('dive-isolate')
                const transfer$: Subject<State> = new BehaviorSubject(initState!)
                const globalState$ = stateStreamFactory!(transfer$).pipe(
                    distinctUntilChanged(shallowEqual),
                )
                const ownState$: Subject<State> = new Subject<ReducerFn>().pipe(
                    scan((state: State, reducer: ReducerFn | any) => reducer(state), initState!),
                    withLatestFrom(globalState$, (ownState, state) => Object.assign({}, state, ownState)),
                    distinctUntilChanged(shallowEqual),
                    tap((state: State) => transfer$.next(state)),
                    share(),
                ) as Subject<State>
                this.update = (ownReducer) => {
                    let reducer = getReducer(ownReducer, this.myId!)
                    ownState$.next(reducer)
                }
                this.state$ = merge(
                    globalState$.pipe(tap(state => Object.assign(this.curState, state))),
                    ownState$.pipe(tap(state => Object.assign(this.curState, state))),
                ).pipe(
                    distinctUntilChanged(shallowEqual),
                    shareReplay(1),
                    filter(state => {
                        if (isEmpty(this.curState)) return true
                        return shallowEqual(state, this.curState)
                    }),
                ) as Subject<State>
            } else if (type == 'only-set-lens') {
                this.myId = uniqueId('dive-isolate')
                this.state$ = new BehaviorSubject((_: any) => initState).pipe(
                    scan((state: State, reducer: ReducerFn | any) => reducer(state), {}),
                    distinctUntilChanged(),
                    tap(this.updateGlobal),
                ) as Subject<State>
                this.update = (ownReducer) => {
                    let reducer = getReducer(ownReducer, this.myId!)
                    this.state$!.next(reducer)
                }
            }
            stateCache$Map[this.myId!] = new Subject<State>()
            this.stateWithCache$ = merge(
                this.state$!.pipe(
                    switchMap((state: State) => {
                            if (updatingId && updatingId !== this.myId) {
                                stateCacheMap[this.myId!] = state
                                return EMPTY
                            } else {
                                return of(state)
                            }
                        },
                    ),
                    // tap(() => console.log(updatingId)),
                ),
                stateCache$Map[this.myId!],
            ).pipe(
                takeWhile(() => this.active),
            ) as Subject<State>
            this.subSubscription = this.stateWithCache$.subscribe(state => subState$.next({ [this.myId!]: state }))
            const sinks: Sinks = streamsToSinks({
                props$: this.props$.pipe(distinctUntilChanged(shallowEqual)),
                state$: this.stateWithCache$,
                didMount: this.didMount,
                eventHandle: {
                    event: (eventName) => {
                        this.eventMap[eventName] = this.eventMap[eventName] || new Subject()
                        return this.eventMap[eventName].pipe(shareReplay(1))
                    },
                    handle: (eventName) => (...args) => this.eventMap[eventName].next(args.length > 1 ? args : args[0]),
                },
                ...driverOut,
            })
            const DOM = sinks['DOM']
            const reducer = sinks['reducer']
            if (DOM) {
                this.vdom$ = DOM
                this.reducer$ = reducer
                this.drivers = omit(sinks, 'DOM', 'reducer')
            } else {
                this.vdom$ = sinks as Observable<null | ReactElement<any>>
                this.reducer$ = EMPTY
                this.drivers = {}
            }
        }

        componentDidMount() {
            this.vdomSubscription = this.vdom$
                .subscribe(
                    vdom => {
                        updatingId = this.myId!
                        this.setState({ vdom }, () => {
                            updatingId = ''
                            const stateCacheQueue = Object.keys(stateCacheMap)
                            if (stateCacheMap[stateCacheQueue[0]]) {
                                stateCache$Map[stateCacheQueue[0]].next(stateCacheMap[stateCacheQueue[0]])
                                delete stateCacheMap[stateCacheQueue[0]]
                            }
                        })
                    },
                    error => console.error(error),
                )
            if (this.reducer$) {
                this.reducerSubscription = this.reducer$
                    .subscribe(
                        (reducer: Reducer) => this.update!(reducer),
                        error => console.error(error),
                    )
            }
            this.didMount.next()
            Object.keys(this.drivers).forEach(key =>
                this.driversSubscription.push(
                    this.drivers[key].subscribe(
                        (data: any) => driverIn[key].next(data),
                        (error: any) => console.error(error),
                    ),
                ))
            this.propsEmitter.emit(this.props)
        }

        componentWillReceiveProps(nextProps: Props) {
            this.propsEmitter.emit(nextProps)
        }

        shouldComponentUpdate(_: any, nextState: ComponentState) {
            return nextState.vdom !== this.state.vdom
        }

        componentWillUnmount() {
            this.active = false
            this.propsEmitter.emit()
            this.vdomSubscription!.unsubscribe()
            Object.keys(this.eventMap).forEach(key => this.eventMap[key].complete())
            this.subSubscription!.unsubscribe()
            this.reducerSubscription && this.reducerSubscription.unsubscribe()
            this.driversSubscription.forEach(sub => sub.unsubscribe())
            this.didMount.complete()
        }

        render() {
            return this.state.vdom
        }
    }
}


