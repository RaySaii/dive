import { IHttpComponent } from './HttpComponent'
import _shallowEqual from './shallowEqual'
import { _And, _debug, _Or, _pickByKey, _shouldUpdate } from './utils'
import IHTTP from './http'
import { isPlainObject, pick } from 'lodash'
import * as React from 'react'
import { ComponentFromStream, EventHandle, GlobalEvent, Props, Reducer, Sources, State } from './type'
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs'
import { distinctUntilChanged, scan, shareReplay, skip, tap, takeWhile, take, filter, map } from 'rxjs/operators'
import { ReactElement } from 'react'

// 组件状态流
function getState(state$: Observable<Reducer>): Subject<State> {
    return state$.pipe(
        scan((state, reducer) => {
            //如果是函数使用函数处理获得新状态
            if (typeof reducer == 'function') {
                return reducer(state)
            } else {
                //如果是对象，合并为新对象
                return Object.assign({}, state, reducer)
            }
        }, {}),
        //浅比较
        distinctUntilChanged(shallowEqual),
        //回放，处理多次订阅
        shareReplay(1),
    ) as Subject<State>
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
        return class DiveComponent extends React.Component {
            active = true
            init = true
            state = { vdom: null }
            static globalState$ = globalState$
            static globalEvent: GlobalEvent = {
                handle: eventName => {
                    return (...args) => args.length > 1 ?
                        globalEventMap[eventName].next(args) : globalEventMap[eventName].next(args[0])
                },
                event: eventName => globalEventMap[eventName].pipe(
                    map((...args: any[]) => {
                        if (args[args.length - 1] == 'from inner') {
                            args.pop()
                            return args.length > 1 ? args : args[0]
                        }
                    }),
                ),
            }
            state$ = getState(new BehaviorSubject(Object.assign(state, currentGlobalState)))
            eventHandleMap = {
                didMount: new Subject(),
            }
            eventHandle: EventHandle = {
                handle: eventName => {
                    this.eventHandleMap[eventName] = this.eventHandleMap[eventName] || new Subject()
                    return (...args) => {
                        if (args.length > 1) {
                            this.eventHandleMap[eventName].next(args)
                        } else {
                            this.eventHandleMap[eventName].next(args[0])
                        }
                        // console.log(args.concat('from inner'))
                        if (globalEventMap[eventName]) globalEventMap[eventName].next(args.concat('from inner'))
                    }
                },
                event: eventName => {
                    this.eventHandleMap[eventName] = this.eventHandleMap[eventName] || new Subject()
                    return this.eventHandleMap[eventName]
                },
                didMount: this.eventHandleMap['didMount'],
            }
            props$: Subject<Props>
            reducer$: Observable<Reducer>
            vdom$: Observable<ReactElement<any>>
            subs: Subscription[] = []

            constructor(props: Props) {
                super(props)
                this.props$ = new BehaviorSubject(props).pipe(
                    distinctUntilChanged(shallowEqual),
                    shareReplay(1),
                ) as Subject<any>
                const sinks = func({ state$: this.state$, props$: this.props$, eventHandle: this.eventHandle })
                this.reducer$ = sinks.reducer || new Subject()
                this.vdom$ = sinks.DOM || sinks
            }


            componentWillReceiveProps(nextProps: Props) {
                this.props$.next(nextProps)
            }

            componentDidMount() {
                this.subs = this.subs.concat(
                    globalEvent.map(eventName => {
                        this.eventHandleMap[eventName] = this.eventHandleMap[eventName] || new Subject()
                        return globalEventMap[eventName].pipe(
                            filter((args: any[]) => {
                                if (args && args[args.length - 1] == 'from inner') {
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
                    //状态更新
                    this.reducer$.pipe(
                        takeWhile(() => this.active),
                    ).subscribe(
                        reducer => this.state$.next(reducer),
                        err => console.error('[dive] reducer new state error', err),
                    ),
                    //dom流更新dom
                    this.vdom$.pipe(
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
                    ),
                )
            }

            componentWillUnmount() {
                this.active = false
                this.state$.complete()
                this.subs.forEach(sub => {
                    if (sub.unsubscribe) {
                        sub.unsubscribe()
                    }
                })
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
