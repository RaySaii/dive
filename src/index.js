import {componentFromStream} from './componentFromStream'
import {Observable, of, merge, EMPTY} from 'rxjs'
import globalState$, {globalState} from './globalState'
import {distinctUntilChanged, filter, map, share, shareReplay, startWith, switchMap, tap} from 'rxjs/operators'
import shallowEqual from './shallowEqual'
import {debug} from '../utils'
import {cloneDeep, isEqual} from 'lodash'

let id = 0
export default function dive({ lens, state: initState = {} }) {
  let ownState$
  let update
  if (typeof lens == 'object') {
    if (!lens.get) {
      console.error('[dive] get is necessary in lens')
      return
    }
    if (!lens.set) {
      console.error('[dive] set is necessary in lens')
      return
    }

    const handledInit = Object.assign(initState, lens.get(globalState))
    update = (ownReducer) => {
      if (ownReducer == null) return
      let reducer = null
      if (typeof ownReducer == 'function') {
        reducer = state => lens.set(state, ownReducer(lens.get(state)))
      } else {
        reducer = state => lens.set(state, Object.assign({}, lens.get(state), ownReducer))
      }
      globalState$.next(reducer)
    }
    globalState$.next(state => {
      return lens.set(state, handledInit)
    })
    ownState$ = globalState$.pipe(
        // 可能存在时序的问题，将不是当前状态过滤掉
        filter(state => state == globalState),
        // 不可乱用 还是需要每次获取最新的状态
        shareReplay(1),
        map(lens.get),
        distinctUntilChanged(isEqual),
    )
  } else {
    if (lens == '') {
      console.error('[dive] lens except a string , object or unset')
      return
    }
    const myId = typeof lens == 'string' ? lens : 'dive' + id++
    update = (ownReducer) => {
      if (ownReducer == null) return
      let reducer
      if (typeof ownReducer == 'function') {
        reducer = state => ({ ...state, [myId]: ownReducer(state[myId]) })
      } else {
        reducer = state => ({ ...state, [myId]: Object.assign({}, state[myId], ownReducer) })
      }
      globalState$.next(reducer)
    }
    globalState$.next(state => ({ ...state, [myId]: initState }))
    ownState$ = globalState$.pipe(
        filter(state => state == globalState),
        shareReplay(1),
        map(state => state[myId]),
        distinctUntilChanged(isEqual),
    )
  }

  let subscription = null
  ownState$.update = function (observable) {
    subscription = observable.subscribe(reducer => {
      update(reducer)
    })
  }

  function stopSubscribe() {
    subscription.unsubscribe()
  }

  return streamsToVdom => {
    return componentFromStream(ownState$, stopSubscribe, streamsToVdom)
  }
}
