import {Component} from 'react'
import {createChangeEmitter} from 'change-emitter'
import {from, Subject, Observable} from 'rxjs'
import {distinctUntilChanged, shareReplay} from 'rxjs/operators'
import shallowEqual from './shallowEqual'
import {drivers, oldMap} from './applyDriver'

export const componentFromStream = (state$, stopSubscribe, streamsToVdom) => {
  return class ComponentFromStream extends Component {
    constructor() {
      super()
      this.driversSubscription = []
      this.transfer = {}
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
      this.vdom$ = from(streamsToVdom({
        props$: this.props$.pipe(distinctUntilChanged(shallowEqual), shareReplay(1)),
        state$: state$,
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
      }))
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

    // Stream of props


    componentWillMount() {
      // Subscribe to child prop changes so we know when to re-render
      this.subscription = this.vdom$.subscribe({
        next: vdom => {
          this.setState({ vdom })
        },
      })
      this.propsEmitter.emit(this.props)
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
      this.subscription.unsubscribe()
      stopSubscribe()
      this.driversSubscription.forEach(sub => sub.unsubscribe())
    }

    render() {
      return this.state.vdom
    }
  }
}


