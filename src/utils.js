import React from 'react'
import {get, isEmpty} from 'lodash'
import {tap} from 'rxjs/operators'
import {IHttpComponent} from './HttpComponent'
import _HTTP,{_fromHttp,_fromPureHttp} from './http';
import _shallowEqual from './shallowEqual';

/**
 * @return {boolean}
 */
export function _And(...rest) {
  for (let item of rest) {
    if (!item) return false
  }
  return true
}

/**
 * @return {boolean}
 */
export function _Or(...rest) {
  for (let item of rest) {
    if (!!item) return true
  }
  return false
}

export function _Get({ target, path, children }) {
  return get(target, path) ? children(get(target, path)) : null
}

export function _Map({ target, id, children }) {
  if (isEmpty(target)) return null
  let result = []
  for (let key in target) {
    let cur = children(target[key], id ? target[key][id] : key)
    result.push(cur)
  }
  return result
}

export function _debug(message, style = '') {
  const isDEV = process.env.NODE_ENV == 'development'
  return tap(
      nextValue => {
        if (isDEV) {
          style
              ? console.log(message, style, nextValue)
              : console.log(message, nextValue)
        }
      },
      error => {
        if (isDEV) {
          console.error(message, error)
        }
      },
      () => {
        if (isDEV) {
          console.log('Observable completed - ', message)
        }
      },
  )
}


