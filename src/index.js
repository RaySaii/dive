import {componentFromStream} from './componentFromStream'
import {Observable, of, merge, EMPTY, Subject, BehaviorSubject} from 'rxjs'
import globalState$, {globalState} from './globalState'
import {distinctUntilChanged, filter, map, scan, share, shareReplay, startWith, switchMap, tap} from 'rxjs/operators'
import shallowEqual from './shallowEqual'
import {cloneDeep, isEqual} from 'lodash'

export default function dive({ lens, state: initState = {} }) {
  let ownState$
  let update
  if (!lens) {
    ownState$ = () => new BehaviorSubject(_ => initState)
  }
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
      if (ownReducer == null) return  // 当下一个reducer为null时放弃更新
      let reducer = null
      if (typeof ownReducer == 'function') {
        reducer = state => {
          const prevState = lens.get(state)
          const nextState = ownReducer(prevState)
          if (nextState == prevState) return state// 当下一个reducer函数返回值仍为state时放弃更新
          return lens.set(state, nextState)
        }
      } else {
        // reducer为对象与setState同
        reducer = state => lens.set(state, Object.assign({}, lens.get(state), ownReducer))
      }
      globalState$.next(reducer)
    }
    globalState$.next(state => lens.set(state, handledInit))
    ownState$ = globalState$.pipe(
        // 可能存在时序的问题，将不是当前状态过滤掉
        filter(state => state == globalState),
        map(lens.get),
        distinctUntilChanged(isEqual),
    )
  } else if (typeof lens == 'string') {
    const myId = lens
    update = (ownReducer) => {
      if (ownReducer == null) return
      let reducer = null
      if (typeof ownReducer == 'function') {
        reducer = state => {
          const prevState = state[myId]
          const nextState = ownReducer(prevState)
          if (nextState == prevState) return state
          return ({ ...state, [myId]: nextState })
        }
      } else {
        reducer = state => ({ ...state, [myId]: Object.assign({}, state[myId], ownReducer) })
      }
      globalState$.next(reducer)
    }
    globalState$.next(state => ({ ...state, [myId]: initState }))
    ownState$ = globalState$.pipe(
        filter(state => state == globalState),
        map(state => state[myId]),
        distinctUntilChanged(isEqual),
    )
  }

  return streamsToVdom => {
    return componentFromStream(ownState$, update, streamsToVdom, !lens)
  }
}
