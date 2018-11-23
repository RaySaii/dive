import {Component} from 'react'
import {createChangeEmitter} from 'change-emitter'
import {from, Subject, Observable} from 'rxjs'
import {distinctUntilChanged, scan, shareReplay, tap} from 'rxjs/operators'
import shallowEqual from './shallowEqual'
import {drivers, oldMap} from './applyDriver'
import {cloneDeep,once} from 'lodash'
import subState$ from './subState'

export const componentFromStream = (myId,ownState$, update, streamsToVdom) => {
  return class ComponentFromStream extends Component {
    constructor() {
      super()
      this.driversSubscription = []
      this.transfer = {}
      this.state$ = ownState$
      // 没有lens的组件，不与global连接，自己维护状态
      if (typeof ownState$ == 'function') {
        this.state$ = ownState$().pipe(
            scan((state, reducer) => reducer(state), {}),
            distinctUntilChanged(),
        )
        update = (ownReducer) => {
          if (ownReducer == null) return
          let reducer = ownReducer
          if (typeof ownReducer !== 'function') {
            reducer = state => Object.assign({}, state, ownReducer)
          }
          this.state$.next(reducer)
        }
      } else {
        // 与global连接的组件状态送入subState$流
        // 需注意在这里subscribe是为了避免在dive执行时
        // 放在ownState$pipe中会造成多次next
        this.state$.subscribe(state => subState$.next({ [myId]: state }))
      }

      this.state$.update = function (observable) {
        this.reducerSubscription = observable.subscribe(reducer => {
          update(reducer)
        })
      }

      Object.keys(drivers).forEach(key => {
        this.transfer[key] = new Subject()
        drivers[key].update = (obs) => {
          this.driversSubscription.push(
              obs.subscribe(this.transfer[key]),
          )
          oldMap[key](this.transfer[key])
          drivers[key].update = oldMap[key]
        }
      })
      // Stream of vdom
      this.vdom$ = streamsToVdom({
        props$: this.props$.pipe(distinctUntilChanged(shallowEqual)),
        state$: this.state$,
        eventHandle: {
          event: (eventName) => {
            this.eventMap[eventName] = this.eventMap[eventName] || new Subject()
            return this.eventMap[eventName]
          },
          handle: (eventName) => {
            return (...args) => this.eventMap[eventName].next(args.length > 1 ? args : args[0])
          },
        },
        ...drivers,
      })
    }

    state = { vdom: null }
    eventMap = {}

    propsEmitter = createChangeEmitter()


    props$ = Observable.create(observer => {
      this.propsEmitter.listen(props => {
        if (props) {
          observer.next(props)
        } else {
          observer.complete()
        }
      })
    })


    setSubscribe = once(() => {
      console.log(myId)
      this.vdomSubscription = this.vdom$.subscribe({
        next: vdom => {
          console.log(myId,'render')
          this.setState({ vdom })
        },
      })
      // Subscribe to child prop changes so we know when to re-render
      this.propsEmitter.emit(this.props)
    })

    componentWillMount() {
      this.setSubscribe()
    }

    componentWillReceiveProps(nextProps) {
      // Receive new props from the owner
      this.propsEmitter.emit(nextProps)
    }

    shouldComponentUpdate(nextProps, nextState) {
      return nextState.vdom !== this.state.vdom
    }

    componentWillUnmount() {
      // Call without arguments to complete stream
      this.propsEmitter.emit()
      // Clean-up subscription before un-mounting
      this.vdomSubscription.unsubscribe()
      this.reducerSubscription && this.reducerSubscription.unsubscribe()
      this.driversSubscription.forEach(sub => sub.unsubscribe())
    }

    render() {
      return this.state.vdom
    }
  }
}


