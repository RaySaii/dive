import React, {Component} from 'react'
import {createChangeEmitter} from 'change-emitter'
import {Subject, Observable, BehaviorSubject, merge, isObservable, EMPTY} from 'rxjs'
import shallowEqual from './shallowEqual'
import {driverIn, driverOut, drivers, oldMap} from './applyDriver'
import {cloneDeep, isEmpty, isEqual, once, uniqueId} from 'lodash'
import subState$ from './subState'
import {actions$} from './globalState'
import {
  distinctUntilChanged, filter,
  scan,
  share,
  shareReplay,
  takeWhile,
  tap,
  withLatestFrom,
} from 'rxjs/operators'

function getReducer(ownReducer, id) {
  if (ownReducer == null) return
  let reducer = ownReducer
  if (typeof ownReducer !== 'function') {
    reducer = state => {
      const nextState = Object.assign({}, state, ownReducer)
      actions$.next({ id, state, nextState })
      return nextState
    }
  } else {
    reducer = state => {
      const nextState = ownReducer(state)
      if (state == nextState) {
        actions$.next({ id, unChanged: true })
      } else {
        actions$.next({ state, nextState, id })
      }
      return nextState
    }
  }
  return reducer
}

export const componentFromStream = ({ myId, state$, updateGlobal, initState, update, streamsToSinks, type }) => {
  return class ComponentFromStream extends Component {
    constructor() {
      super()
      this.driversSubscription = []
      this.myId = myId
      this.state$ = state$
      this.update = update
      this.updateGlobal = updateGlobal
      this.state = { vdom: null }
      this.eventMap = {}
      this.active = true
      this.curState = {}

      this.propsEmitter = createChangeEmitter()


      this.props$ = Observable.create(observer => {
        this.propsEmitter.listen(props => {
          if (props) {
            observer.next(props)
          } else {
            observer.complete()
          }
        })
      })

      // 没有lens的组件，不与global连接，自己维护状态
      if (type == 'empty-lens') {
        this.myId = uniqueId('dive-isolate')
        this.state$ = new BehaviorSubject(_ => initState).pipe(
            scan((state, reducer) => reducer(state), {}),
            distinctUntilChanged(shallowEqual),
            tap(state => Object.assign(this.curState, state)),
            shareReplay(1),
            filter(state => {
              if (isEmpty(this.curState)) return true
              return shallowEqual(state, this.curState)
            }),
        )
        this.update = (ownReducer) => {
          let reducer = getReducer(ownReducer, this.myId)
          this.state$.next(reducer)
        }
      } else if (type == 'only-get-lens') {
        this.myId = uniqueId('dive-isolate')
        const transfer$ = new BehaviorSubject(initState)
        const globalState$ = state$(transfer$).pipe(
            distinctUntilChanged(shallowEqual),
        )
        const ownState$ = new Subject().pipe(
            scan((state, reducer) => reducer(state), initState),
            withLatestFrom(globalState$, (ownState, state) => Object.assign({}, state, ownState)),
            distinctUntilChanged(shallowEqual),
            tap(transfer$),
            share(),
        )
        this.update = (ownReducer) => {
          let reducer = getReducer(ownReducer, this.myId)
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
        )
      } else if (type == 'only-set-lens') {
        this.myId = uniqueId('dive-isolate')
        this.state$ = new BehaviorSubject(_ => initState).pipe(
            scan((state, reducer) => reducer(state), {}),
            distinctUntilChanged(),
            tap(this.updateGlobal),
        )
        this.update = (ownReducer) => {
          let reducer = getReducer(ownReducer, this.myId)
          this.state$.next(reducer)
        }
      }
      this.state$ = this.state$.pipe(
          takeWhile(() => this.active),
      )
      this.subSubscription = this.state$.subscribe(state => subState$.next({ [this.myId]: state }))
      const sinks = streamsToSinks({
        props$: this.props$.pipe(distinctUntilChanged(shallowEqual)),
        state$: this.state$,
        eventHandle: {
          event: (eventName) => {
            this.eventMap[eventName] = this.eventMap[eventName] || new Subject()
            return this.eventMap[eventName].pipe(shareReplay(1))
          },
          handle: (eventName) => (...args) => this.eventMap[eventName].next(args.length > 1 ? args : args[0]),
        },
        ...driverOut,
      })
      if (isObservable(sinks)) {
        this.vdom$ = sinks
        this.reducer$ = EMPTY
        this.drivers = {}
      } else {
        const { DOM, reducer, ...rest } = sinks
        this.vdom$ = DOM
        this.reducer$ = reducer
        this.drivers = rest
      }
    }

    componentDidMount() {
      this.vdomSubscription = this.vdom$
          .subscribe(vdom => this.setState({ vdom }))
      this.reducerSubscription = this.reducer$
          .subscribe(reducer => this.update(reducer))
      Object.keys(this.drivers).forEach(key =>
          this.driversSubscription.push(
              this.drivers[key].subscribe(driverIn[key]),
          ))
      this.propsEmitter.emit(this.props)
    }

    componentWillReceiveProps(nextProps) {
      this.propsEmitter.emit(nextProps)
    }

    shouldComponentUpdate(nextProps, nextState) {
      return nextState.vdom !== this.state.vdom
    }

    componentWillUnmount() {
      this.active = false
      this.propsEmitter.emit()
      this.vdomSubscription.unsubscribe()
      Object.keys(this.eventMap).forEach(key => this.eventMap[key].complete())
      this.subSubscription.unsubscribe()
      this.reducerSubscription && this.reducerSubscription.unsubscribe()
      this.driversSubscription.forEach(sub => sub.unsubscribe())
    }

    render() {
      return this.state.vdom
    }
  }
}


