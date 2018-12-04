import {componentFromStream} from './componentFromStream'
import {BehaviorSubject} from 'rxjs'
import globalState$, {globalState, actions$} from './globalState'
import {distinctUntilChanged, filter, map, share, shareReplay, tap, withLatestFrom} from 'rxjs/operators'
import {cloneDeep, isEmpty, isEqual, pick, uniqueId} from 'lodash'
import _setDevTool from './devTool'
import _applyDrive from './applyDriver'
import {IHttpComponent} from './HttpComponent'
import _shallowEqual from './shallowEqual'
import _HTTP, {_fromHttp, _fromPureHttp} from './http'
import {_And, _debug, _Get, _Map, _Or} from './utils'


export default function dive({ lens = {}, state: initState = {} }) {
  let state$
  let update
  let myId
  if (typeof lens == 'object') {
    lens = pick(lens, 'get', 'set')
    if (isEmpty(lens)) {
      return streamsToVdom => componentFromStream({
        myId,
        initState,
        streamsToVdom,
        type: 'empty-lens',
      })
    } else if (!lens.get && lens.set) {
      const updateGlobal = (ownState) => {
        let reducer = state => lens.set(state, ownState)
        globalState$.next(reducer)
      }
      return streamsToVdom => componentFromStream({
        updateGlobal,
        initState,
        streamsToVdom,
        type: 'only-set-lens',
      })
    } else if (!lens.set && lens.get) {
      state$ = (ownState$) => globalState$.pipe(
          withLatestFrom(ownState$, (state, ownState) => lens.get(state, ownState)),
      )
      return streamsToVdom => componentFromStream({
        state$,
        initState,
        streamsToVdom,
        type: 'only-get-lens',
      })
    } else {
      myId = uniqueId('dive')
      const handledInit = Object.assign(initState, lens.get(globalState))
      update = (ownReducer) => {
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
            const nextGlobalState = lens.set(state, Object.assign({}, lens.get(state), ownReducer))
            actions$.next({ id: myId, state, nextState: nextGlobalState })
            return nextGlobalState
          }
        }
        globalState$.next(reducer)
      }
      update(handledInit)
      state$ = globalState$.pipe(
          map(lens.get),
          distinctUntilChanged(shallowEqual),
      )
    }
  } else if (typeof lens == 'string') {
    myId = lens
    update = (ownReducer) => {
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
          const nextGlobalState = { ...state, [myId]: Object.assign({}, state[myId], ownReducer) }
          actions$.next({ id: myId, state, nextState: nextGlobalState })
          return nextGlobalState
        }
      }
      globalState$.next(reducer)
    }
    update(initState)
    state$ = globalState$.pipe(
        map(state => state[myId]),
        distinctUntilChanged(shallowEqual),
    )
  }

  return streamsToVdom => componentFromStream({ myId, state$, update, streamsToVdom })
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
