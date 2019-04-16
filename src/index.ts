import { IHttpComponent } from './HttpComponent'
import _shallowEqual from './shallowEqual'
import { _And, _debug, _Or, _pickByKey, _shouldUpdate, _xhr, _id, _await } from './utils'
import IHTTP from './http'
import { isPlainObject, pick } from 'lodash'
import {
    ComponentFromStream,
    EventHandle,
    GlobalEvent,
    IDiveComponent,
    Props,
    ReducerFn,
    Sources,
    State,
} from './type'
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs'
import {
    distinctUntilChanged,
    scan,
    shareReplay,
    skip,
    tap,
    takeWhile,
    take,
    filter,
    map,
} from 'rxjs/operators'
import { ReactElement } from 'react'
import produce from 'immer'

const componentId: () => number = _id()

declare module 'rxjs' {
    interface Observable<T> {
        reduce: (fn: (value: T) => ReducerFn) => void
    }
}

export default function dive(sources: Sources = { state: {}, globalState: [], globalEvent: [] }) {
    const { state = {}, globalState = [], globalEvent = [] } = sources
    if (!isPlainObject(state)) {
        console.error('[dive] state expected a object value')
        return
    }
    return (func: ComponentFromStream) => {
        let currentGlobalState: State | null = null
        //初始化时,从初始状态将全局状态pick出来
        const globalState$ = new BehaviorSubject(
            pick(state, globalState),
        ).pipe(
            distinctUntilChanged(shallowEqual),
            tap(state => currentGlobalState = state),
            shareReplay(1),
        ) as Subject<any>
        //初始化时，生成全局事件的map
        const globalEventMap = globalEvent.reduce((map, name) => {
            //全局事件可能在组件订阅之前就触发，需要回放
            map[name] = new Subject().pipe(shareReplay(1))
            return map
        }, {})
        return class DiveComponent extends IDiveComponent {

            static globalState$ = globalState$
            static globalEvent: GlobalEvent = {
                handle: eventName => {
                    return (...args) => args.length > 1 ?
                        globalEventMap[eventName].next(args) : globalEventMap[eventName].next(args[0])
                },
                event: eventName => globalEventMap[eventName].pipe(
                    map((args: any) => {
                        //浅拷贝 全局事件来源于组件内部事件以及外部组件调用
                        //组件内部事件传递的参数一定是数组且最后一项是'from inner'
                        if (args instanceof Array && args[args.length - 1] == 'from inner') {
                            args = [...args]
                            args.pop()
                            return args.length > 1 ? args : args[0]
                        }
                        return args
                    }),
                ),
            }

            //组件是否卸载
            active = true
            //组件是否是第一次setState
            init = true
            //组件vdom
            state = { vdom: null }
            //组件id
            id: number = componentId()
            //组件状态流
            state$ = new BehaviorSubject(Object.assign(state, currentGlobalState))
                .pipe(
                    scan((state: State, reducer: any) => {
                        if (typeof reducer == 'function') return reducer(state)
                        return state
                    }),
                    //浅比较
                    _shouldUpdate((previous, current) => {
                        let hasChange = !shallowEqual(previous, current)
                        if (!hasChange && this.currentReducer$) {
                            this.currentReducer$.next(current)
                            this.currentReducer$ = null
                        }
                        return hasChange
                    }),
                    //回放，处理多次订阅
                    shareReplay(1),
                    tap(state => this.currentState = state),
                ) as Subject<State>
            currentReducer$: Subject<State> | null = null
            currentState: State | null = null
            //组件事件
            eventHandleMap = {
                didMount: new Subject(),
                willUnmount: new Subject(),
                didUpdate: new Subject(),
            }
            //组件事件处理
            eventHandle: EventHandle = {
                handle: eventName => {
                    this.eventHandleMap[eventName] = this.eventHandleMap[eventName] || new Subject()
                    return (...args) => {
                        if (args.length > 1) {
                            this.eventHandleMap[eventName].next(args)
                        } else {
                            this.eventHandleMap[eventName].next(args[0])
                        }
                        //组件内部的事件，加一个标识
                        if (globalEventMap[eventName]) globalEventMap[eventName].next(args.concat('from inner'))
                    }
                },
                event: eventName => {
                    this.eventHandleMap[eventName] = this.eventHandleMap[eventName] || new Subject()
                    return this.eventHandleMap[eventName]
                },
                didMount: this.eventHandleMap['didMount'],
                willUnmount: this.eventHandleMap['willUnmount'],
                didUpdate: this.eventHandleMap['didUpdate'],
            }

            props$: Subject<Props>
            vdom$: Observable<ReactElement<any>>
            //组件的订阅
            subs: Subscription[] = []
            vdomSub: Subscription | null = null
            //组件的改变状态的reducer
            reducers: any[] = []

            constructor(props: Props) {
                super(props)
                const _this = this
                Observable.prototype.reduce = function (reducer) {
                    const newState$ = new Subject()
                    let activeSub = () => {
                        return this.subscribe((val: any) => {
                            _this.currentReducer$ = newState$
                            _this.state$.next(produce(reducer(val)))
                        })
                    }
                    _this.reducers.push(activeSub)
                    return newState$
                }
                this.props$ = new BehaviorSubject(props).pipe(
                    distinctUntilChanged(shallowEqual),
                    shareReplay(1),
                ) as Subject<any>
                const DOM = func({
                    state$: this.state$,
                    props$: this.props$,
                    eventHandle: this.eventHandle,
                })
                this.vdom$ = DOM
            }

            shouldComponentUpdate(_: any, nextState: Readonly<State>): boolean {
                return nextState.vdom !== this.state.vdom
            }

            componentWillReceiveProps(nextProps: Props) {
                this.props$.next(nextProps)
            }

            componentDidUpdate() {
                this.eventHandleMap['didUpdate'].next()
                if (this.currentReducer$) {
                    this.currentReducer$.next(this.currentState!)
                    this.currentReducer$ = null
                }
            }

            componentDidMount() {
                this.subs = this.subs.concat(
                    globalEvent.map(eventName => {
                        this.eventHandleMap[eventName] = this.eventHandleMap[eventName] || new Subject()
                        return globalEventMap[eventName].pipe(
                            filter((args: any) => {
                                //如果是来源于组件内部事件，不用同步
                                if (args instanceof Array && args[args.length - 1] == 'from inner') {
                                    return false
                                }
                                return true
                            }),
                        )
                            .subscribe((val: any) => this.eventHandleMap[eventName].next(val))
                    }),
                    //状态更新时，同步全局状态,应为初始化时生成全局状态，跳过第一回
                    this.state$.pipe(
                        skip(1),
                        takeWhile(() => this.active),
                    ).subscribe(
                        state => DiveComponent.globalState$.next(pick(state, globalState)),
                        err => console.error('[dive] private state to globalState$ update error', err),
                    ),
                    //如果同时存在多个本组件，组件生成时将全局状态更新到本组件
                    DiveComponent.globalState$.pipe(
                        take(1),
                        takeWhile(() => this.active),
                    ).subscribe(
                        state => this.state$.next(state),
                        err => console.error('[dive] globalState$ to private state update error', err),
                    ),
                    //激活reducer的订阅
                    this.reducers.map(sub => sub()),
                    //dom流更新dom
                )
                this.vdomSub = this.vdom$.pipe(
                    takeWhile(() => this.active),
                ).subscribe(
                    vdom => this.setState({ vdom }, () => {
                        //第一次dom为必是null，需要在react did时获取dom元素失效，所以在第一次setState后next did事件
                        if (this.init) {
                            this.init = false
                            this.eventHandleMap['didMount'].next()
                        }
                    }),
                    err => console.error('[dive] vdom$ to vdom update error', err),
                )
            }

            componentWillUnmount() {
                this.vdomSub!.unsubscribe()
                this.eventHandleMap.willUnmount.next()
                this.active = false
                this.subs.forEach(sub => {
                    if (sub.unsubscribe) {
                        sub.unsubscribe()
                    }
                })
                //complete 会使next失效，但是仍作为流
                this.state$.complete()
            }

            render() {
                return this.state.vdom
            }
        }
    }

}


export const And = _And

export const Or = _Or

export const HttpComponent = IHttpComponent

export const shallowEqual = _shallowEqual

export const HTTP = new IHTTP()

export const fromHttp = HTTP.fromHttp

export const fromPureHttp = HTTP.fromPureHttp

export const debug = _debug

export const shouldUpdate = _shouldUpdate

export const pickByKey = _pickByKey

export const xhr = _xhr

export const await = _await

